#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# DrPlugg – engångsinstallation på servern.
#
#   sudo ./deploy/install.sh --node-bin /usr/local/bin/node --domain drplugg.se
#
# Rör INGA andra nginx-sajter, ingen PostgreSQL-konfiguration och inga
# andra tjänster. Skriver ut allt den tänker göra och kräver "yes".
# Skriver ENDAST ett HTTP-block i nginx (TLS läggs av enable-tls.sh).
# ══════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

APP_USER="drplugg"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN=""
DOMAIN=""
PORT="3311"
DB_NAME="drplugg"
DB_USER="drplugg"
DATA_DIR="/var/lib/drplugg"
BACKUP_DIR="/var/backups/drplugg"
UNIT_NAME="drplugg.service"
NGINX_SITE="drplugg"
SKIP_NGINX="no"

usage() {
  cat <<EOF
Användning: sudo ./deploy/install.sh --node-bin <sökväg> [flaggor]

  --node-bin PATH     Absolut sökväg till node som ${APP_USER} kan köra (krävs)
  --domain NAMN       Domän för nginx (t.ex. drplugg.se)
  --port PORT         Lokal port (default ${PORT})
  --app-dir PATH      Publiceringsmapp (default: mappen ovanför deploy/)
  --db-name NAMN      Databasnamn (default ${DB_NAME})
  --db-user NAMN      Databasroll (default ${DB_USER})
  --skip-nginx        Rör inte nginx alls
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --node-bin) NODE_BIN="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --db-name) DB_NAME="${2:-}"; shift 2 ;;
    --db-user) DB_USER="${2:-}"; shift 2 ;;
    --skip-nginx) SKIP_NGINX="yes"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Okänd flagga: $1"; usage; exit 1 ;;
  esac
done

# ── Kör SQL som PostgreSQL-superuser (SQL via stdin, aldrig i argv) ──
run_pg_sql() {  # $1 = databas (tom = ingen), SQL på stdin
  local db="${1:-}"
  if sudo -n -u postgres true 2>/dev/null; then
    if [[ -n "$db" ]]; then sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f -
    else sudo -u postgres psql -v ON_ERROR_STOP=1 -f -; fi
  else
    if [[ -n "$db" ]]; then su - postgres -c "psql -v ON_ERROR_STOP=1 -d '$db' -f -"
    else su - postgres -c "psql -v ON_ERROR_STOP=1 -f -"; fi
  fi
}

run_pg_query() {  # $1 = SQL som ger ett värde
  if sudo -n -u postgres true 2>/dev/null; then
    postgres psql -tAc "$1"
  else
    su - postgres -c "psql -tAc \"$1\""
  fi
}

