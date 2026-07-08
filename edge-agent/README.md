# MeoCare Edge Agent (ghi hình tại biên)

Ghi camera **cục bộ** trên Kubuntu của từng chi nhánh, độc lập với trung tâm.
Trung tâm chỉ cấp desired-state (camera + ổ đĩa); agent tự kéo về và ghi xuống HDD nội bộ.
Mất Internet vẫn ghi bình thường.

> Phase 1: kéo config + ghi cục bộ + sync go2rtc nội bộ.
> Phase 2: heartbeat (báo df + trạng thái ghi) + nhận desired-state/lệnh.
> Phase 3: live từ xa — go2rtc re-serve RTSP `:8554` (app mở `rtsp://<tailnet_host>:8554/cam_<id>`).
> Phase 4: xem lại — agent phục vụ MP4 HTTP `:8080` (Range), app stream qua tailnet.

## Thành phần
- `go2rtc` — live view; RTSP `:8554`, WebRTC `:8555`, API `:1984` (qua tailnet/host network).
- `agent` (Node):
  - `agent.js` — vòng heartbeat mỗi `HEARTBEAT_INTERVAL`s: báo runtime lên + nhận desired-state,
    reconcile ghi bằng `recorder.js` (ffmpeg, port từ backend), sync go2rtc.
  - `playback.js` — HTTP `:8080` liệt kê/stream MP4 cho app xem lại (CHỈ mở trong tailnet).

## Cổng cần cho qua Tailscale (ACL chỉ cho trung tâm + máy admin)
- `8554/tcp` RTSP (live), `1984/tcp` go2rtc API, `8555/udp+tcp` WebRTC, `8080/tcp` playback.

## Cài đặt trên Kubuntu chi nhánh

1. **Mount 2 HDD** (ví dụ `/mnt/hdd1`, `/mnt/hdd2`) — nên thêm vào `/etc/fstab` để tự mount khi reboot.

2. **Cấu hình trung tâm** (làm 1 lần cho chi nhánh này, qua app/Postman):
   - Lưu cấu hình NAS: `disks` có `mount_path` đúng đường dẫn HDD cục bộ (vd `/mnt/hdd1`),
     gán mỗi camera vào `disk_id`, đặt `recording=true` cho camera muốn ghi.
   - Sinh token: `POST /api/admin/nas/agent-token` (header store của chi nhánh) → copy `agent_token`.

3. **Tạo `.env`** từ mẫu rồi điền `CENTRAL_URL` + `AGENT_TOKEN`:
   ```bash
   cp .env.example .env && nano .env
   ```

4. **Chạy**:
   ```bash
   docker compose up -d --build
   docker compose logs -f agent      # xem "▶ Bắt đầu ghi cam ..."
   ```

## Kiểm tra (Verification Phase 1)
- File xuất hiện: `/mnt/hdd1/<tên_cam>/<YYYY-MM-DD>/HH-MM-SS.mp4`.
- **Rút mạng Internet** → agent log cảnh báo "giữ ghi theo config cũ", file vẫn tiếp tục sinh ra.
- **Reboot Kubuntu** → HDD tự mount (fstab) + compose `restart: unless-stopped` bật lại → ghi tiếp.

## Lưu ý
- `mount_path` trong NasConfig **phải** khớp đường dẫn mount thật trên Kubuntu (compose mount
  `/mnt/hdd1:/mnt/hdd1` để path trong container = path host).
- Trung tâm: đặt `ENABLE_CENTRAL_RECORDER` (mặc định off) để KHÔNG ghi tập trung nữa.
