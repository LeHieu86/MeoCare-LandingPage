#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# MeoCare — DB Baseline Script
#
# Dùng cho: Server đã có dữ liệu cũ nhưng chưa có _prisma_migrations
# (Prisma báo lỗi P3005 khi deploy lần đầu)
#
# Cách dùng:
#   cd /data/projects/MeoCare-LandingPage
#   ./scripts/db-baseline.sh
#
# Script sẽ tự động:
#   1. Đọc credentials từ .env
#   2. Kiểm tra từng migration — table nào đã tồn tại → baseline
#   3. Table chưa tồn tại → để prisma migrate deploy tự tạo
# ─────────────────────────────────────────────────────────────────────────────
set -e

NETWORK="${COMPOSE_PROJECT_NAME:-meocare-landingpage}_meocare-network"
ENV_FILE="${ENV_FILE:-.env}"
BACKEND_IMAGE="meocare-landingpage-backend"

echo "════════════════════════════════════════════════════════════════"
echo "  MeoCare — DB Baseline Tool"
echo "  Network : $NETWORK"
echo "  Env file: $ENV_FILE"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ── Đọc credentials ───────────────────────────────────────────────────────────
PGUSER=$(grep '^POSTGRES_USER='     "$ENV_FILE" | cut -d'=' -f2 | tr -d '\r')
PGPASSWORD=$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '\r')
PGDB=$(grep '^POSTGRES_DB='        "$ENV_FILE" | cut -d'=' -f2 | tr -d '\r')

if [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ] || [ -z "$PGDB" ]; then
  echo "❌ Không đọc được POSTGRES_USER/PASSWORD/DB từ $ENV_FILE"
  exit 1
fi

# ── Helper: chạy SQL trong postgres container ─────────────────────────────────
run_sql() {
  docker run --rm \
    --network "$NETWORK" \
    -e PGPASSWORD="$PGPASSWORD" \
    postgres:16-alpine \
    psql -h postgres-core -U "$PGUSER" -d "$PGDB" -tAq -c "$1" 2>/dev/null
}

# ── Kiểm tra _prisma_migrations đã tồn tại chưa ──────────────────────────────
echo "🔍 Kiểm tra migration history..."
HAS_HISTORY=$(run_sql "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';" || echo "")

if [ "$HAS_HISTORY" = "1" ]; then
  APPLIED_COUNT=$(run_sql "SELECT COUNT(*) FROM _prisma_migrations;")
  echo "✅ _prisma_migrations đã tồn tại với $APPLIED_COUNT migrations."
  echo "   Không cần baseline. Chạy: docker compose up -d backend"
  exit 0
fi

echo "⚠️  Chưa có _prisma_migrations — bắt đầu baseline..."
echo ""

# ── Helper: kiểm tra table có tồn tại không ──────────────────────────────────
table_exists() {
  RESULT=$(run_sql "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$1';")
  [ "$RESULT" = "1" ]
}

# ── Helper: baseline 1 migration ─────────────────────────────────────────────
baseline_migration() {
  local name="$1"
  docker run --rm \
    --network "$NETWORK" \
    --env-file "$ENV_FILE" \
    "$BACKEND_IMAGE" \
    sh -c "cd backend && npx prisma migrate resolve --applied $name" 2>&1 | grep -v "^$"
}

# ── Xử lý từng migration ─────────────────────────────────────────────────────
MIGRATIONS_DIR="backend/prisma/migrations"

for migration_path in "$MIGRATIONS_DIR"/*/; do
  migration_name=$(basename "$migration_path")
  sql_file="$migration_path/migration.sql"

  [ ! -f "$sql_file" ] && continue

  # Tìm tất cả CREATE TABLE trong file SQL
  created_tables=$(grep -oE 'CREATE TABLE (IF NOT EXISTS )?"[a-zA-Z_]+"' "$sql_file" 2>/dev/null \
    | grep -oE '"[a-zA-Z_]+"' | tr -d '"' || true)

  if [ -z "$created_tables" ]; then
    # Chỉ có ALTER TABLE — luôn baseline (không tạo table mới)
    echo "  [BASELINE] $migration_name (chỉ ALTER TABLE, không tạo table mới)"
    baseline_migration "$migration_name"
    continue
  fi

  # Kiểm tra tất cả tables được tạo có tồn tại không
  all_exist=true
  missing_tables=""
  for tbl in $created_tables; do
    if ! table_exists "$tbl"; then
      all_exist=false
      missing_tables="$missing_tables $tbl"
    fi
  done

  if $all_exist; then
    echo "  [BASELINE] $migration_name (tables đã tồn tại: $created_tables)"
    baseline_migration "$migration_name"
  else
    echo "  [SKIP]     $migration_name (tables chưa có:$missing_tables → Prisma sẽ tạo)"
  fi
done

echo ""
echo "✅ Baseline hoàn tất! Khởi động backend:"
echo "   docker compose up -d backend"
echo "   docker logs meocare-backend -f"
