// Nạp biến môi trường từ CẢ HAI file:
//   - backend/.env : DATABASE_URL, MONGO_URI, SEPAY_API_KEY, SEPAY_WEBHOOK_SECRET
//   - ../.env (root): các biến hạ tầng dùng chung (R2, GHN, BANK, ...)
// dotenv KHÔNG ghi đè biến đã tồn tại → biến do docker-compose (env_file) bơm vào
// vẫn được ưu tiên cao nhất. Hai file có khóa rời nhau nên thứ tự không xung đột.
const dotenv = require("dotenv");
const _path  = require("path");
dotenv.config({ path: _path.resolve(__dirname, ".env") });        // backend/.env
dotenv.config({ path: _path.resolve(__dirname, "../.env") });     // root .env

const express = require("express");
const cors    = require("cors");
const path    = require("path");

// Thêm kết nối MongoDB
const connectMongo = require("./lib/mongodb");

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes     = require("./routes/auth");
const productRoutes  = require("./routes/products");
const shippingRoutes = require("./routes/shipping");
const orderRoutes    = require("./routes/orders");
const signRouter     = require("./routes/sign");
const roomsRouter    = require("./routes/rooms");
const camerasRouter  = require("./routes/cameras");
const bookingsRouter = require("./routes/bookings");
const nasRouter      = require("./routes/nas");
const agentRouter    = require("./routes/agent");
const chatRouter = require("./routes/chat"); 
const cartRoutes    = require("./routes/cart");
const petsRoutes    = require("./routes/pets");
const reviewsRoutes = require("./routes/reviews");
const checkoutRoutes = require("./routes/checkout");
const serviceRoutes     = require("./routes/service");
const serviceTypesRoutes   = require("./routes/service-types");
const servicePackagesRoutes= require("./routes/service-packages");
const uploadImageRoutes = require("./routes/upload-image");
const paymentRoutes = require("./routes/payment");
const accountRoutes = require("./routes/account");
const purchaseOrderRoutes = require("./routes/purchase-orders");
const suppliersRoutes = require("./routes/suppliers");
const { router: inventoryRoutes } = require("./routes/inventory");
const sellProductComponentRoutes = require("./routes/sell-components");
const backupRoutes = require("./routes/backup");
// ── Owner / Multi-store ───────────────────────────────────────────────────────
const storesRoutes = require("./routes/stores");
// ── HR Module ─────────────────────────────────────────────────────────────────
const employeesRoutes       = require("./routes/employees");
const shiftsRoutes          = require("./routes/shifts");
const shiftAssignmentsRoutes= require("./routes/shift-assignments");
const attendanceRoutes      = require("./routes/attendance");
const leaveRoutes           = require("./routes/leave");
const salaryRoutes          = require("./routes/salary");
const departmentsRoutes     = require("./routes/departments");
const stockRequestsRoutes   = require("./routes/stockRequests");
const stockReturnsRoutes    = require("./routes/stock-returns");
const otRequestsRoutes      = require("./routes/ot-requests");
const employeeDocsRoutes    = require("./routes/employee-documents");
const adminUsersRoutes      = require("./routes/admin-users");
const adminCustomersRoutes  = require("./routes/admin-customers");
const storeExpensesRoutes   = require("./routes/store-expenses");
const investmentsRoutes     = require("./routes/investments");
const financeReportsRoutes  = require("./routes/finance-reports");
const cskhConfigRoutes      = require("./routes/cskh-config");
const cskhFaqRoutes         = require("./routes/cskh-faq");
const packagingOrdersRoutes = require("./routes/packaging-orders");
const catsRoutes            = require("./routes/cats");
const catSalesRoutes        = require("./routes/cat-sales");
const customerBenefitsRoutes = require("./routes/customer-benefits");
const businessStatsRoutes   = require("./routes/business-stats");
const trackRoutes           = require("./routes/track");

