#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# DrPlugg – TLS via Let's Encrypt.
#
#   sudo ./deploy/enable-tls.sh --domain drplugg.se --expect-ip 188.151.198.154
#
# install.sh har lagt ett HTTP-only-block (port 80) med ACME-plats.
# Det här skriptet tar certifikatet med webroot, lägger det fullständiga
# 443-blocket och rullar tillbaka HTTP-blocket om nginx -t fallerar.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

DOMAIN=""
EXPECT_IP=""
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_NAME="drplugg.service"
NGINX_SITE="drplugg"

die() { echo "✗ $*" >&2; exit 1; }

usage() {
  cat <<EOF
Användning: sudo ./deploy/enable-tls.sh --domain <domän> --expect-ip <publik IP>

  --domain NAMN     Domänen (apex; www läggs till automatiskt)
  --expect-ip IP    Serverns publika IP – DNS måste peka hit (krävs)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --expect-ip) EXPECT_IP="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Okänd flagga: $1" ;;
  esac
done

[[ ${EUID} -eq 0 ]] || die "Kör med sudo."
[[ -n "$DOMAIN" ]] || { usage; die "--domain krävs."; }
[[ -n "$EXPECT_IP" ]] || { usage; die "--expect-ip krävs (vi gör inga externa IP-uppslag)."; }
command -v certbot >/dev/null || die "certbot saknas."
[[ -d /var/www/html ]] || die "/var/www/html saknas (behövs som webroot för ACME)."

# ── DNS-kontroll mot angiven IP (ingen extern tjänst) ───────
echo "• kontrollerar att ${DOMAIN} och www.${DOMAIN} pekar på ${EXPECT_IP}…"
for host in "$DOMAIN" "www.${DOMAIN}"; do
  IPS="$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u)"
  if [[ -z "$IPS" ]]; then
    die "${host} saknar A-record."
  fi
  if ! grep -qx "$EXPECT_IP" <<< "$IPS"; then
    die "${host} pekar på: $(tr '\n' ' ' <<< "$IPS")— förväntade ${EXPECT_IP}. Rätta DNS först."
  fi
done
echo "✓ DNS pekar rätt"

PORT="$(sed -n 's/^Environment=PORT=//p' "/etc/systemd/system/${UNIT_NAME}" 2>/dev/null | head -1)"
PORT="${PORT:-3311}"
SITE_FILE="/etc/nginx/sites-available/${NGINX_SITE}"
[[ -f "$SITE_FILE" ]] || die "${SITE_FILE} saknas – kör install.sh först."

# ── 1. Certifikat via webroot ───────────────────────────────
echo "• tar certifikat med webroot…"
certbot certonly --webroot -w /var/www/html \
  -d "$DOMAIN" -d "www.${DOMAIN}" \
  --non-interactive --keep-until-expiring

# ── 2. Lägg fullt TLS-block (spara HTTP-blocket för återställning) ──
BACKUP_FILE="${SITE_FILE}.http-backup.$(date +%Y%m%d-%H%M%S)"
cp "$SITE_FILE" "$BACKUP_FILE"
sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__PORT__|${PORT}|g" \
    "$APP_DIR/deploy/nginx-drplugg.conf" > "$SITE_FILE"
echo "✓ TLS-block skrivet (HTTP-blocket sparat i ${BACKUP_FILE})"

# ── 3. nginx -t med återställning ───────────────────────────
if ! nginx -t; then
  cp "$BACKUP_FILE" "$SITE_FILE"
  echo "✗ nginx -t misslyckades – HTTP-blocket återställt, inget laddades om." >&2
  exit 1
fi
systemctl reload nginx
echo "✓ certifikat installerat och nginx omladdad"

# ── 4. Cookies måste vara Secure över HTTPS ─────────────────
ENV_FILE="$APP_DIR/.env.local"
if grep -q '^COOKIE_SECURE=' "$ENV_FILE"; then
  sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|' "$ENV_FILE"
else
  echo "COOKIE_SECURE=true" >> "$ENV_FILE"
fi
chown drplugg:drplugg "$ENV_FILE"
chmod 600 "$ENV_FILE"
systemctl restart "$UNIT_NAME"
sleep 2
systemctl is-active --quiet "$UNIT_NAME" && echo "✓ tjänsten omstartad med COOKIE_SECURE=true"

cat <<EOF

Klart. Testa:  https://${DOMAIN}/login   (förväntat: HTTP/2 200)
Förnyelse: certbot.timer (kontrollera: systemctl list-timers certbot.timer)
EOF
