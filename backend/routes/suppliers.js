const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");
const prisma = require("../lib/prisma");

const router = express.Router();

router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true, ...storeWhere(req) },
      orderBy: { name: "asc" },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    res.json(suppliers.map((s) => ({
      id: s.id, name: s.name, phone: s.phone,
      address: s.address, note: s.note,
      totalOrders: s._count.purchaseOrders,
    })));
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

router.post("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { name, phone, address, note } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên NCC không được trống" });
    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null, note: note?.trim() || null, ...injectStoreId(req) },
    });
    res.json({ success: true, supplier });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

router.put("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, address, note } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên NCC không được trống" });
    const exists = await prisma.supplier.findUnique({ where: { id, ...storeWhere(req) } });
    if (!exists) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null, note: note?.trim() || null },
    });
    res.json({ success: true, supplier });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

router.delete("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const exists = await prisma.supplier.findFirst({
      where: {
        id,
        ...storeWhere(req),
      },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhà cung cấp",
      });
    }

    // Không cho xóa nếu đã có phiếu nhập
    if (exists._count.purchaseOrders > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Nhà cung cấp đã phát sinh phiếu nhập, chỉ có thể vô hiệu hóa",
      });
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    res.json({
      success: true,
      message: "Đã vô hiệu hóa nhà cung cấp",
    });
  } catch (err) {
    console.error("Lỗi xóa supplier:", err);

    res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
});

module.exports = router;