#!/usr/bin/env bash
# Aplica as migrações em um Postgres temporário e executa os testes de banco.
# Requisitos: PostgreSQL 15+ instalado localmente (initdb, pg_ctl, psql).
# Uso: npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | sort -V | tail -1)")}"
PORT="${PG_TEST_PORT:-54329}"
DATA_DIR="$(mktemp -d)"
RUN_AS=()

# O Postgres não roda como root; em contêineres usa o usuário "postgres"
if [ "$(id -u)" = "0" ]; then
  chown postgres:postgres "$DATA_DIR"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA_DIR" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -k $DATA_DIR -c listen_addresses=''" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$DATA_DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

# Cada arquivo de teste roda em um banco novo, com as migrações aplicadas
n=0
for test in "$ROOT"/supabase/tests/*_test.sql; do
  n=$((n + 1))
  db="teste_$n"
  echo "> $(basename "$test"): preparando banco $db"
  "${RUN_AS[@]}" "${PSQL[@]}" -d postgres -c "create database $db"
  "${RUN_AS[@]}" "${PSQL[@]}" -d "$db" -f "$ROOT/supabase/tests/auth-stub.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    "${RUN_AS[@]}" "${PSQL[@]}" -d "$db" -f "$f"
  done
  "${RUN_AS[@]}" "${PSQL[@]}" -d "$db" -f "$test"
done
