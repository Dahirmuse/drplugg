# DrPlugg – drift och publicering (v1.0.4)

Det här paketet är en **färdigbyggd** DrPlugg-installation (Next.js standalone). Servern
behöver **ingen** npm/npm install och inget bygge — bara en `node`-binär och PostgreSQL.

## Innehåll

| Fil/mapp | Innehåll |
|---|---|
| `server.js`, `node_modules/`, `.next/`, `public/` | Appen, färdigbyggd |
| `db/schema.sql` | Databasschema (idempotent, bara tillägg — inga droppar) |
| `db/content.sql` | **Allt** kursmaterial (enbart upserts, inga deletes, inga användardata). Innehåller **ingen egen BEGIN/COMMIT** – transaktionen kommer från `psql --single-transaction` |
| `deploy/` | `install.sh`, `update.sh`, `enable-tls.sh`, systemd- och nginx-mallar, `create-admin.mjs` |
| `.env.example` | Mall för miljövariabler |
| `VERSION` | Version, byggtid, commit |
| `DEPLOY.md` | Den här filen |

---

## 1. Krav på servern

- nginx + certbot (nginx-plugin) + PostgreSQL + `curl`, `openssl`
- En **node-binär** som systemanvändaren `drplugg` kan köra (Node 22). **Får inte** ligga i en
  hemkatalog med mode 750. `install.sh` **kräver** `--node-bin` och testar körbarheten.
- Ledig lokal port (default **3311**), bunden till `127.0.0.1`.
- DNS: A-record för `domän` **och** `www.domän` → serverns publika IP (anges som `--expect-ip`).

---

## 2. Första installationen

```bash
sudo git clone --branch v1.0.4 --depth 1 https://github.com/Dahirmuse/drplugg.git /var/www/publish/drplugg
cd /var/www/publish/drplugg

sudo cp .env.example .env.local
sudo nano .env.local
#   ADMIN_EMAIL        = er adminadress        (obligatoriskt – install.sh vägrar annars)
#   ADMIN_PASSWORD     = ert lösenord          (raderas ur filen efter install)
#   DEEPSEEK_API_KEY   = er nyckel
#   JWT_SECRET         lämnas TOM – install.sh genererar (openssl rand -hex 32)
#   PGPASSWORD         lämnas TOM – install.sh genererar

sudo ./deploy/install.sh --node-bin /usr/local/bin/node --domain drplugg.se --port 3311
```

`install.sh` gör, i den här ordningen:

1. kontrollerar `ADMIN_EMAIL` (avbryter om tom) och genererar `JWT_SECRET` om det saknas,
   är platshållaren eller kortare än 32 tecken
2. skapar systemanvändaren `drplugg` (nologin) samt `/var/lib/drplugg` och `/var/backups/drplugg`
3. gör `.next/cache` till symlink → `/var/lib/drplugg/cache/next`
4. **testar** att `drplugg` kan köra `--node-bin` (avbryter annars)
5. skapar databasroll + databas med **slumpat lösenord**; SQL går via **stdin**, aldrig i argv
6. applicerar `db/schema.sql` + `db/content.sql` (`ON_ERROR_STOP=1 --single-transaction`)
7. skapar admin-kontot och **raderar sedan `ADMIN_PASSWORD` ur `.env.local`**
8. sätter kodägarskap `root:root`, read-only för `drplugg`; `.env.local` `600`
9. installerar/startar `drplugg.service`, rökprov på `/login`
10. lägger **endast** ett **HTTP-block (port 80)** i nginx (ingen TLS-referens → `nginx -t` går
    igenom innan certifikatet finns), `nginx -t` och reload; vid fel avlänkas bara vår site
11. skriver installerad tagg till `.last-deploy`

Den rör **inte** `pg_hba.conf`, `postgresql.conf` eller andra databaser/sajter.

---

## 3. TLS (efter att DNS pekar rätt)

