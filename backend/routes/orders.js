const express = require("express");
const db = require("../db/database");

const router = express.Router();

/* ── Helper tạo mã hóa đơn ───────────────────────── */
function generateInvoiceNo() {

  const today = new Date();

  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth()+1).padStart(2,"0");
  const d = String(today.getDate()).padStart(2,"0");

  const prefix = `MC${y}${m}${d}`;

  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM orders
    WHERE invoice_no LIKE ?
  `).get(`${prefix}%`);

  const num = String(row.count + 1).padStart(3,"0");

  return `${prefix}-${num}`;
}

router.get("/", (req,res)=>{

  const rows = db.prepare(`
    SELECT
      orders.*,
      customers.name,
      customers.phone
    FROM orders
    LEFT JOIN customers
    ON customers.id = orders.customer_id
    ORDER BY orders.id DESC
  `).all();

  res.json({data:rows});

});

/* ── Thêm đoạn này vào routes/orders.js, trước module.exports ──────────────

   GET /api/orders/:id
   Trả về chi tiết đơn hàng kèm danh sách sản phẩm (order_items)
*/

router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;

    // Thông tin đơn hàng + khách hàng
    const order = db.prepare(`
      SELECT
        orders.*,
        customers.name    AS customer_name,
        customers.phone   AS customer_phone,
        customers.address AS customer_address
      FROM orders
      LEFT JOIN customers ON customers.id = orders.customer_id
      WHERE orders.id = ?
    `).get(id);

    if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    // Danh sách sản phẩm trong đơn, JOIN products để lấy tên
    const items = db.prepare(`
      SELECT
        order_items.*,
        products.name AS product_name
      FROM order_items
      LEFT JOIN products ON products.id = order_items.product_id
      WHERE order_items.order_id = ?
      ORDER BY order_items.id ASC
    `).all(order.id);

    res.json({ ...order, items });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ── POST /api/orders ───────────────────────────── */
router.post("/", (req,res)=>{

  try{

    const { customer, items, ship_fee, discount, note } = req.body;

    if(!customer || !items || items.length === 0){
      return res.status(400).json({error:"Invalid order data"});
    }

    const now = new Date().toISOString();

    const subtotal = items.reduce((sum,i)=> sum + i.price*i.qty ,0);

    const total = subtotal + (ship_fee||0) - (discount||0);

    const invoiceNo = generateInvoiceNo();


    /* ── Transaction ───────────────────────── */
    const trx = db.transaction(()=>{

      /* Customer */
      const customerResult = db.prepare(`
        INSERT INTO customers (name,phone,address,created_at)
        VALUES (?,?,?,?)
      `).run(
        customer.name,
        customer.phone || "",
        customer.address || "",
        now
      );

      const customerId = customerResult.lastInsertRowid;


      /* Order */
      const orderResult = db.prepare(`
        INSERT INTO orders
        (invoice_no,customer_id,subtotal,ship_fee,discount,total,note,created_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        invoiceNo,
        customerId,
        subtotal,
        ship_fee||0,
        discount||0,
        total,
        note||"",
        now
      );

      const orderId = orderResult.lastInsertRowid;


      /* Order items */
      const insertItem = db.prepare(`
        INSERT INTO order_items
        (order_id,product_id,variant_name,price,qty,subtotal)
        VALUES (?,?,?,?,?,?)
      `);

      for(const item of items){

        insertItem.run(
          orderId,
          item.product_id || null,
          item.variant_name,
          item.price,
          item.qty,
          item.price * item.qty
        );

      }

      return {
        orderId,
        invoiceNo
      };

    });

    const result = trx();

    res.json({
      success:true,
      invoice_no: result.invoiceNo,
      order_id: result.orderId
    });

  }
  catch(err){

    console.error(err);

    res.status(500).json({
      error:"Create order failed"
    });

  }

});


module.exports = router;