const helmet       = require("helmet");
const cookieParser = require("cookie-parser");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Trust proxy (nginx / Cloudflare tunnel) ───────────────────────────────────
// Cần thiết để express-rate-limit đọc đúng IP thật từ X-Forwarded-For header.
// Giá trị 1 = tin tưởng 1 lớp proxy (nginx container → backend).
// Nếu sau này thêm lớp proxy nữa thì tăng lên 2.
app.set("trust proxy", 1);

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
// Rate limiter cho auth được định nghĩa trong routes/auth.js (per-endpoint)
// /login  → 10 lần thất bại / 15 phút / IP (chống brute-force)
// /register → 5 lần / giờ / IP
// /verify → không giới hạn (client gọi nhiều lần khi navigate)

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://meomeocare.io.vn",
    "https://www.meomeocare.io.vn",
  ],
  credentials: true,
}));

app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Capture raw body for SePay HMAC-SHA256 webhook verification (must be before express.json)
app.use('/api/payment/webhook', express.raw({ type: '*/*' }), (req, _res, next) => {
  req.rawBody = req.body;
  try { req.body = JSON.parse(req.rawBody.toString()); } catch { req.body = {}; }
  next();
});

app.use(express.json());
app.use(cookieParser()); // đọc cookie refresh token (httpOnly) cho /api/auth/refresh|logout

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);   // rate limit đã áp dụng per-endpoint bên trong route
app.use("/api/products",  productRoutes);
app.use("/api/shipping",  shippingRoutes);
app.use("/api/orders",    orderRoutes);
app.use("/api/sign",      signRouter);
app.use("/api/rooms",     roomsRouter);
app.use("/api/cameras",   camerasRouter);
app.use("/api/bookings",  bookingsRouter);
app.use("/api/admin/nas", nasRouter);
app.use("/api/agent",     agentRouter);   // edge agent (auth bằng agent-token)
app.use("/api/chat", chatRouter);
app.use("/api/cart",    cartRoutes);
app.use("/api/pets",    petsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/service",        serviceRoutes);
app.use("/api/service-types",    serviceTypesRoutes);     // public GET + admin CRUD
app.use("/api/service-packages", servicePackagesRoutes);  // public GET + admin CRUD
app.use("/api/upload", uploadImageRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/purchase-orders",  purchaseOrderRoutes);
app.use("/api/stock-requests",   stockRequestsRoutes);
app.use("/api/stock-returns",    stockReturnsRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sell-components", sellProductComponentRoutes);
app.use("/api/admin/backup", backupRoutes);
app.use("/api/stores",       storesRoutes);
// ── HR Module ─────────────────────────────────────────────────────────────────
app.use("/api/employees",        employeesRoutes);
app.use("/api/shifts",           shiftsRoutes);
app.use("/api/shift-assignments",shiftAssignmentsRoutes);
app.use("/api/attendance",       attendanceRoutes);
app.use("/api/leave",            leaveRoutes);
app.use("/api/salary",           salaryRoutes);
app.use("/api/departments",      departmentsRoutes);
app.use("/api/ot-requests",      otRequestsRoutes);
app.use("/api/employee-documents", employeeDocsRoutes);
app.use("/api/admin/users",        adminUsersRoutes);
app.use("/api/admin/customers",    adminCustomersRoutes);
app.use("/api/admin/store-expenses", storeExpensesRoutes);
app.use("/api/admin/investments",    investmentsRoutes);
app.use("/api/admin/finance-reports", financeReportsRoutes);
app.use("/api/admin/cskh-config",     cskhConfigRoutes);
app.use("/api/admin/cskh-faq",        cskhFaqRoutes);
app.use("/api/packaging-orders",    packagingOrdersRoutes);
app.use("/api/cats",                catsRoutes);   // catalog bán mèo (public showcase + admin CRUD)
app.use("/api/cat-sales",           catSalesRoutes); // POS bán mèo + sổ doanh thu riêng
app.use("/api/customer-benefits",   customerBenefitsRoutes); // ví ưu đãi khách mua mèo
app.use("/api/business-stats",      businessStatsRoutes);    // tổng quan số liệu KD (Dashboard) + xuất Excel
app.use("/api/track",               trackRoutes);            // đếm lượt truy cập website khách (public beacon + admin stats)

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ── Serve React build ────────────────────────────────────────────────────────
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ── Global error handler (đặt SAU mọi route) ──────────────────────────────────
// Bắt lỗi throw/next(err) lọt khỏi try/catch của route → trả JSON gọn, KHÔNG lộ stack ở production.
app.use((err, req, res, next) => {
  console.error("[Route error]", req.method, req.originalUrl, "→", err?.message || err);
  if (res.headersSent) return next(err);
  const isProd = process.env.NODE_ENV === "production";
  res.status(err?.status || 500).json({
    error: isProd ? "Lỗi server, vui lòng thử lại." : (err?.message || "Lỗi server"),
  });
});

// ── Lưới an toàn cấp process ───────────────────────────────────────────────────
// Một promise lỗi chưa bắt KHÔNG được làm sập/treo server. Log để còn lần ra nguyên nhân.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  // Log và TIẾP TỤC phục vụ (tránh downtime). Treo thật sự → Docker healthcheck + restart lo.
  console.error("[uncaughtException]", err);
});

// ── Start (CHỈ CÓ 1 CHỖ DUY NHẤT) ──────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Meo Care running on http://localhost:${PORT}`);
  connectMongo(); 
  console.log(`   GHN_TOKEN: ${process.env.GHN_TOKEN ? "loaded" : "missing"}`);
  console.log(`   GHN_SHOP_ID: ${process.env.GHN_SHOP_ID ? "loaded" : "missing"}`);
});

