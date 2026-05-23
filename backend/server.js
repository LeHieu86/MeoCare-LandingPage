// Load .env từ root project (cùng cấp Dockerfile)
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

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
const chatRouter = require("./routes/chat"); 
const cartRoutes    = require("./routes/cart");
const petsRoutes    = require("./routes/pets");
const reviewsRoutes = require("./routes/reviews");
const checkoutRoutes = require("./routes/checkout");
const serviceRoutes = require("./routes/service");
const uploadImageRoutes = require("./routes/upload-image");
const paymentRoutes = require("./routes/payment");
const accountRoutes = require("./routes/account");
const purchaseOrderRoutes = require("./routes/purchase-orders");
const suppliersRoutes = require("./routes/suppliers");
const { router: inventoryRoutes } = require("./routes/inventory");
const sellProductComponentRoutes = require("./routes/sell-components");
const backupRoutes = require("./routes/backup");
// ── HR Module ─────────────────────────────────────────────────────────────────
const employeesRoutes       = require("./routes/employees");
const shiftsRoutes          = require("./routes/shifts");
const shiftAssignmentsRoutes= require("./routes/shift-assignments");
const attendanceRoutes      = require("./routes/attendance");
const leaveRoutes           = require("./routes/leave");
const salaryRoutes          = require("./routes/salary");

const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");

const app  = express();
const http = require("http");
const PORT = process.env.PORT || 3001;

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20,
  message: { error: "Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
});

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

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",      authLimiter, authRoutes);
app.use("/api/products",  productRoutes);
app.use("/api/shipping",  shippingRoutes);
app.use("/api/orders",    orderRoutes);
app.use("/api/sign",      signRouter);
app.use("/api/rooms",     roomsRouter);
app.use("/api/cameras",   camerasRouter);
app.use("/api/bookings",  bookingsRouter);
app.use("/api/admin/nas", nasRouter);
app.use("/api/chat", chatRouter);
app.use("/api/cart",    cartRoutes);
app.use("/api/pets",    petsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/upload", uploadImageRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sell-components", sellProductComponentRoutes);
app.use("/api/admin/backup", backupRoutes);
// ── HR Module ─────────────────────────────────────────────────────────────────
app.use("/api/employees",        employeesRoutes);
app.use("/api/shifts",           shiftsRoutes);
app.use("/api/shift-assignments",shiftAssignmentsRoutes);
app.use("/api/attendance",       attendanceRoutes);
app.use("/api/leave",            leaveRoutes);
app.use("/api/salary",           salaryRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ── Serve React build ────────────────────────────────────────────────────────
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
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