import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import "../../styles/client/customer-display.css";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const GREETS = [
  "Meo~ chào sen, hôm nay mua gì cho boss mèo nào?",
  "Boss mèo đang đói, chọn pate ngon đi sen ơi~",
  "Mua đủ rồi thì gọi em hiện mã thanh toán nha!",
  "MeoCare luôn iu thương boss mèo nhà mình 🐾",
];
const TALKS = [
  "Quét mã trả tiền nha, cảm ơn sen~",
  "Tiền về là em báo liền á!",
  "Cảm ơn sen iu boss mèo~ 💕",
];

// Bỏ emoji / ký tự kéo dài để máy đọc không phát âm "mặt mèo", "dấu ngã"…
const clean = (s) => (s || "").replace(/[^\p{L}\p{N}\s,.!?;:%đ]/gu, "").replace(/\s+/g, " ").trim();

// Bot mèo dễ thương (SVG) — nhún nhảy + chớp mắt + vẫy đuôi qua CSS.
function CatBot({ small }) {
  const w = small ? 110 : 150;
  const h = small ? 119 : 162;
  return (
    <svg width={w} height={h} viewBox="0 0 140 152" aria-hidden="true">
      <line x1="70" y1="14" x2="70" y2="34" stroke="#D4537E" strokeWidth="3" />
      <g className="cd-heart"><path d="M70 4 C66 0 60 3 62 8 C63 11 70 15 70 15 C70 15 77 11 78 8 C80 3 74 0 70 4 Z" fill="#D4537E" /></g>
      <g className="cd-tail"><path d="M112 118 q22 -2 16 -24" fill="none" stroke="#F4A6C0" strokeWidth="9" strokeLinecap="round" /></g>
      <ellipse cx="70" cy="118" rx="40" ry="26" fill="#FAD0DE" />
      <path d="M40 60 L34 36 L58 50 Z" fill="#F4A6C0" /><path d="M100 60 L106 36 L82 50 Z" fill="#F4A6C0" />
      <path d="M43 56 L39 42 L53 50 Z" fill="#FBEAF0" /><path d="M97 56 L101 42 L87 50 Z" fill="#FBEAF0" />
      <circle cx="70" cy="74" r="40" fill="#FAD0DE" />
      <circle cx="50" cy="84" r="7" fill="#F4A6C0" opacity=".8" /><circle cx="90" cy="84" r="7" fill="#F4A6C0" opacity=".8" />
      <g className="cd-eye"><ellipse cx="57" cy="72" rx="6.5" ry="8.5" fill="#4B1528" /><circle cx="59" cy="69" r="2.2" fill="#fff" /></g>
      <g className="cd-eye"><ellipse cx="83" cy="72" rx="6.5" ry="8.5" fill="#4B1528" /><circle cx="85" cy="69" r="2.2" fill="#fff" /></g>
      <path d="M67 80 Q70 84 73 80 Z" fill="#D4537E" />
      <path d="M70 83 Q66 88 61 86 M70 83 Q74 88 79 86" fill="none" stroke="#993556" strokeWidth="1.6" strokeLinecap="round" />
      <g stroke="#E59BB6" strokeWidth="1.4" strokeLinecap="round">
        <line x1="30" y1="74" x2="46" y2="76" /><line x1="30" y1="82" x2="46" y2="82" />
        <line x1="110" y1="74" x2="94" y2="76" /><line x1="110" y1="82" x2="94" y2="82" />
      </g>
    </svg>
  );
}

// Sóng âm nhỏ — hiện khi mèo đang nói.
function SoundWave({ on }) {
  return (
    <span className={`cd-wave ${on ? "is-on" : ""}`} aria-hidden="true">
      <i /><i /><i /><i /><i />
    </span>
  );
}

