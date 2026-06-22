const express   = require("express");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { JWT_SECRET, verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");
const {
  issueTokens, publicUser, readRefreshRaw, findValidRefresh,
  revokeRefresh, revokeAllForUser, clearRefreshCookie, REFRESH_COOKIE,
} = require("../lib/authTokens");

const router = express.Router();

// Chống brute-force theo tài khoản (bổ sung cho rate-limit theo IP)
const LOCK_THRESHOLD = 5;       // số lần sai liên tiếp
const LOCK_MINUTES   = 15;      // thời gian khoá

// ── Rate limiters áp dụng riêng từng endpoint ────────────────────────────────
// Chỉ login & register mới cần bảo vệ brute-force.
// /verify KHÔNG rate-limit vì client gọi nhiều lần khi navigate.

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,                   // 10 lần thử / 15 phút / IP — đủ chống brute-force
  message: { error: "Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Chỉ đếm lần THẤT BẠI, không đếm login thành công
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5,                    // 5 tài khoản / giờ / IP
  message: { error: "Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau." },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5,                    // 5 lần / 15 phút / IP — chống dò email
  message: { error: "Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ================== REGISTER ==================
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { fullName, username, email, phone, password } = req.body;

    // Validate bắt buộc
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({
        error: "Vui lòng nhập đầy đủ: họ tên, tên đăng nhập, email và mật khẩu.",
      });
    }

    // Validate độ dài mật khẩu
    if (password.length < 6) {
      return res.status(400).json({
        error: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
    }

    // Validate định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email không hợp lệ." });
    }

    // Kiểm tra username đã tồn tại chưa
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return res.status(409).json({ error: "Tên đăng nhập đã được sử dụng." });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return res.status(409).json({ error: "Email đã được sử dụng." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới — role mặc định là "customer"
    const newUser = await prisma.user.create({
      data: {
        fullName,
        username,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: "customer",
      },
    });

    // Cấp access (ngắn) + refresh (cookie httpOnly cho web / body cho mobile)
    const { accessToken, refreshToken } = await issueTokens(res, newUser, req);

    res.status(201).json({
      message: "Đăng ký thành công!",
      token: accessToken,      // tên cũ giữ tương thích client
      accessToken,
      refreshToken,            // mobile lưu secure storage; web bỏ qua (đã có cookie)
      user: publicUser(newUser),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== LOGIN ==================
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password, remember = true } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    }

    const identifier = username.trim();
    const isPhone = /^0[3-9]\d{8}$/.test(identifier);

    let user;
    if (isPhone) {
      user = await prisma.user.findFirst({
        where: { phone: identifier },
      });
    } else {
      user = await prisma.user.findUnique({
        where: { username: identifier },
      });
    }

    if (!user) {
      return res.status(401).json({
        error: isPhone
          ? "Không tìm thấy tài khoản với số điện thoại này."
          : "Tài khoản không tồn tại.",
      });
    }

    // Đang bị khoá do nhập sai nhiều lần?
    if (user.locked_until && user.locked_until > new Date()) {
      const mins = Math.ceil((user.locked_until - new Date()) / 60000);
      return res.status(429).json({
        error: `Tài khoản tạm khoá do nhập sai nhiều lần. Vui lòng thử lại sau ${mins} phút.`,
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      // Tăng số lần sai, tới ngưỡng thì khoá tạm
      const attempts = (user.failed_attempts || 0) + 1;
      const data =
        attempts >= LOCK_THRESHOLD
          ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000) }
          : { failed_attempts: attempts };
      await prisma.user.update({ where: { id: user.id }, data }).catch(() => {});
      return res.status(401).json({
        error:
          attempts >= LOCK_THRESHOLD
            ? `Sai mật khẩu. Tài khoản tạm khoá ${LOCK_MINUTES} phút do nhập sai nhiều lần.`
            : "Sai mật khẩu.",
      });
    }

    // Đăng nhập đúng → reset bộ đếm sai + ghi last_login (không chặn luồng nếu lỗi)
    prisma.user
      .update({
        where: { id: user.id },
        data: { last_login: new Date(), failed_attempts: 0, locked_until: null },
      })
      .catch((e) => console.error("Cập nhật last_login lỗi:", e));

    // Cấp access (ngắn hạn) + refresh (cookie httpOnly web / body mobile)
    // remember=false → cookie phiên (đăng xuất khi đóng trình duyệt); mặc định true.
    const { accessToken, refreshToken } = await issueTokens(res, user, req, !!remember);

    res.json({
      token: accessToken,      // tên cũ giữ tương thích client
      accessToken,
      refreshToken,            // mobile lưu secure storage; web bỏ qua (dùng cookie)
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== FORGOT PASSWORD (tự phục vụ qua xác minh email) ==================
// Không dùng email server: xác minh danh tính bằng (username|phone) + email khớp hồ sơ,
// rồi cho đặt mật khẩu mới ngay. Trả lỗi chung để tránh dò tài khoản.
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const { identifier, email, newPassword } = req.body;

    if (!identifier || !email || !newPassword) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const id = identifier.trim();
    const isPhone = /^0[3-9]\d{8}$/.test(id);

    const user = isPhone
      ? await prisma.user.findFirst({ where: { phone: id } })
      : await prisma.user.findUnique({ where: { username: id } });

    // Lỗi chung — không tiết lộ tài khoản/email nào tồn tại
    const genericErr =
      "Thông tin không khớp. Vui lòng kiểm tra lại tên đăng nhập/số điện thoại và email đã đăng ký.";

    if (!user) {
      return res.status(400).json({ error: genericErr });
    }

    const onFileEmail = (user.email || "").trim().toLowerCase();
    const givenEmail  = email.trim().toLowerCase();
    // Chặn trường hợp email mặc định chưa cập nhật
    if (!onFileEmail || onFileEmail === "chua_cap_nhat@email.com" || onFileEmail !== givenEmail) {
      return res.status(400).json({ error: genericErr });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, failed_attempts: 0, locked_until: null },
    });

    // Đổi mật khẩu → thu hồi mọi phiên đang mở (đăng xuất mọi thiết bị)
    await revokeAllForUser(user.id).catch(() => {});

    res.json({ success: true, message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay." });
  } catch (err) {
    console.error("Forgot-password error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== VERIFY TOKEN ==================
router.post("/verify", (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ valid: false });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      valid: true,
      user: decoded,
    });
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});

// ================== REFRESH (xoay vòng refresh token → cấp access mới) ==================
// Web: refresh đọc từ cookie httpOnly (SameSite=Strict chống CSRF). Mobile: gửi trong body.
router.post("/refresh", async (req, res) => {
  try {
    // Thử CẢ cookie LẪN rt dự phòng (body). Cookie có thể đã bị xoay vòng/đã revoke
    // (vd Set-Cookie bị chặn do secure/cross-site, hoặc lệch cookie↔localStorage) trong
    // khi rt ở localStorage vẫn còn hợp lệ → đừng để cookie cũ chặn mất phiên còn sống.
    const cookieRaw = req.cookies?.[REFRESH_COOKIE] || null;
    const bodyRaw   = req.body?.refreshToken || null;

    const cookieRow = cookieRaw ? await findValidRefresh(cookieRaw) : null;
    const bodyRow   = (bodyRaw && bodyRaw !== cookieRaw) ? await findValidRefresh(bodyRaw) : null;

    // Chốt an toàn: nếu cookie và rt (localStorage) trỏ HAI user KHÁC NHAU → phiên nhập nhằng
    // (vd cookie admin cũ chưa bị ghi đè khi đăng nhập tài khoản khác). Revoke cả hai + buộc
    // đăng nhập lại, tránh vô tình khôi phục nhầm tài khoản.
    if (cookieRow && bodyRow && cookieRow.user_id !== bodyRow.user_id) {
      await prisma.refreshToken.updateMany({
        where: { id: { in: [cookieRow.id, bodyRow.id] } },
        data: { revoked: true },
      });
      clearRefreshCookie(res);
      return res.status(409).json({ error: "Phiên đăng nhập không nhất quán, vui lòng đăng nhập lại." });
    }

    const row = cookieRow || bodyRow;
    if (!row) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Phiên đã hết hạn, vui lòng đăng nhập lại." });
    }

    const user = await prisma.user.findUnique({ where: { id: row.user_id } });
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Phiên không hợp lệ." });
    }

    // Xoay vòng: revoke cái cũ rồi cấp cặp mới — GIỮ NGUYÊN lựa chọn "ghi nhớ" ban đầu
    // (nếu không, sau 30' access hết hạn → refresh sẽ vô tình nâng phiên tạm thành 90 ngày).
    await prisma.refreshToken.update({ where: { id: row.id }, data: { revoked: true } });
    const { accessToken, refreshToken } = await issueTokens(res, user, req, row.persistent);

    res.json({ token: accessToken, accessToken, refreshToken, user: publicUser(user) });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== LOGOUT (thu hồi refresh hiện tại) ==================
router.post("/logout", async (req, res) => {
  try {
    await revokeRefresh(readRefreshRaw(req));
  } catch (err) {
    console.error("Logout error:", err);
  }
  clearRefreshCookie(res);
  res.json({ success: true });
});

// ================== LOGOUT ALL (thu hồi mọi phiên của user) ==================
router.post("/logout-all", verifyToken, async (req, res) => {
  try {
    await revokeAllForUser(req.user.id);
  } catch (err) {
    console.error("Logout-all error:", err);
  }
  clearRefreshCookie(res);
  res.json({ success: true });
});

module.exports = router;