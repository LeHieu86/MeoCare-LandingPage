import { useEffect, useRef, useState } from "react";

const GO2RTC_URL = import.meta.env.VITE_GO2RTC_URL || "http://localhost:1984";

// Load video-stream.js (ES module, tự register <video-stream>) — chỉ 1 lần
let scriptPromise = null;
const loadVideoStream = () => {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (customElements.get("video-stream")) return resolve();
    const s = document.createElement("script");
    s.type = "module";
    s.src = `${GO2RTC_URL}/video-stream.js`;
    s.onerror = () => reject(new Error("Không tải được video-stream.js từ go2rtc"));
    document.head.appendChild(s);
    // Module script không fire onload đáng tin cậy cross-origin — poll customElements
    const start = Date.now();
    const poll = setInterval(() => {
      if (customElements.get("video-stream")) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - start > 10000) {
        clearInterval(poll);
        reject(new Error("Timeout: <video-stream> không được register"));
      }
    }, 100);
  });
  return scriptPromise;
};

/**
 * Nhúng stream camera trực tiếp qua WebRTC/MSE — không dùng iframe.
 * Tự động fallback theo thứ tự: WebRTC → MSE → MJPEG.
 *
 * Props:
 *  - cameraId: id camera (sẽ map sang `cam_${id}` trong go2rtc.yaml)
 *  - mode: "webrtc,mse,mjpeg" (mặc định)
 *  - className / style: forward cho wrapper
 */
export default function CameraPlayer({ cameraId, mode = "mse,mp4,mjpeg", className, style }) {
  const containerRef = useRef(null);
  const mountRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let el;
    let cancelled = false;

    loadVideoStream()
      .then(() => {
        if (cancelled || !mountRef.current) return;
        const wsProto = GO2RTC_URL.startsWith("https") ? "wss" : "ws";
        const wsBase  = GO2RTC_URL.replace(/^https?/, wsProto);

        el = document.createElement("video-stream");
        el.mode = mode;
        el.style.width  = "100%";
        el.style.height = "100%";
        mountRef.current.appendChild(el);
        el.src = `${wsBase}/api/ws?src=cam_${cameraId}`;
        setReady(true);
      })
      .catch((e) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, [cameraId, mode]);

  return (
    <div ref={containerRef} className={className}
      style={{ width: "100%", height: "100%", background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative", ...style }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      {!ready && !error && <span style={{ color: "#94a3b8", fontSize: 13, zIndex: 1 }}>Đang kết nối camera...</span>}
      {error && <span style={{ color: "#ef4444", fontSize: 13, zIndex: 1 }}>⚠ {error}</span>}
    </div>
  );
}