export default function CustomerDisplay() {
  const [mode, setMode] = useState("idle"); // idle | qr
  const [order, setOrder] = useState(null);
  const [greetIdx, setGreetIdx] = useState(0);
  const [talkIdx, setTalkIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);
  const voiceRef = useRef(null);

  const phrase = mode === "idle" ? GREETS[greetIdx] : TALKS[talkIdx];

  const ding = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.12;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.32);
    });
  }, []);

  // Đọc một câu bằng giọng tiếng Việt (cắt câu đang đọc dở để khớp bong bóng).
  const say = useCallback((text) => {
    const synth = window.speechSynthesis;
    const content = clean(text);
    if (!synth || !content) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(content);
      u.lang = "vi-VN";
      u.rate = 1.0;
      u.pitch = 1.3; // cao hơn chút cho giọng "mèo" dễ thương
      u.volume = 1;
      if (voiceRef.current) u.voice = voiceRef.current;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    } catch { /* trình duyệt không hỗ trợ → bỏ qua, vẫn hiện chữ */ }
  }, []);

  // Chọn giọng tiếng Việt (danh sách giọng nạp bất đồng bộ).
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const pick = () => {
      const vs = synth.getVoices();
      voiceRef.current =
        vs.find((v) => /vi[-_]?vn/i.test(v.lang)) ||
        vs.find((v) => /^vi/i.test(v.lang)) ||
        voiceRef.current;
    };
    pick();
    synth.addEventListener?.("voiceschanged", pick);
    return () => synth.removeEventListener?.("voiceschanged", pick);
  }, []);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    const server = apiUrl.replace(/\/api$/, "");
    const storeId = parseInt(new URLSearchParams(window.location.search).get("store")) || 1;
    const socket = io(server, { withCredentials: true });
    socket.on("connect", () => socket.emit("joinDisplayRoom", { storeId }));
    socket.on("display:qr", (data) => { setOrder(data); setMode("qr"); ding(); });
    socket.on("display:clear", () => { setMode("idle"); setOrder(null); });
    return () => socket.disconnect();
  }, [ding]);

  useEffect(() => {
    const t = setInterval(() => {
      setGreetIdx((i) => (i + 1) % GREETS.length);
      setTalkIdx((i) => (i + 1) % TALKS.length);
    }, 5200); // đủ dài để đọc xong câu trước khi đổi
    return () => clearInterval(t);
  }, []);

  // Câu thoại đổi → đọc lại (khi đã bật âm thanh).
  useEffect(() => {
    if (soundOn) say(phrase);
  }, [phrase, soundOn, say]);

  // QR vừa hiện → đọc tổng tiền (đặt sau effect trên để "thắng" và đọc số tiền).
  useEffect(() => {
    if (soundOn && mode === "qr" && order?.amount) {
      say(`Tổng cộng ${order.amount.toLocaleString("vi-VN")} đồng. Sen quét mã chuyển khoản giúp em nha!`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  // Dừng đọc khi rời trang.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // Trình duyệt chặn auto-play tới khi có cú chạm đầu tiên → mở khóa âm thanh + giọng.
  const enableSound = () => {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    window.speechSynthesis?.resume(); // mở khóa engine đọc trong ngữ cảnh chạm
    if (!soundOn) setSoundOn(true);
  };

  return (
    <div className={`cd-screen ${speaking ? "is-speaking" : ""}`} onClick={enableSound}>
      <span className="cd-paws" aria-hidden="true" />

      <div className="cd-top">
        <span className="cd-brand">🐱 MeoCare</span>
        {soundOn ? (
          <span className="cd-status"><SoundWave on={speaking} /> {speaking ? "Đang nói…" : "Âm thanh bật"}</span>
        ) : (
          <button className="cd-sound" onClick={enableSound}>🔊 Bật âm thanh & giọng nói</button>
        )}
      </div>

      {mode === "idle" ? (
        <div className="cd-idle">
          <div className="cd-bubble">
            <span key={greetIdx} className="cd-phrase">{GREETS[greetIdx]}</span>
          </div>
          <div className="cd-tailpoint" />
          <div className="cd-bob"><CatBot /></div>
        </div>
      ) : (
        <div className="cd-qrwrap">
          <div className="cd-qr-cat">
            <div className="cd-bob"><CatBot small /></div>
            <div className="cd-bubble cd-bubble-sm">
              <span key={talkIdx} className="cd-phrase">{TALKS[talkIdx]}</span>
            </div>
          </div>
          <div className="cd-qr-card">
            <div className="cd-qr-label">Quét để chuyển khoản</div>
            <div className="cd-qr-frame">
              {order?.qrUrl
                ? <img src={order.qrUrl} alt="QR chuyển khoản" className="cd-qr-img" />
                : <div className="cd-qr-img cd-qr-missing">Chưa cấu hình ngân hàng (.env)</div>}
              <span className="cd-corner tl" /><span className="cd-corner tr" />
              <span className="cd-corner bl" /><span className="cd-corner br" />
            </div>
            <div className="cd-amount">{fmt(order?.amount)}</div>
            <div className="cd-items">
              {(order?.items || []).map((it, i) => (
                <div key={i}>{it.name}{it.qty ? ` · x${it.qty}` : ""}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
