#!/usr/bin/env bash
# Aplica las migraciones sobre un Postgres VACÍO y corre supabase/tests/rls.sql.
# Uso: DATABASE_URL=postgresql://user:pass@host:5432/dbvacia npm run test:rls
# Con Supabase local (que ya trae auth), usa SKIP_AUTH_STUB=1 y una base recién reseteada.
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL apuntando a una base vacía y desechable}"
cd "$(dirname "$0")/.."
psql() { command psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
[ "${SKIP_AUTH_STUB:-}" = "1" ] || psql -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do psql -f "$f"; done
psql -f supabase/tests/rls.sql
