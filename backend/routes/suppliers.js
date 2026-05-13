const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    res.json({
      success: true,
      suppliers: suppliers.map((s) => ({
        id: s.id, name: s.name, phone: s.phone,
        address: s.address, note: s.note,
        totalOrders: s._count.purchaseOrders,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, phone, address, note } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên NCC không được trống" });
    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null, note: note?.trim() || null },
    });
    res.json({ success: true, supplier });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, address, note } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên NCC không được trống" });
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null, note: note?.trim() || null },
    });
    res.json({ success: true, supplier });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const count = await prisma.purchaseOrder.count({ where: { supplier_id: id } });
    if (count > 0) return res.status(400).json({ success: false, message: "NCC đã có phiếu nhập, không thể xóa" });
    await prisma.supplier.update({ where: { id }, data: { is_active: false } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;