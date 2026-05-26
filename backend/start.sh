#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# MeoCare Backend — Startup Script
# Xử lý: đợi PostgreSQL sẵn sàng → chạy migration → khởi động server
# ─────────────────────────────────────────────────────────────────────────────
set -e

DB_HOST="${DB_HOST:-postgres-core}"
DB_PORT="${DB_PORT:-5432}"

# ── 1. Đợi PostgreSQL sẵn sàng ───────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
RETRIES=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge 30 ]; then
    echo "❌ PostgreSQL không phản hồi sau 60 giây. Dừng lại."
    exit 1
  fi
  echo "   Chưa sẵn sàng, thử lại sau 2s... ($RETRIES/30)"
  sleep 2
done
echo "✅ PostgreSQL sẵn sàng."

# ── 2. Chạy Prisma migration ──────────────────────────────────────────────────
cd /app/backend
echo "🔄 Running Prisma migrations..."

MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?
echo "$MIGRATE_OUTPUT"

if [ $MIGRATE_EXIT -ne 0 ]; then
  if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "⚠️  LỖI P3005: Database đã có dữ liệu nhưng chưa có migration"
    echo "   history. Đây là lần ĐẦU TIÊN deploy Prisma trên server này."
    echo ""
    echo "   Chạy lệnh sau để tự động baseline:"
    echo "   ./scripts/db-baseline.sh"
    echo ""
    echo "   Sau đó: docker compose up -d backend"
    echo "════════════════════════════════════════════════════════════════"
    exit 1
  fi
  echo "❌ Migration thất bại với exit code $MIGRATE_EXIT"
  exit $MIGRATE_EXIT
fi

# ── 3. Khởi động server ───────────────────────────────────────────────────────
echo "🚀 Starting Meo Care server..."
exec node server.js