```bash
sudo ./deploy/enable-tls.sh --domain drplugg.se --expect-ip 188.151.198.154
```

1. kontrollerar att **både** `domän` och `www.domän` resolverar till `--expect-ip` (ingen extern tjänst används)
2. `certbot certonly --webroot -w /var/www/html -d domän -d www.domän`
3. skriver det fullständiga 443-blocket (HTTP-blocket sparas som `.http-backup.<tid>`)
4. `nginx -t` — **misslyckas det återställs HTTP-blocket** och inget laddas om
5. sätter `COOKIE_SECURE=true` och startar om tjänsten

Förnyelse sköts av `certbot.timer`. Ingen `map` används; `Connection "upgrade"` sätts direkt.

---

## 4. Uppdatering (endast granskade taggar)

```bash
cd /var/www/publish/drplugg
sudo ./deploy/update.sh v1.0.2
# valfritt skydd mot flyttad tagg:
sudo ./deploy/update.sh v1.0.2 --expect-commit <full sha>
```

Taggen är **obligatorisk**. Skriptet:

1. hämtar taggen (fungerar även i `--depth 1`-klon)
2. skriver ut **tagg + full commit-hash** och kräver att ni skriver `yes`
3. **backup först**: `pg_dump -Fc` → `/var/backups/drplugg/drplugg-<tid>.dump` (10 senaste sparas);
   misslyckas dumppen avbryts allt
4. checkar ut taggen
5. kör `schema.sql` och `content.sql`
6. startar om tjänsten och gör rökprov. **Misslyckas 5 eller 6** checkas föregående tagg
   (från `.last-deploy`) ut och tjänsten startas om, med instruktion om DB-återställning

Ingen nginx, ingen certbot, inga andra tjänster.

---

## 5. Rollback

```bash
sudo ./deploy/update.sh v1.0.1          # koden tillbaka till en tidigare tagg (exempel)
```

Databasen rullas **inte** tillbaka automatiskt. Vid behov:

```bash
ls -1t /var/backups/drplugg/*.dump | head -3
sudo -u drplugg bash -c 'set -a; . /var/www/publish/drplugg/.env.local; set +a;
  pg_restore --clean --if-exists --no-owner -d "$PGDATABASE" /var/backups/drplugg/<fil>.dump'
sudo systemctl restart drplugg.service
```

Schemat är additivt (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`), så en äldre
release fungerar mot ett nyare schema.

---

## 6. Konton (registreringen är stängd)

- `ALLOW_REGISTRATION=false` (default i `.env.example`) → `/api/auth/register` svarar 403 och
  "Skapa konto" visas inte.
- **Admin skapar konton** under **Admin → Skapa konto**. Lösenordet genereras och visas **en gång**;
  databasen lagrar bara bcrypt-hash.
- **Admin sätter nytt lösenord** per användare (knappen "Lösenord") — behövs eftersom
  e-poståterställning kräver SMTP.
- Adminåtgärder loggas i `admin_audit` (aldrig lösenord) och är rate-limitade.

---

## 7. Felsökning

| Symptom | Orsak/åtgärd |
|---|---|
| `install.sh`: "drplugg kan inte köra <node>" | Node i hemkatalog med mode 750 – installera system-wide eller kopiera till `/usr/local/bin`. |
| 502 från nginx | `systemctl status drplugg` + `journalctl -u drplugg -n 50`. |
| Chatten "hänger" | `proxy_buffering off;` saknas i nginx-siten. |
| `EACCES` på `.next/cache` | Symlinken ska peka på `/var/lib/drplugg/cache/next` och ägas av `drplugg`. |
| `password authentication failed` | `pg_hba.conf` tillåter inte lösenordsauth på 127.0.0.1 – ägaren ändrar det. |
| `JWT_SECRET är för svag` i loggen | Sätt minst 32 tecken (inte "byt-mig"). |
| PDF-uppladdning ger 413 | `client_max_body_size` i nginx-siten (25 MB). |
