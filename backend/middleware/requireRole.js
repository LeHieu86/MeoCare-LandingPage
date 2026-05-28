/**
 * requireRole — reusable role-check middleware.
 *
 * owner luôn có quyền truy cập mọi route dành cho admin/manager.
 * Thứ tự phân quyền: owner > admin > manager > employee
 */

/** Chỉ admin và owner mới được thực hiện */
const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!["admin", "owner"].includes(role)) {
    return res.status(403).json({ error: "Không có quyền thực hiện thao tác này." });
  }
  next();
};

/** Admin, manager và owner đều được thực hiện */
const requireManager = (req, res, next) => {
  const role = req.user?.role;
  if (!["admin", "manager", "owner"].includes(role)) {
    return res.status(403).json({ error: "Không có quyền thực hiện thao tác này." });
  }
  next();
};

module.exports = { requireAdmin, requireManager };
