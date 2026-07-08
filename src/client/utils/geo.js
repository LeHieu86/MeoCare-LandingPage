/**
 * geo.js — Helper định vị dùng chung cho các trang công khai.
 * Tách ra từ logic "chi nhánh gần nhất" để trang showcase mèo tái dùng (Haversine + geocode Nominatim + cache).
 */

/* Khoảng cách Haversine (km) giữa 2 toạ độ */
export const haversineKm = (aLat, aLng, bLat, bLng) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export const fmtDistance = (km) =>
  km < 1 ? `~${Math.round(km * 1000)} m` : `~${km.toFixed(1)} km`;

/* Geocode địa chỉ (Nominatim) + cache localStorage. Trả { coord:{lat,lng}|null, fromCache }.
   Cache cả trường hợp không tìm thấy để khỏi gọi lại (tôn trọng giới hạn 1 req/giây). */
export const geocodeAddress = async (address) => {
  const q = (address || "").trim();
  if (!q) return { coord: null, fromCache: true };
  const key = `mc_geo:${q.toLowerCase()}`;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const v = JSON.parse(cached);
      return { coord: v && v.lat != null ? v : null, fromCache: true };
    }
  } catch { /* localStorage không khả dụng */ }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=vi&q=${encodeURIComponent(q)}`
    );
    const arr = await res.json();
    const hit = Array.isArray(arr) && arr.length ? arr[0] : null;
    const coord = hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) } : null;
    try { localStorage.setItem(key, JSON.stringify(coord || { none: true })); } catch { /* bỏ qua */ }
    return { coord, fromCache: false };
  } catch {
    return { coord: null, fromCache: false };
  }
};

/* Tính map { storeId: km } cho danh sách chi nhánh so với vị trí khách.
   Gọi tuần tự, chỉ chờ 1.1s khi vừa gọi mạng (cache thì không chờ). onUpdate(map) gọi dần. */
export const computeBranchDistances = async (userCoords, stores, onUpdate, isAlive = () => true) => {
  const out = {};
  for (const store of stores) {
    if (!isAlive()) return out;
    let coord = null;
    let fromCache = true;
    if (store.latitude != null && store.longitude != null) {
      coord = { lat: store.latitude, lng: store.longitude };
    } else if (store.address) {
      ({ coord, fromCache } = await geocodeAddress(store.address));
    }
    if (!isAlive()) return out;
    if (coord) {
      out[store.id] = haversineKm(userCoords.lat, userCoords.lng, coord.lat, coord.lng);
      onUpdate?.({ ...out });
    }
    if (!fromCache) await new Promise((r) => setTimeout(r, 1100));
  }
  return out;
};

/* Tuổi mèo từ birth_date → chuỗi tiếng Việt ("1 tuổi 3 tháng", "5 tháng", "3 tuần") */
export const catAge = (birth) => {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  const days = Math.floor((now - b) / 86400000);
  if (days < 0) return null;
  if (days < 30) return `${Math.max(days, 1)} ngày`;
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) months = 0;
  if (months < 12) return `${months} tháng`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} tuổi ${m} tháng` : `${y} tuổi`;
};