// Khởi động Socket.io GẦN VÀO server HTTP (SAU app.listen)
const initializeSocket = require("./socket");
initializeSocket(server);

// Auto backup job (chạy hàng ngày lúc 2:00 AM)
require("./jobs/autoBackup");

// Nạp ổ lưu backup admin đã chọn (app_settings.backup_dir) — fallback mặc định nếu chưa đặt
require("./utils/backup").loadBackupDir().catch(() => {});

// Auto expire bookings (chạy mỗi giờ — hủy đơn pending quá hạn check_in)
require("./jobs/autoExpireBookings");

// Auto cancel unpaid online orders (chạy mỗi giờ — hủy đơn bank/unpaid quá 48h)
require("./jobs/autoCancelUnpaidOrders");

// Dọn idempotency-key cũ (chạy mỗi giờ — xóa key quá 24h)
require("./jobs/cleanupIdempotencyKeys");

// Dọn refresh token hết hạn/revoked (chạy hằng ngày)
require("./jobs/cleanupRefreshTokens");

// Nhắc việc qua Telegram (nhận/trả mèo sắp tới giờ, đơn bank sắp quá hạn)
require("./jobs/notifyReminders");

// ── GHI HÌNH ĐÃ CHUYỂN SANG EDGE (mỗi Kubuntu chi nhánh tự ghi qua edge-agent) ──
// Trung tâm KHÔNG còn chạy ffmpeg ghi camera nữa. Giữ recorder-services.js làm thư
// viện (edge-agent tái dùng logic). Mặc định TẮT; chỉ bật lại khi cần chạy ghi tập
// trung tạm thời trong lúc di trú 1 chi nhánh chưa có agent: ENABLE_CENTRAL_RECORDER=true
if (process.env.ENABLE_CENTRAL_RECORDER === "true") {
  console.warn("[Recorder] ENABLE_CENTRAL_RECORDER=true — ghi tập trung ở trung tâm (chế độ di trú).");
  setTimeout(() => {
    try { require("./routes/recorder-services").restoreOnStartup(); }
    catch (e) { console.error("[Recorder] restoreOnStartup lỗi:", e.message); }
  }, 15000);
}