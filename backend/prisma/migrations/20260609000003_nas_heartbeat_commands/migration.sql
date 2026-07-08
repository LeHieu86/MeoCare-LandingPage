-- Phase 2 edge: heartbeat + runtime status + hàng lệnh chờ
ALTER TABLE "nas_config" ADD COLUMN "last_heartbeat" TIMESTAMP(3);
ALTER TABLE "nas_config" ADD COLUMN "runtime_status" JSONB;
ALTER TABLE "nas_config" ADD COLUMN "pending_commands" JSONB NOT NULL DEFAULT '[]';
