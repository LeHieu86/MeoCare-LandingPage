const express = require("express");
const https   = require("https");
const http    = require("http");
const router  = express.Router();

// ── Config — đọc từ process.env (đã load bởi dotenv trong server.js) ──────────
const getConfig = () => ({
  token:       process.env.GHN_TOKEN || "",
  shopId:      process.env.GHN_SHOP_ID || "",
  fromDistrict: parseInt(process.env.GHN_FROM_DISTRICT_ID || "1452"),
  base: process.env.GHN_ENV === "prod"
    ? "https://online-gateway.ghn.vn/shiip/public-api"
    : "https://dev-online-gateway.ghn.vn/shiip/public-api",
});

// ── HTTP helper (thay thế fetch, chạy mọi Node version) ──────────────────────
const request = (url, { method = "GET", headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === "https:" ? https : http;
    const data   = body ? JSON.stringify(body) : null;

    const req = lib.request(parsed, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ error: "Invalid JSON", raw }); }
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });

// ── GHN wrappers ──────────────────────────────────────────────────────────────
const ghnGet = (path) => {
  const { token, base } = getConfig();
  return request(`${base}${path}`, {
    headers: { Token: token },
  });
};

const ghnPost = (path, body) => {
  const { token, shopId, base } = getConfig();
  return request(`${base}${path}`, {
    method: "POST",
    headers: { Token: token, ShopId: String(shopId) },
    body,
  });
};

// ── Subsidy logic ─────────────────────────────────────────────────────────────
const getSubsidy = (orderTotal) => {
  if (orderTotal >= 350000) return 30000;
  if (orderTotal >= 250000) return 20000;
  if (orderTotal >= 150000) return 10000;
  return 0;
};

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/shipping/provinces
router.get("/provinces", async (_req, res) => {
  try {
    const data = await ghnGet("/master-data/province");
    if (!data.data) return res.status(400).json({ error: data.message || "Lỗi GHN" });
    const list = data.data.map((p) => ({
      ProvinceID:   p.ProvinceID,
      ProvinceName: p.ProvinceName,
    }));
    res.json({ data: list });
  } catch (err) {
    res.status(500).json({ error: "Không thể lấy danh sách tỉnh/thành.", detail: err.message });
  }
});

// GET /api/shipping/districts/:provinceId
router.get("/districts/:provinceId", async (req, res) => {
  try {
    const data = await ghnGet(`/master-data/district?province_id=${req.params.provinceId}`);
    if (!data.data) return res.status(400).json({ error: data.message || "Lỗi GHN" });
    const list = data.data.map((d) => ({
      DistrictID:   d.DistrictID,
      DistrictName: d.DistrictName,
    }));
    res.json({ data: list });
  } catch (err) {
    res.status(500).json({ error: "Không thể lấy danh sách quận/huyện.", detail: err.message });
  }
});

// GET /api/shipping/wards/:districtId
router.get("/wards/:districtId", async (req, res) => {
  try {
    const data = await ghnGet(`/master-data/ward?district_id=${req.params.districtId}`);
    if (!data.data) return res.status(400).json({ error: data.message || "Lỗi GHN" });
    const list = data.data.map((w) => ({
      WardCode: w.WardCode,
      WardName: w.WardName,
    }));
    res.json({ data: list });
  } catch (err) {
    res.status(500).json({ error: "Không thể lấy danh sách phường/xã.", detail: err.message });
  }
});

// POST /api/shipping/fee
router.post("/fee", async (req, res) => {
  try {
    const { token, shopId, fromDistrict } = getConfig();
    const { to_district_id, to_ward_code, weight, order_total } = req.body;

    if (!token || !shopId) {
      return res.status(503).json({ error: "GHN chưa được cấu hình." });
    }

    const data = await ghnPost("/v2/shipping-order/fee", {
      service_type_id:  2,
      from_district_id: fromDistrict,
      to_district_id:   parseInt(to_district_id),
      to_ward_code:     String(to_ward_code),
      weight:           weight || 500,
      length: 25, width: 20, height: 15,
      insurance_value:  0,
      coupon:           null,
    });

    if (data.code !== 200) {
      return res.status(400).json({ error: data.message || "Không tính được phí ship." });
    }

    const shipFee  = data.data.total;
    const subsidy  = getSubsidy(order_total || 0);
    const finalFee = Math.max(0, shipFee - subsidy);

    res.json({ ship_fee: shipFee, subsidy, final_fee: finalFee });
  } catch (err) {
    res.status(500).json({ error: "Lỗi kết nối GHN.", detail: err.message });
  }
});

module.exports = router;
module.exports.getSubsidy = getSubsidy;