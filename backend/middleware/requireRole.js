/**
 * requireRole — reusable role-check middleware.
 *
 * Roles hệ thống:
 *   admin        — Quản lý tổng, full access, thấy tất cả stores
 *   hr-manager   — Quản lý nhân sự: duyệt công, lương, nghỉ phép
 *   manager      — Quản lý chi nhánh: vận hành booking, orders, POS
 *   stock-manager— Quản lý kho tổng (dùng StockApp)
 *   employee     — Nhân viên: POS, chấm công cá nhân
 *
 * Role groups:
 *   requireAdmin      → chỉ admin
 *   requireHR         → admin + hr-manager
 *   requireBranch     → admin + manager
 *   requireHROrBranch → admin + hr-manager + manager  (HR workflow)
 *   requireWarehouse  → admin + stock-manager
 *   requireManager    → alias của requireBranch (backward compat)
 */

const _check = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền thực hiện thao tác này." });
  }
  next();
};

/** Chỉ admin */
const requireAdmin = _check(["admin"]);

/** Admin + hr-manager — duyệt, xử lý HR */
const requireHR = _check(["admin", "hr-manager"]);

/** Admin + manager — vận hành chi nhánh */
const requireBranch = _check(["admin", "manager"]);

/** Admin + hr-manager + manager — nộp/duyệt HR workflow */
const requireHROrBranch = _check(["admin", "hr-manager", "manager"]);

/** Admin + stock-manager — kho tổng */
const requireWarehouse = _check(["admin", "stock-manager"]);

/** Backward compat alias = requireBranch */
const requireManager = requireBranch;

module.exports = {
  requireAdmin,
  requireHR,
  requireBranch,
  requireHROrBranch,
  requireWarehouse,
  requireManager,
};
