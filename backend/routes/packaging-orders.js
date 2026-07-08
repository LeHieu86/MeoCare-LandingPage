const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");
const prisma = require("../lib/prisma");

const router = express.Router();

async function generatePkgCode() {
  const today = new Date();
  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `PKG-${y}${m}${d}`;
  const last = await prisma.packagingOrder.findFirst({
    where:   { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select:  { code: true },
  });
  let nextNum = 1;
  if (last) {
    const match = last.code.match(/-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}

/* ── POST /api/packaging-orders/preview ──────────────────────────────────────
   Tính toán trước khi tạo phiếu:
   - Kiểm tra tồn kho đầu vào có đủ không
   - Tính total_input_cost từ average_cost
   - Tính unit_cost cho từng output (phân bổ chi phí)
   - Tính số dư (remainder)
*/
router.post("/preview", verifyToken, storeContext, async (req, res) => {
  try {
    const { inputs = [], outputs = [], extra_cost = 0 } = req.body;

    if (inputs.length === 0)
      return res.status(400).json({ success: false, message: "Cần ít nhất 1 nguyên liệu đầu vào" });
    if (outputs.length === 0)
      return res.status(400).json({ success: false, message: "Cần ít nhất 1 sản phẩm đầu ra" });

    // Lấy thông tin inventory items cho inputs và outputs
    const inputIds  = inputs.map((i) => i.inventory_item_id);
    const outputIds = outputs.map((o) => o.inventory_item_id);
    const allIds    = [...new Set([...inputIds, ...outputIds])];

    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: allIds } },
      select: { id: true, name: true, sku: true, unit: true, current_stock: true, average_cost: true },
    });
    const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

    // Tính tổng base units đầu vào
    let totalBaseUnitsIn = 0;
    let totalInputCost   = 0;
    const inputDetails   = [];
    const stockWarnings  = [];

    for (const inp of inputs) {
      const item = itemMap[inp.inventory_item_id];
      if (!item)
        return res.status(400).json({ success: false, message: `Không tìm thấy hàng hóa ID ${inp.inventory_item_id}` });

      const baseUnits = inp.quantity * (inp.units_per_input ?? 1);
      const cost      = baseUnits * item.average_cost;
      totalBaseUnitsIn += baseUnits;
      totalInputCost   += cost;

      if (item.current_stock < inp.quantity) {
        stockWarnings.push({
          inventory_item_id: item.id,
          name:       item.name,
          need:       inp.quantity,
          available:  item.current_stock,
        });
      }

      inputDetails.push({
        inventory_item_id: item.id,
        name:          item.name,
        sku:           item.sku,
        unit:          item.unit,
        quantity:      inp.quantity,
        units_per_input: inp.units_per_input ?? 1,
        base_units:    baseUnits,
        average_cost:  item.average_cost,
        total_cost:    cost,
        current_stock: item.current_stock,
      });
    }

    // Tính tổng base units đầu ra
    let totalBaseUnitsOut = 0;
    const outputDetails   = [];

    for (const out of outputs) {
      const item = itemMap[out.inventory_item_id];
      if (!item)
        return res.status(400).json({ success: false, message: `Không tìm thấy hàng hóa ID ${out.inventory_item_id}` });

      const baseUnits = out.quantity * (out.units_per_pack ?? 1);
      totalBaseUnitsOut += baseUnits;

      outputDetails.push({
        inventory_item_id: item.id,
        name:         item.name,
        sku:          item.sku,
        unit:         item.unit,
        quantity:     out.quantity,
        units_per_pack: out.units_per_pack ?? 1,
        base_units:   baseUnits,
      });
    }

    // Chi phí phụ (bao bì, công đóng gói) → cộng vào tổng chi phí, phân bổ vào giá vốn thành phẩm
    totalInputCost += parseInt(extra_cost) || 0;

    // Phân bổ chi phí cho từng output (tỉ lệ base_units / totalBaseUnitsOut)
    const costPerBaseUnit = totalBaseUnitsOut > 0 ? totalInputCost / totalBaseUnitsOut : 0;
    for (const out of outputDetails) {
      out.unit_cost   = Math.round(costPerBaseUnit * (out.units_per_pack ?? 1));
      out.total_value = out.unit_cost * out.quantity;
    }

    const remainder = totalBaseUnitsIn - totalBaseUnitsOut;

    res.json({
      success: true,
      preview: {
        total_input_cost:    totalInputCost,
        total_base_units_in:  totalBaseUnitsIn,
        total_base_units_out: totalBaseUnitsOut,
        remainder_qty:       remainder,
        cost_per_base_unit:  Math.round(costPerBaseUnit),
        inputs:  inputDetails,
        outputs: outputDetails,
        stock_warnings: stockWarnings,
        is_feasible: stockWarnings.length === 0 && remainder >= 0,
      },
    });
  } catch (err) {
    console.error("Lỗi preview phiếu đóng gói:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/packaging-orders ──────────────────────────────────────────────── */
router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const orders = await prisma.packagingOrder.findMany({
      where: { ...storeWhere(req) },
      include: {
        _count: { select: { inputs: true, outputs: true } },
      },
      orderBy: { id: "desc" },
    });

    res.json({
      success: true,
      data: orders.map((o) => ({
        id:              o.id,
        code:            o.code,
        store_id:        o.store_id,
        status:          o.status,
        note:            o.note,
        total_input_cost: o.total_input_cost,
        remainder_qty:   o.remainder_qty,
        completed_at:    o.completed_at,
        created_at:      o.created_at,
        input_count:     o._count.inputs,
        output_count:    o._count.outputs,
      })),
    });
  } catch (err) {
    console.error("Lỗi danh sách phiếu đóng gói:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/packaging-orders/:id ─────────────────────────────────────────── */
router.get("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.packagingOrder.findUnique({
      where: { id, ...storeWhere(req) },
      include: {
        inputs:  { include: { inventoryItem: { select: { id: true, name: true, sku: true, unit: true, current_stock: true, average_cost: true } } } },
        outputs: { include: { inventoryItem: { select: { id: true, name: true, sku: true, unit: true, current_stock: true } } } },
      },
    });
    if (!order)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu đóng gói" });

    res.json({ success: true, data: order });
  } catch (err) {
    console.error("Lỗi chi tiết phiếu đóng gói:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── POST /api/packaging-orders — Tạo phiếu draft ──────────────────────────── */
router.post("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { inputs = [], outputs = [], note, extra_cost = 0 } = req.body;

    if (inputs.length === 0)
      return res.status(400).json({ success: false, message: "Cần ít nhất 1 nguyên liệu đầu vào" });
    if (outputs.length === 0)
      return res.status(400).json({ success: false, message: "Cần ít nhất 1 sản phẩm đầu ra" });

    const code = await generatePkgCode();

    // Tính total_input_cost
    const inputIds = inputs.map((i) => i.inventory_item_id);
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: inputIds } },
      select: { id: true, average_cost: true },
    });
    const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

    let totalInputCost   = 0;
    let totalBaseUnitsIn = 0;
    let totalBaseUnitsOut = 0;

    for (const inp of inputs) {
      const baseUnits = inp.quantity * (inp.units_per_input ?? 1);
      totalBaseUnitsIn  += baseUnits;
      totalInputCost    += baseUnits * (itemMap[inp.inventory_item_id]?.average_cost ?? 0);
    }
    for (const out of outputs) {
      totalBaseUnitsOut += out.quantity * (out.units_per_pack ?? 1);
    }

    // Chi phí phụ (bao bì, công đóng gói) → cộng vào tổng chi phí giống preview
    totalInputCost += parseInt(extra_cost) || 0;

    const remainder      = totalBaseUnitsIn - totalBaseUnitsOut;
    const costPerBase    = totalBaseUnitsOut > 0 ? totalInputCost / totalBaseUnitsOut : 0;

    const order = await prisma.packagingOrder.create({
      data: {
        code,
        note: note || null,
        status:           "draft",
        total_input_cost:  totalInputCost,
        remainder_qty:    remainder,
        ...injectStoreId(req),
        inputs: {
          create: inputs.map((i) => ({
            inventory_item_id: i.inventory_item_id,
            quantity:          i.quantity,
            units_per_input:   i.units_per_input ?? 1,
          })),
        },
        outputs: {
          create: outputs.map((o) => ({
            inventory_item_id: o.inventory_item_id,
            quantity:          o.quantity,
            units_per_pack:    o.units_per_pack ?? 1,
            unit_cost:         Math.round(costPerBase * (o.units_per_pack ?? 1)),
          })),
        },
      },
    });

    res.json({ success: true, id: order.id, code: order.code });
  } catch (err) {
    console.error("Lỗi tạo phiếu đóng gói:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/packaging-orders/:id/complete — Hoàn thành phiếu ─────────────
   1. Trừ stock các inventory items đầu vào
   2. Cộng stock các inventory items đầu ra (với unit_cost snapshot)
   3. Ghi StockMovement cho từng item
   4. status → completed
*/
router.put("/:id/complete", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.packagingOrder.findUnique({
      where: { id, ...storeWhere(req) },
      include: { inputs: true, outputs: true },
    });
    if (!order)
      return res.status(404).json({ success: false, message: "Không tìm thấy" });
    if (order.status !== "draft")
      return res.status(400).json({ success: false, message: "Chỉ hoàn thành được phiếu ở trạng thái draft" });

    await prisma.$transaction(async (tx) => {
      // Optimistic lock
      const locked = await tx.packagingOrder.updateMany({
        where: { id, status: "draft" },
        data:  { status: "completed", completed_at: new Date() },
      });
      if (locked.count === 0) throw new Error("ALREADY_PROCESSED");

      // Trừ stock đầu vào
      for (const inp of order.inputs) {
        const inv = await tx.inventoryItem.findUnique({ where: { id: inp.inventory_item_id } });
        if (inv.current_stock < inp.quantity) {
          throw Object.assign(
            new Error(`Không đủ tồn kho: "${inv.name}" (cần ${inp.quantity}, còn ${inv.current_stock})`),
            { statusCode: 400 }
          );
        }
        const newStock = inv.current_stock - inp.quantity;
        await tx.inventoryItem.update({
          where: { id: inv.id },
          data:  { current_stock: newStock },
        });
        await tx.stockMovement.create({ data: {
          inventory_item_id: inv.id,
          type:              "adjustment",
          qty_change:        -inp.quantity,
          qty_before:        inv.current_stock,
          qty_after:         newStock,
          unit_cost:         inv.average_cost,
          reference_type:    "packaging_order",
          reference_id:      id,
          note:              `Xuất nguyên liệu theo phiếu đóng gói ${order.code}`,
        }});
      }

      // Cộng stock đầu ra
      for (const out of order.outputs) {
        const inv = await tx.inventoryItem.findUnique({ where: { id: out.inventory_item_id } });
        const newStock = inv.current_stock + out.quantity;

        // Tính lại average_cost bình quân gia quyền
        const totalOldValue = inv.current_stock * inv.average_cost;
        const totalNewValue = out.quantity * out.unit_cost;
        const newAvgCost    = newStock > 0
          ? Math.round((totalOldValue + totalNewValue) / newStock)
          : out.unit_cost;

        await tx.inventoryItem.update({
          where: { id: inv.id },
          data:  { current_stock: newStock, average_cost: newAvgCost },
        });
        await tx.stockMovement.create({ data: {
          inventory_item_id: inv.id,
          type:              "adjustment",
          qty_change:        out.quantity,
          qty_before:        inv.current_stock,
          qty_after:         newStock,
          unit_cost:         out.unit_cost,
          reference_type:    "packaging_order",
          reference_id:      id,
          note:              `Nhập thành phẩm theo phiếu đóng gói ${order.code}`,
        }});
      }
    }).catch((err) => {
      if (err.message === "ALREADY_PROCESSED")
        return res.status(409).json({ success: false, message: "Phiếu đã được xử lý bởi thao tác khác" });
      if (err.statusCode === 400)
        return res.status(400).json({ success: false, message: err.message });
      throw err;
    });

    if (res.headersSent) return;
    res.json({ success: true, message: "Phiếu đóng gói đã hoàn thành" });
  } catch (err) {
    console.error("Lỗi hoàn thành phiếu đóng gói:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/packaging-orders/:id/cancel ─────────────────────────────────── */
router.put("/:id/cancel", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.packagingOrder.findUnique({
      where: { id, ...storeWhere(req) },
    });
    if (!order)
      return res.status(404).json({ success: false, message: "Không tìm thấy" });
    if (order.status !== "draft")
      return res.status(400).json({ success: false, message: "Chỉ hủy được phiếu ở trạng thái draft" });

    await prisma.packagingOrder.update({
      where: { id },
      data:  { status: "cancelled" },
    });

    res.json({ success: true, message: "Đã hủy phiếu đóng gói" });
  } catch (err) {
    console.error("Lỗi hủy phiếu đóng gói:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;
