#!/usr/bin/env bash
# Backup diário do banco (Supabase/Postgres). Uso:  DATABASE_URL="postgresql://..." ./scripts/backup.sh [pasta]
# Agende no cron da VPS/servidor Linux:  0 4 * * *  cd /caminho/tradedesk && DATABASE_URL=... ./scripts/backup.sh /var/backups/hexadesk
# Guarda 14 dias. Copie a pasta para outro lugar (outro provedor/disco): backup no mesmo servidor não protege contra perda do servidor.
set -euo pipefail
: "${DATABASE_URL:?defina DATABASE_URL (Supabase: Project Settings → Database → Connection string)}"
DIR="${1:-./backups}"; mkdir -p "$DIR"
F="$DIR/hexadesk-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump --no-owner --no-privileges --schema=public "$DATABASE_URL" | gzip -9 > "$F"
test -s "$F" || { echo "backup vazio: algo falhou" >&2; exit 1; }
find "$DIR" -name 'hexadesk-*.sql.gz' -mtime +14 -delete
echo "backup ok: $F ($(du -h "$F" | cut -f1))"
