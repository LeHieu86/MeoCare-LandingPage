-- Camera độc lập: room_id optional, gán phòng sau.
-- Xóa phòng → camera mất gán (SET NULL) thay vì bị xóa theo (CASCADE).
ALTER TABLE "cameras" ALTER COLUMN "room_id" DROP NOT NULL;
ALTER TABLE "cameras" DROP CONSTRAINT "cameras_room_id_fkey";
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
