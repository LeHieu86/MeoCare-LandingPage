# Chế độ ghi hình: 1 máy ↔ 2 máy

Hệ thống có **2 cách ghi camera**, chuyển qua lại chỉ bằng **bật/tắt 1 overlay compose**,
không sửa code:

| Chế độ | Ai ghi hình | Khi nào dùng |
|--------|-------------|--------------|
| **1 MÁY** (central) | Chính `meocare-backend` chạy ffmpeg | Giai đoạn đầu — tiết kiệm điện, UPS trụ lâu. Không cần máy camera riêng. |
| **2 MÁY** (edge)    | `edge-agent` trên máy camera riêng | Khi mở rộng / nhiều chi nhánh ở xa. |

Cơ chế edge **luôn nằm sẵn** trong `edge-agent/` — chuyển chế độ chỉ là deploy nó hay không.

---

## 🟢 Chế độ 1 MÁY (bây giờ)

Ghi hình chạy ngay trong backend. **Thêm** `docker-compose.recorder.yml` vào lệnh up:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \        # <-- file prod của bạn (gitignored)
  -f docker-compose.recorder.yml \    # <-- overlay BẬT ghi tập trung
  up -d --build
```

Overlay này chỉ làm 2 việc với `backend`:
1. Đặt `ENABLE_CENTRAL_RECORDER=true` → `server.js` khởi động recorder ([backend/server.js:227](backend/server.js:227)).
2. Bind-mount HDD `/mnt/hdd1`, `/mnt/hdd2` vào container để backend ghi được.

### Việc cần làm 1 lần để ghi chạy được
1. **Mount HDD trên máy host** ở đúng path khai trong overlay (mặc định `/mnt/hdd1`, `/mnt/hdd2`).
   Sửa cả 2 vế trong [docker-compose.recorder.yml](docker-compose.recorder.yml) nếu ổ của bạn ở chỗ khác.
2. **Trong app Admin (NAS) / NasConfig của chi nhánh:**
   - `disks[].mount_path` = **đúng path bên phải** của bind-mount (vd `/mnt/hdd1`).
   - Mỗi camera gán `disk_id` + bật `recording=true`, có `rtsp_url`.
3. Backend khôi phục mọi camera `recording=true` khi khởi động; bật/tắt từng cam trong app như cũ.

> Ghi ra: `<mount_path>/<tên camera>/<ngày>/HH-MM-SS.mp4`, mỗi đoạn 15 phút (segment mặc định).
> Live view web vẫn qua go2rtc trung tâm (đã có sẵn, không liên quan tới ghi).

---

## 🔵 Khi tách sang 2 MÁY (mở rộng sau)

**Chỉ đảo 1 công tắc + dựng edge-agent — KHÔNG sửa code.**

1. **Máy server:** bỏ dòng `-f docker-compose.recorder.yml` khi `up` rồi deploy lại.
   → `ENABLE_CENTRAL_RECORDER` mất hiệu lực, backend ngừng ghi, nhường cho edge.
   (Có thể tháo luôn bind-mount HDD khỏi máy server vì không còn ghi ở đó.)

2. **Máy camera:** đem thư mục `edge-agent/` sang, rồi:
   - Mount HDD trên máy camera (path khớp `NasConfig.disks[].mount_path` của chi nhánh đó).
   - Tạo `edge-agent/.env` từ `.env.example`:
     - `CENTRAL_URL` = URL/IP-LAN của máy server (vd `http://192.168.1.10:3001`).
     - `AGENT_TOKEN` = token sinh từ app Admin (POST `/api/admin/nas/agent-token`), lưu vào `NasConfig.agent_token`.
   - `cd edge-agent && docker compose up -d --build`.

3. **Kiểm tra:** app Admin → NAS thấy badge **online** (agent heartbeat ~15s). Bật/tắt ghi từ app,
   agent reconcile theo desired-state. Mất mạng vẫn ghi theo config gần nhất.

> Hai chiều đối xứng: 1 máy = thêm overlay; 2 máy = bỏ overlay + dựng edge-agent.
> Quyết định "ai ghi" gói gọn trong **một** biến `ENABLE_CENTRAL_RECORDER`.

---

## ⚠️ Lưu ý
- **Đừng bật cả hai cùng lúc** cho cùng một camera: nếu máy server còn `ENABLE_CENTRAL_RECORDER=true`
  *và* edge-agent cũng đang ghi cam đó → 2 tiến trình ffmpeg ghi trùng. Khi chuyển 2 máy, nhớ bỏ overlay ở server.
- Overlay là **additive**: nếu file prod compose của bạn đã bind-mount sẵn `/mnt`, mount lại cùng path là vô hại.
- Vì sao không dùng `docker-compose.override.yml`: khi chạy prod bằng nhiều `-f` tường minh, Docker **không**
  tự nạp `override.yml` → dễ tưởng đã bật mà thực ra bị bỏ qua. Overlay tường minh `-f ...recorder.yml` thì rõ ràng.
