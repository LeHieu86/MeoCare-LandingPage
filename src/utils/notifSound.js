/**
 * notifSound.js
 * Tạo âm thanh thông báo bằng Web Audio API — không cần file audio.
 * Trình duyệt yêu cầu user đã tương tác với trang trước khi phát âm thanh
 * (Autoplay Policy). AudioContext sẽ tự resume sau lần click đầu tiên.
 */

let _ctx = null;

function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _ctx;
}

/**
 * Phát 1 nốt đơn
 * @param {object} opts
 * @param {number} opts.freq    - Tần số Hz (cao = nốt cao)
 * @param {number} opts.dur     - Độ dài giây
 * @param {string} opts.type    - oscillator type: "sine" | "triangle" | "square"
 * @param {number} opts.vol     - Âm lượng 0–1
 * @param {number} opts.delay   - Delay trước khi phát (giây)
 */
async function tone({ freq = 880, dur = 0.3, type = "sine", vol = 0.4, delay = 0 } = {}) {
  try {
    const ac = getCtx();
    // Trình duyệt có thể suspend AudioContext cho đến khi user tương tác
    if (ac.state === "suspended") await ac.resume();

    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);

    // Fade out mượt để tránh tiếng "bụp" cuối
    gain.gain.setValueAtTime(vol, ac.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur);

    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + dur + 0.05);
  } catch {
    // Audio bị block hoặc trình duyệt không hỗ trợ — silent fail
  }
}

/**
 * 🛒 Đơn hàng mới — 2 nốt lên nhanh (ding-dong)
 */
export function playOrderSound() {
  tone({ freq: 659, dur: 0.16, vol: 0.42 });           // Mi5
  tone({ freq: 880, dur: 0.28, vol: 0.42, delay: 0.16 }); // La5
}

/**
 * 📅 Booking mới — 3 nốt lên như nhạc chuông chào
 */
export function playBookingSound() {
  tone({ freq: 523, dur: 0.13, vol: 0.38 });              // Do5
  tone({ freq: 659, dur: 0.13, vol: 0.38, delay: 0.13 }); // Mi5
  tone({ freq: 784, dur: 0.24, vol: 0.38, delay: 0.26 }); // Sol5
}

/**
 * 💬 Tin nhắn mới — 1 nốt nhẹ, cao, ngắn
 */
export function playChatSound() {
  tone({ freq: 1047, dur: 0.20, type: "sine", vol: 0.28 }); // Do6
}
