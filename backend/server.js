// Load .env từ root project (cùng cấp Dockerfile)
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

require("./db/init");

const express = require("express");
const cors    = require("cors");
const path    = require("path");

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

const app  = express();
const PORT = process.env.PORT || 3001;

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

app.use(express.json());

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/products",  productRoutes);
app.use("/api/shipping",  shippingRoutes);
app.use("/api/orders",    orderRoutes);
app.use("/api/sign",      signRouter);
app.use("/api/rooms",     roomsRouter);
app.use("/api/cameras",   camerasRouter);
app.use("/api/bookings",  bookingsRouter);
app.use("/api/admin/nas", nasRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ── Serve React build ────────────────────────────────────────────────────────
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Meo Care running on http://localhost:${PORT}`);
  console.log(`   GHN_TOKEN: ${process.env.GHN_TOKEN ? "loaded" : "missing"}`);
  console.log(`   GHN_SHOP_ID: ${process.env.GHN_SHOP_ID ? "loaded" : "missing"}`);
});