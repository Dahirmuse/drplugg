#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# DrPlugg – uppdatering till en granskad release.
#
#   sudo ./deploy/update.sh v1.0.1
#   sudo ./deploy/update.sh v1.0.1 --expect-commit <full sha>
#
# Taggen är OBLIGATORISK – vi deployar bara granskade taggar.
# Ordning: backup → git checkout → schema+content → restart.
# Rör aldrig nginx, certbot, systemd-uniten eller andra tjänster.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

APP_USER="drplugg"
UNIT_NAME="drplugg.service"
BACKUP_DIR="/var/backups/drplugg"
KEEP_BACKUPS=10
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

TAG=""
EXPECT_COMMIT=""

die() { echo "✗ $*" >&2; exit 1; }

usage() {
  cat <<EOF
Användning: sudo ./deploy/update.sh <tagg> [--expect-commit <sha>]

  <tagg>                  Krävs, t.ex. v1.0.1
  --expect-commit <sha>   Avbryt om taggens commit inte matchar (skydd mot flyttad tagg)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect-commit) EXPECT_COMMIT="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "Okänd flagga: $1" ;;
    *) [[ -z "$TAG" ]] || die "Ange bara en tagg."; TAG="$1"; shift ;;
  esac
done

[[ ${EUID} -eq 0 ]] || die "Kör med sudo: sudo ./deploy/update.sh <tagg>"
[[ -n "$TAG" ]] || { usage; die "Taggen är obligatorisk (vi deployar bara granskade taggar)."; }
[[ -f "$APP_DIR/server.js" ]] || die "$APP_DIR ser inte ut som en DrPlugg-publicering."
[[ -f "$APP_DIR/.env.local" ]] || die "$APP_DIR/.env.local saknas."
[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR är inte en git-klon."

cd "$APP_DIR"
PREVIOUS="$(cat .last-deploy 2>/dev/null || echo "")"

# ── Hämta taggen (fungerar även för --depth 1-klon) ─────────
echo "• hämtar taggen ${TAG}…"
git fetch --depth 1 --force --no-tags origin "refs/tags/${TAG}:refs/tags/${TAG}" 2>/dev/null \
  || git fetch --force --no-tags origin "refs/tags/${TAG}:refs/tags/${TAG}"
git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null || die "Taggen ${TAG} finns inte i origin."

COMMIT="$(git rev-list -n 1 "refs/tags/${TAG}")"
SHORT="$(git rev-parse --short "$COMMIT")"

if [[ -n "$EXPECT_COMMIT" && "$COMMIT" != "$EXPECT_COMMIT" ]]; then
  die "Taggen ${TAG} pekar på ${COMMIT}, förväntade ${EXPECT_COMMIT} – avbryter (taggen kan ha flyttats)."
fi

echo "══════════════════════════════════════════════════════════"
echo " Release att deploya : ${TAG}"
echo " Full commit         : ${COMMIT}"
echo " Nuvarande (.last-deploy): ${PREVIOUS:-okänd}"
echo "══════════════════════════════════════════════════════════"
printf 'Skriv "yes" för att fortsätta: '
read -r ANSWER
[[ "$ANSWER" == "yes" ]] || die "Avbrutet."

# ── 1. BACKUP FÖRST ─────────────────────────────────────────
install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="${BACKUP_DIR}/drplugg-${STAMP}.dump"

if ! sudo -u "$APP_USER" bash -c "set -a; . '$APP_DIR/.env.local'; set +a; pg_dump -Fc -f '$DUMP'"; then
  die "pg_dump misslyckades – avbryter innan något ändras."
fi
echo "✓ backup: ${DUMP}"

ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm --
echo "• backuper kvar: $(ls -1 "${BACKUP_DIR}"/*.dump 2>/dev/null | wc -l)"

# ── 2. Byt kod (först nu, efter backupen) ───────────────────
git checkout --force --detach "refs/tags/${TAG}"
echo "✓ kod incheckad på ${SHORT}"

# ── 3. Schema + innehåll, 4. omstart ────────────────────────
run_as_app() { sudo -u "$APP_USER" bash -c "set -a; . '$APP_DIR/.env.local'; set +a; $*"; }

ml_fail() {
  echo "✗ $*" >&2
  if [[ -n "$PREVIOUS" && "$PREVIOUS" != "unknown" ]]; then
    echo "→ rullar tillbaka koden till ${PREVIOUS}…"
    if git rev-parse -q --verify "refs/tags/${PREVIOUS}" >/dev/null; then
      git checkout --force --detach "refs/tags/${PREVIOUS}" && systemctl restart "$UNIT_NAME" || true
      echo "→ koden är tillbaka på ${PREVIOUS} och tjänsten omstartad."
    else
      echo "→ taggen ${PREVIOUS} finns inte lokalt – återställ manuellt."
    fi
  fi
  echo "→ Om databasen påverkats: återställ från ${DUMP} (se DEPLOY.md)."
  exit 1
}

run_as_app "psql -v ON_ERROR_STOP=1 --single-transaction -f '$APP_DIR/db/schema.sql'" >/dev/null \
  || ml_fail "schema.sql misslyckades"
echo "✓ schema applicerat"

run_as_app "psql -v ON_ERROR_STOP=1 --single-transaction -f '$APP_DIR/db/content.sql'" >/dev/null \
  || ml_fail "content.sql misslyckades"
echo "✓ innehåll applicerat"

systemctl restart "$UNIT_NAME"
sleep 3
systemctl is-active --quiet "$UNIT_NAME" || ml_fail "tjänsten startade inte efter uppdateringen"

PORT="$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/${UNIT_NAME} 2>/dev/null | head -1)"
PORT="${PORT:-3311}"
curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/login" || ml_fail "appen svarar inte på port ${PORT}"

printf '%s\n' "$TAG" > .last-deploy

echo "✓ ${TAG} (${SHORT}) är igång – http://127.0.0.1:${PORT}/login"
echo "• föregående release var: ${PREVIOUS:-okänd}"
echo "• rollback: sudo ./deploy/update.sh <tidigare tagg>"
