#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# DrPlugg – uppdatering till en ny release.
#
#   sudo ./deploy/update.sh            # senaste från branch prod
#   sudo ./deploy/update.sh v1.0.3     # en specifik tagg (rollback)
#
# Gör bara: git (som root) → backup → schema+content → starta om tjänsten.
# Rör aldrig nginx, certbot, systemd-uniten eller andra tjänster.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

APP_USER="drplugg"
UNIT_NAME="drplugg.service"
BACKUP_DIR="/var/backups/drplugg"
KEEP_BACKUPS=10
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-}"

die() { echo "✗ $*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Kör med sudo: sudo ./deploy/update.sh [tagg]"
[[ -f "$APP_DIR/server.js" ]] || die "$APP_DIR ser inte ut som en DrPlugg-publicering."
[[ -f "$APP_DIR/.env.local" ]] || die "$APP_DIR/.env.local saknas."
[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR är inte en git-klon."

cd "$APP_DIR"

# ── 1. Hämta koden (som root – katalogen är read-only för app-användaren) ──
PREVIOUS="$(cat .last-deploy 2>/dev/null || echo "okänd")"
echo "• nuvarande release: ${PREVIOUS}"

git fetch --tags --prune --force origin

if [[ -n "$TAG" ]]; then
  git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null || die "Taggen ${TAG} finns inte."
  git checkout --force "tags/${TAG}"
  NEW="$(git describe --tags --exact-match)"
else
  git checkout --force prod
  git reset --hard origin/prod
  NEW="$(git describe --tags --always || git rev-parse --short HEAD)"
fi
echo "• ny release: ${NEW}"

# ── 2. Backup INNAN något migreras ───────────────────────────
install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="${BACKUP_DIR}/drplugg-${STAMP}.dump"

if ! sudo -u "$APP_USER" bash -c "set -a; . '$APP_DIR/.env.local'; set +a; pg_dump -Fc -f '$DUMP'"; then
  die "pg_dump misslyckades – avbryter innan något migreras."
fi
echo "✓ backup: ${DUMP}"

# Behåll de 10 nyaste
ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm --
echo "• backuper kvar: $(ls -1 "${BACKUP_DIR}"/*.dump 2>/dev/null | wc -l)"

# ── 3. Schema + innehåll (idempotenta upserts, en transaktion vardera) ──
run_as_app() { sudo -u "$APP_USER" bash -c "set -a; . '$APP_DIR/.env.local'; set +a; $*"; }

run_as_app "psql -v ON_ERROR_STOP=1 --single-transaction -f '$APP_DIR/db/schema.sql'" >/dev/null
echo "✓ schema applicerat"

run_as_app "psql -v ON_ERROR_STOP=1 --single-transaction -f '$APP_DIR/db/content.sql'" >/dev/null
echo "✓ innehåll applicerat"

# ── 4. Starta om tjänsten ────────────────────────────────────
systemctl restart "$UNIT_NAME"
sleep 3
if ! systemctl is-active --quiet "$UNIT_NAME"; then
  journalctl -u "$UNIT_NAME" -n 40 --no-pager || true
  die "Tjänsten startade inte. Rulla tillbaka med: sudo ./deploy/update.sh ${PREVIOUS} (och återställ DB vid behov, se DEPLOY.md)."
fi

echo "$NEW" > .last-deploy
PORT="$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/${UNIT_NAME} 2>/dev/null | head -1)"
PORT="${PORT:-3311}"

if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/login"; then
  echo "✓ ${NEW} är igång (http://127.0.0.1:${PORT}/login)"
else
  journalctl -u "$UNIT_NAME" -n 40 --no-pager || true
  die "Appen svarar inte efter uppdateringen. Rulla tillbaka: sudo ./deploy/update.sh ${PREVIOUS}"
fi

echo "• föregående release var: ${PREVIOUS}"
