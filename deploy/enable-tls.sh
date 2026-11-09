#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# DrPlugg – TLS via Let's Encrypt (certbot, nginx-plugin).
#
#   sudo ./deploy/enable-tls.sh --domain drplugg.se
#
# Förutsätter att A-record för både <domän> och www.<domän> pekar på
# serverns publika IP, och att install.sh redan lagt nginx-siten.
# Sätter också COOKIE_SECURE=true och startar om tjänsten.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

DOMAIN=""
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_NAME="drplugg.service"

die() { echo "✗ $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    -h|--help) echo "Användning: sudo ./deploy/enable-tls.sh --domain <domän>"; exit 0 ;;
    *) die "Okänd flagga: $1" ;;
  esac
done

[[ ${EUID} -eq 0 ]] || die "Kör med sudo."
[[ -n "$DOMAIN" ]] || die "--domain krävs."
command -v certbot >/dev/null || die "certbot saknas."

echo "• kontrollerar att ${DOMAIN} pekar hit…"
RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
PUBLIC="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
if [[ -n "$RESOLVED" && -n "$PUBLIC" && "$RESOLVED" != "$PUBLIC" ]]; then
  echo "  ⚠ ${DOMAIN} pekar på ${RESOLVED}, serverns publika IP är ${PUBLIC}."
  printf '  Fortsätt ändå? (yes/no) '
  read -r A
  [[ "$A" == "yes" ]] || die "Avbrutet – rätta DNS först."
fi

echo "• kör certbot…"
certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" --redirect --agree-tos --non-interactive \
  --register-unsafely-without-email || certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" --redirect

nginx -t
systemctl reload nginx
echo "✓ certifikat installerat och nginx omladdad"

# Cookies måste vara Secure över HTTPS
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

Klart. Testa:  https://${DOMAIN}/login
Förnyelse sköts automatiskt av certbot.timer (kontrollera: systemctl list-timers certbot.timer).
EOF
