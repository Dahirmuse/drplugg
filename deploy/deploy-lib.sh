#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# DrPlugg – delade hjälpfunktioner för drift­skripten.
#
#   . "$APP_DIR/deploy/deploy-lib.sh"
#
# Innehåller inga sidoeffekter vid källning. Används av install.sh,
# update.sh och enable-tls.sh för att
#   • sätta PUBLIC_URL (så att omdirigeringar aldrig pekar på localhost)
#   • läsa domänen ur vårt eget nginx-block (utan att röra nginx)
#   • rökprova att Location-headern pekar på den publika adressen
# ══════════════════════════════════════════════════════════════

ENV_FILE_NAME=".env.local"
NGINX_SITE_NAME="drplugg"

# ── Domän: första icke-www server_name i vårt eget site-block ──
# OBS: skripten kör med IFS=$'\n\t', så vi kan inte lita på att "$var" splittras på
# mellanslag – server_name kan innehålla flera namn ("drplugg.se www.drplugg.se").
detect_domain() {
  local file="/etc/nginx/sites-available/${NGINX_SITE_NAME}"
  local name=""
  [[ -f "$file" ]] || return 0
  name="$(sed -n 's/^[[:space:]]*server_name[[:space:]]*\([^;]*\);.*/\1/p' "$file" \
    | tr -s ' \t' '\n' \
    | grep -v '^$' \
    | grep -v '^www\.' \
    | head -1 || true)"
  printf '%s\n' "$name"
  return 0
}

# ── Har certbot lagt ett certifikat för domänen? ──
tls_enabled() {
  local domain="${1:-}"
  [[ -n "$domain" && -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]
}

# ── Sätt PUBLIC_URL i .env.local (idempotent, nedgraderar aldrig https → http) ──
ensure_public_url() {
  local file="$1" value="$2" current
  [[ -n "$value" ]] || return 0
  [[ -f "$file" ]] || return 0

  # Skyddsnät: ett värde med mellanslag/nyrad är ingen giltig URL (t.ex. om
  # server_name lästes in fel) – skriv aldrig in det.
  case "$value" in
    *[[:space:]]*)
      echo "✗ PUBLIC_URL-värdet '$value' innehåller mellanslag – skriver inte in det." >&2
      return 0
      ;;
  esac

  current="$(sed -n "s/^PUBLIC_URL=//p" "$file" | tr -d '[:space:]' | tail -1)"
  if [[ "$current" == "$value" ]]; then
    echo "• PUBLIC_URL är redan ${value}"
    return 0
  fi
  if [[ "$current" == https://* && "$value" == http://* ]]; then
    echo "• behåller PUBLIC_URL=${current} (nedgraderas inte till http)"
    return 0
  fi
  # Ersätt ALLA PUBLIC_URL-rader (t.ex. en tom rad från .env.example) med ett
  # enda korrekt värde – annars kan filen få dubbla, motstridiga rader.
  if grep -q '^PUBLIC_URL=' "$file"; then
    sed -i '/^PUBLIC_URL=/d' "$file"
  fi
  printf 'PUBLIC_URL=%s\n' "$value" >> "$file"
  echo "✓ PUBLIC_URL=${value} skriven till $(basename "$file")"
}

# ── Rökprov: Location-headern måste peka på den publika adressen ──
#   $1 = URL att anropa (t.ex. https://drplugg.se/)
#   $2 = förväntad publik origin (t.ex. https://drplugg.se)
#   $3.. = extra curl-argument (t.ex. --resolve drplugg.se:443:127.0.0.1)
# Returnerar 0 = ok, 1 = fel (intern/främmande adress), 2 = kunde inte kontrollera.
check_redirect_location() {
  local url="$1" origin="${2%/}"
  shift 2

  local headers location
  headers="$(curl -sS --max-time 15 -o /dev/null -D - "$@" "$url" 2>/dev/null || true)"
  location="$(printf '%s\n' "$headers" \
    | awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/^[Ll]ocation:[[:space:]]*/,""); sub(/\r$/,""); print; exit}')"

  if [[ -z "$location" ]]; then
    echo "  ! ingen Location-header från ${url}"
    return 2
  fi
  echo "  Location: ${location}"

  if printf '%s' "$location" | grep -qiE 'localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]'; then
    echo "  ✗ omdirigeringen pekar på den INTERNA adressen"
    return 1
  fi

  case "$location" in
    "${origin}"/*) return 0 ;;
    /*) echo "  • relativ omdirigering (korrekt)"; return 0 ;;
    *)
      echo "  ✗ omdirigeringen pekar utanför ${origin}"
      return 1
      ;;
  esac
}