die() { echo "✗ $*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Kör som root: sudo ./deploy/install.sh ..."
[[ -n "$NODE_BIN" ]] || die "--node-bin krävs (Node får inte ligga i en hemkatalog som ${APP_USER} inte kan läsa)."
[[ -x "$NODE_BIN" ]] || die "$NODE_BIN finns inte eller är inte körbar."
[[ -f "$APP_DIR/server.js" ]] || die "$APP_DIR/server.js saknas – kör skriptet från publiceringsmappen (git-klonen av taggen)."
[[ -f "$APP_DIR/db/schema.sql" ]] || die "$APP_DIR/db/schema.sql saknas."
[[ -f "$APP_DIR/db/content.sql" ]] || die "$APP_DIR/db/content.sql saknas."
if [[ "$SKIP_NGINX" == "no" && -z "$DOMAIN" ]]; then
  die "--domain krävs (eller använd --skip-nginx)."
fi

ENV_FILE="$APP_DIR/.env.local"
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE saknas. Kör: cp .env.example .env.local och fyll i ADMIN_EMAIL, ADMIN_PASSWORD, DEEPSEEK_API_KEY – kör sedan om."

# ── Kontroll av ADMIN_EMAIL ──────────────────────────────────
ADMIN_EMAIL_VALUE="$(sed -n 's/^ADMIN_EMAIL=//p' "$ENV_FILE" | head -1 | tr -d '[:space:]')"
[[ -n "$ADMIN_EMAIL_VALUE" ]] || die "ADMIN_EMAIL är tom i $ENV_FILE – fyll i er adminadress."
[[ "$ADMIN_EMAIL_VALUE" == *"@"* ]] || die "ADMIN_EMAIL ser inte ut som en e-postadress: '$ADMIN_EMAIL_VALUE'."

# ── JWT_SECRET: generera om det saknas/är platshållare/för kort ──
JWT_VALUE="$(sed -n 's/^JWT_SECRET=//p' "$ENV_FILE" | head -1 | tr -d '[:space:]')"
if [[ -z "$JWT_VALUE" || "$JWT_VALUE" == *"byt-mig"* || ${#JWT_VALUE} -lt 32 ]]; then
  NEW_JWT="$(openssl rand -hex 32)"
  if grep -q '^JWT_SECRET=' "$ENV_FILE"; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|" "$ENV_FILE"
  else
    printf 'JWT_SECRET=%s\n' "$NEW_JWT" >> "$ENV_FILE"
  fi
  echo "✓ JWT_SECRET genererades (64 tecken) och skrevs till .env.local"
fi

# ── Skapa användaren först så att node-sökvägen kan testas ────
if ! id "$APP_USER" >/dev/null 2>&1; then
  NEEDS_USER="yes"
else
  NEEDS_USER="no"
fi

INSTALLED_TAG="$(git -C "$APP_DIR" describe --tags --exact-match 2>/dev/null || echo "unknown")"

echo
echo "══════════════════════════════════════════════════════════"
echo " DrPlugg – installationen kommer att skapa/ändra följande"
echo "══════════════════════════════════════════════════════════"
echo " Release     : ${INSTALLED_TAG}"
echo " Användare   : ${APP_USER} (system, shell=/usr/sbin/nologin)$([[ $NEEDS_USER == yes ]] && echo ' [ny]' || echo ' [finns]')"
echo " Kataloger   : ${APP_DIR} (kod, root-ägd, read-only för ${APP_USER})"
echo "               ${DATA_DIR}/cache/next (skrivbar för ${APP_USER})"
echo "               ${BACKUP_DIR} (skrivbar för ${APP_USER})"
echo " Node        : ${NODE_BIN}  (testas som ${APP_USER})"
echo " Databas     : roll '${DB_USER}' + databas '${DB_NAME}' (lösenord genereras)"
echo " Schema      : db/schema.sql + db/content.sql appliceras på '${DB_NAME}'"
echo " Adminkonto  : skapas från ADMIN_EMAIL + ADMIN_PASSWORD (raderas ur .env.local efteråt)"
echo " Tjänst      : /etc/systemd/system/${UNIT_NAME} (User=${APP_USER}, port ${PORT})"
if [[ "$SKIP_NGINX" == "no" ]]; then
  echo " Nginx       : /etc/nginx/sites-available/${NGINX_SITE} (ENDAST HTTP, port 80) + symlink"
  echo "               befintliga sajter, default och övriga filer lämnas orörda"
else
  echo " Nginx       : hoppas över (--skip-nginx)"
fi
echo " TLS         : körs INTE här – se deploy/enable-tls.sh"
echo "══════════════════════════════════════════════════════════"
printf 'Skriv "yes" för att fortsätta: '
read -r ANSWER
[[ "$ANSWER" == "yes" ]] || die "Avbrutet."

if [[ "$NEEDS_USER" == "yes" ]]; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
  echo "✓ användare ${APP_USER} skapad"
fi

install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$DATA_DIR" "$DATA_DIR/cache" "$DATA_DIR/cache/next"
install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$BACKUP_DIR"

mkdir -p "$APP_DIR/.next"
if [[ ! -L "$APP_DIR/.next/cache" ]]; then
  rm -rf "$APP_DIR/.next/cache"
  ln -s "$DATA_DIR/cache/next" "$APP_DIR/.next/cache"
  echo "✓ .next/cache → ${DATA_DIR}/cache/next"
fi

if ! sudo -u "$APP_USER" "$NODE_BIN" -v >/dev/null 2>&1; then
  die "${APP_USER} kan inte köra ${NODE_BIN}. Kontrollera rättigheter/path (hemkataloger med mode 750 fungerar inte)."
fi
NODE_VERSION="$(sudo -u "$APP_USER" "$NODE_BIN" -v)"
echo "✓ node ${NODE_VERSION} körbar som ${APP_USER}"

# ── Databas: roll och databas (lösenordet går via stdin, aldrig argv) ──
DB_PASS="$(openssl rand -hex 20)"
ROLE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" || true)"
if [[ "$ROLE_EXISTS" != "1" ]]; then
  printf "CREATE ROLE %s LOGIN PASSWORD %s;\n" \
    "\"${DB_USER}\"" "'${DB_PASS}'" | sudo -u postgres psql -v ON_ERROR_STOP=1 -f - >/dev/null
  echo "✓ databasroll ${DB_USER} skapad"
else
  echo "• databasroll ${DB_USER} finns redan – rör inte lösenordet"
  DB_PASS=""
fi

DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" || true)"
if [[ "$DB_EXISTS" != "1" ]]; then
  printf "CREATE DATABASE %s OWNER %s;\n" "\"${DB_NAME}\"" "\"${DB_USER}\"" \
    | sudo -u postgres psql -v ON_ERROR_STOP=1 -f - >/dev/null
  printf "REVOKE ALL ON DATABASE %s FROM PUBLIC;\n" "\"${DB_NAME}\"" \
    | sudo -u postgres psql -v ON_ERROR_STOP=1 -f - >/dev/null
  printf "ALTER SCHEMA public OWNER TO %s;\n" "\"${DB_USER}\"" \
    | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f - >/dev/null
  echo "✓ databas ${DB_NAME} skapad (ägare ${DB_USER})"
else
  echo "• databas ${DB_NAME} finns redan"
fi

if [[ -n "$DB_PASS" ]]; then
  if grep -q '^PGPASSWORD=' "$ENV_FILE"; then
    PGPASS_TMP="$(mktemp)"
    sed "s|^PGPASSWORD=.*|PGPASSWORD=${DB_PASS}|" "$ENV_FILE" > "$PGPASS_TMP"
    cat "$PGPASS_TMP" > "$ENV_FILE"
    rm -f "$PGPASS_TMP"
  else
    {
      echo ""
      echo "# Skapad av install.sh $(date -Iseconds)"
      echo "PGHOST=127.0.0.1"
      echo "PGPORT=5432"
      echo "PGDATABASE=${DB_NAME}"
      echo "PGUSER=${DB_USER}"
      echo "PGPASSWORD=${DB_PASS}"
    } >> "$ENV_FILE"
  fi
  echo "✓ databasuppgifter skrivna till .env.local (visas aldrig här)"
fi

chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ── Schema + innehåll (som app-användaren, hemligheter via env) ──
run_as_app() { sudo -u "$APP_USER" bash -c "set -a; . '$ENV_FILE'; set +a; $*"; }

run_as_app "psql -v ON_ERROR_STOP=1 --single-transaction -f '$APP_DIR/db/schema.sql'" >/dev/null
echo "✓ schema applicerat"
run_as_app "psql -v ON_ERROR_STOP=1 --single-transaction -f '$APP_DIR/db/content.sql'" >/dev/null
echo "✓ innehåll applicerat"

# ── Adminkonto, sedan bort med lösenordet ur .env.local ──────
sudo -u "$APP_USER" "$NODE_BIN" "$APP_DIR/deploy/create-admin.mjs"
if grep -q '^ADMIN_PASSWORD=' "$ENV_FILE"; then
  sed -i '/^ADMIN_PASSWORD=/d' "$ENV_FILE"
  echo "✓ ADMIN_PASSWORD borttagen från .env.local (admin-kontot är skapat)"
fi

# ── Rättigheter: kod root-ägd och read-only ─────────────────
chown -R root:root "$APP_DIR" 2>/dev/null || true
chown -R "$APP_USER:$APP_USER" "$DATA_DIR" "$BACKUP_DIR" "$APP_DIR/.next/cache"
chmod -R a-w "$APP_DIR" 2>/dev/null || true
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "✓ kod ägs av root och är read-only för ${APP_USER}"

# ── systemd ─────────────────────────────────────────────────
sed -e "s|__NODE_BIN__|${NODE_BIN}|g" \
    -e "s|__APP_DIR__|${APP_DIR}|g" \
    -e "s|__APP_USER__|${APP_USER}|g" \
    -e "s|__PORT__|${PORT}|g" \
    -e "s|__DATA_DIR__|${DATA_DIR}|g" \
    "$APP_DIR/deploy/drplugg.service" > "/etc/systemd/system/${UNIT_NAME}"
systemctl daemon-reload
systemctl enable --now "$UNIT_NAME"
echo "✓ ${UNIT_NAME} aktiverad"

sleep 3
if ! systemctl is-active --quiet "$UNIT_NAME"; then
  journalctl -u "$UNIT_NAME" -n 30 --no-pager || true
  die "Tjänsten startade inte – se loggen ovan."
fi
echo "✓ tjänsten kör"

# ── nginx: ENDAST HTTP-block (TLS läggs senare) ──────────────
if [[ "$SKIP_NGINX" == "no" ]]; then
  sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__PORT__|${PORT}|g" \
      "$APP_DIR/deploy/nginx-drplugg-http.conf" > "/etc/nginx/sites-available/${NGINX_SITE}"
  ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
  echo "✓ nginx-site skriven (HTTP) och länkad"

  if ! nginx -t; then
    rm -f "/etc/nginx/sites-enabled/${NGINX_SITE}"
    die "nginx -t misslyckades – vår site är avlänkad, övriga konfigurationer är orörda."
  fi
  systemctl reload nginx
  echo "✓ nginx omladdad"
fi

# ── Rökprov ─────────────────────────────────────────────────
sleep 1
if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/login"; then
  echo "✓ svarar på http://127.0.0.1:${PORT}/login"
else
  journalctl -u "$UNIT_NAME" -n 30 --no-pager || true
  die "Appen svarar inte på port ${PORT}."
fi

# ── Spara installerad tagg (används av update.sh för rollback) ──
printf '%s\n' "$INSTALLED_TAG" > "$APP_DIR/.last-deploy"
echo "✓ installerad release noterad: ${INSTALLED_TAG}"

cat <<EOF

══════════════════════════════════════════════════════════
 Klart. Nästa steg:
   1. Peka DNS (A-record för ${DOMAIN:-din domän} + www) mot serverns publika IP.
   2. Kör TLS:   sudo ./deploy/enable-tls.sh --domain ${DOMAIN:-din domän} --expect-ip <publik IP>
   3. Logga in som admin och skapa konton under /admin.
══════════════════════════════════════════════════════════
EOF
