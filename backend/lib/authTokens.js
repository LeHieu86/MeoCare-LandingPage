/**
 * authTokens.js — Tiện ích access/refresh token.
 *
 * - Access token: JWT ngắn hạn (ACCESS_TOKEN_TTL), gửi qua header Authorization.
 * - Refresh token: chuỗi ngẫu nhiên, lưu DƯỚI DẠNG HASH (sha256) trong bảng refresh_tokens.
 *   Web: đặt trong cookie httpOnly. Mobile: trả trong body, lưu secure storage.
 *   Mỗi lần /auth/refresh sẽ XOAY VÒNG (revoke cũ, cấp mới).
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");
const prisma = require("./prisma");

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "30m";
const REFRESH_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "90", 10);
const REFRESH_COOKIE = "mc_rt";
const COOKIE_PATH = "/api/auth"; // cookie chỉ gửi tới các endpoint auth

const hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, store_id: user.store_id ?? null },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

/** Hồ sơ user công khai trả cho client (không gồm password). */
function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    store_id: user.store_id ?? null,
    avatar: user.avatar ?? null,
  };
}

async function createRefreshToken(userId, req, persistent = true) {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000);
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: hashToken(raw),
      expires_at: expiresAt,
      persistent,
      user_agent: (req.headers["user-agent"] || "").slice(0, 255) || null,
      ip: req.ip || null,
    },
  });
  return { raw, expiresAt };
}

// persistent=true → cookie hết hạn theo expiresAt (90 ngày, "ghi nhớ").
// persistent=false → cookie PHIÊN (không set expires) → trình duyệt xóa khi đóng.
function setRefreshCookie(res, raw, expiresAt, persistent = true) {
  res.cookie(REFRESH_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: vẫn chống CSRF (cookie KHÔNG gửi khi POST cross-site) nhưng "dễ thở" hơn Strict
    // → tránh trường hợp khách vào lại từ link ngoài bị mất phiên.
    sameSite: "lax",
    path: COOKIE_PATH,
    ...(persistent ? { expires: expiresAt } : {}),
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

/** Cấp access + refresh; set cookie cho web; trả {accessToken, refreshToken} (refreshToken cho mobile).
 *  persistent: true = "ghi nhớ đăng nhập" (mặc định), false = chỉ giữ phiên trình duyệt. */
async function issueTokens(res, user, req, persistent = true) {
  const accessToken = signAccessToken(user);
  const { raw, expiresAt } = await createRefreshToken(user.id, req, persistent);
  setRefreshCookie(res, raw, expiresAt, persistent);
  return { accessToken, refreshToken: raw };
}

/** Lấy refresh thô từ cookie (web) hoặc body (mobile). */
function readRefreshRaw(req) {
  return req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken || null;
}

/** Tìm bản ghi refresh CÒN HIỆU LỰC (chưa revoke, chưa hết hạn). */
async function findValidRefresh(raw) {
  if (!raw) return null;
  const row = await prisma.refreshToken.findUnique({ where: { token_hash: hashToken(raw) } });
  if (!row || row.revoked || row.expires_at < new Date()) return null;
  return row;
}

async function revokeRefresh(raw) {
  if (!raw) return;
  await prisma.refreshToken.updateMany({
    where: { token_hash: hashToken(raw) },
    data: { revoked: true },
  });
}

async function revokeAllForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked: false },
    data: { revoked: true },
  });
}

/** Thu hồi mọi phiên TRỪ phiên hiện tại (giữ thiết bị đang thao tác đăng nhập). */
async function revokeOthersForUser(userId, keepRaw) {
  const keep = keepRaw
    ? await prisma.refreshToken.findUnique({ where: { token_hash: hashToken(keepRaw) } })
    : null;
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked: false, ...(keep ? { id: { not: keep.id } } : {}) },
    data: { revoked: true },
  });
}

module.exports = {
  REFRESH_COOKIE, ACCESS_TTL, REFRESH_TTL_DAYS,
  signAccessToken, publicUser, issueTokens,
  readRefreshRaw, findValidRefresh, revokeRefresh, revokeAllForUser, revokeOthersForUser,
  setRefreshCookie, clearRefreshCookie,
};
