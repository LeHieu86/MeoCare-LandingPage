const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Nếu bạn dùng better-sqlite3
const Database = require('better-sqlite3');
const oldDb = new Database('F:\\MeoCare-LandingPage\\backend\\data\\meocare.db'); 

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  return new Date(dateStr);
}

async function migrate() {
  console.log('🚀 Bắt đầu chuyển đổi dữ liệu...');
  try {
    // 1. Products
    const products = oldDb.prepare('SELECT * FROM products').all();
    for (const p of products) {
      await prisma.product.create({ data: { id: p.id, name: p.name, category: p.category, image: p.image, description: p.description } });
    }
    console.log(`✅ Đã chuyển ${products.length} Sản phẩm`);

    // 2. Variants
    const variants = oldDb.prepare('SELECT * FROM variants').all();
    for (const v of variants) {
      await prisma.variant.create({ data: { id: v.id, product_id: v.product_id, name: v.name, price: v.price } });
    }
    console.log(`✅ Đã chuyển ${variants.length} Biến thể`);

    // 3. Customers
    const customers = oldDb.prepare('SELECT * FROM customers').all();
    for (const c of customers) {
      await prisma.customer.create({ data: { id: c.id, name: c.name, phone: c.phone, address: c.address, created_at: parseDate(c.created_at) } });
    }
    console.log(`✅ Đã chuyển ${customers.length} Khách hàng`);

    // 4. Orders & Order Items
    const orders = oldDb.prepare('SELECT * FROM orders').all();
    for (const o of orders) {
      await prisma.order.create({
        data: {
          id: o.id, invoice_no: o.invoice_no, customer_id: o.customer_id,
          subtotal: o.subtotal, ship_fee: o.ship_fee || 0, discount: o.discount || 0,
          total: o.total, note: o.note, signature: o.signature,
          created_at: parseDate(o.created_at)
        }
      });
    }
    const orderItems = oldDb.prepare('SELECT * FROM order_items').all();
    for (const oi of orderItems) {
      await prisma.orderItem.create({ data: { id: oi.id, order_id: oi.order_id, product_id: oi.product_id, variant_name: oi.variant_name, price: oi.price, qty: oi.qty, subtotal: oi.subtotal } });
    }
    console.log(`✅ Đã chuyển ${orders.length} Đơn hàng và ${orderItems.length} Chi tiết đơn`);

    // 5. Rooms
    const rooms = oldDb.prepare("SELECT * FROM rooms WHERE id != 'null'").all();
    for (const r of rooms) {
      await prisma.room.create({ data: { id: r.id, name: r.name, status: r.status, camera_id: r.camera_id, created_at: parseDate(r.created_at), updated_at: parseDate(r.updated_at) } });
    }
    console.log(`✅ Đã chuyển ${rooms.length} Phòng Pet Hotel`);

    // 6. Cameras
    const cameras = oldDb.prepare('SELECT * FROM cameras').all();
    for (const c of cameras) {
      await prisma.camera.create({ data: { id: c.id, room_id: c.room_id, name: c.name, rtsp_url: c.rtsp_url, created_at: parseDate(c.created_at), status: c.status } });
    }
    console.log(`✅ Đã chuyển ${cameras.length} Camera`);

    // 7. Bookings
    const bookings = oldDb.prepare('SELECT * FROM bookings').all();
    for (const b of bookings) {
      await prisma.booking.create({ data: { id: b.id, cat_name: b.cat_name, cat_breed: b.cat_breed, owner_name: b.owner_name, owner_phone: b.owner_phone, service: b.service, room_id: b.room_id, check_in: parseDate(b.check_in), check_out: parseDate(b.check_out), status: b.status, note: b.note, created_at: parseDate(b.created_at) } });
    }
    console.log(`✅ Đã chuyển ${bookings.length} Đặt chỗ`);

    // 8. Services
    const services = oldDb.prepare('SELECT * FROM services').all();
    for (const s of services) {
      await prisma.service.create({ data: { id: s.id, room_id: s.room_id, customer_id: s.customer_id, start_time: s.start_time, end_time: s.end_time, note: s.note, created_at: parseDate(s.created_at) } });
    }
    console.log(`✅ Đã chuyển ${services.length} Dịch vụ`);

    // 9. Users (Bỏ admin để không bị lỗi trùng)
    const users = oldDb.prepare("SELECT * FROM users WHERE username != 'admin'").all();
    for (const u of users) {
      await prisma.user.create({ data: { id: u.id, username: u.username, password: u.password, role: u.role, created_at: parseDate(u.created_at) } });
    }
    console.log(`✅ Đã chuyển ${users.length} Tài khoản người dùng`);

    // 10. Tokens
    const tokens = oldDb.prepare('SELECT * FROM tokens').all();
    for (const t of tokens) {
      await prisma.token.create({ data: { token: t.token, room_id: t.room_id, service_id: t.service_id, expired_at: parseDate(t.expired_at), created_at: parseDate(t.created_at) } });
    }
    console.log(`✅ Đã chuyển ${tokens.length} Token Camera`);

    // 11. Access Logs
    const logs = oldDb.prepare('SELECT * FROM access_logs').all();
    for (const l of logs) {
      await prisma.accessLog.create({ data: { id: l.id, user_id: l.user_id, camera_id: l.camera_id, access_time: parseDate(l.access_time) } });
    }
    console.log(`✅ Đã chuyển ${logs.length} Log truy cập`);

    // 12. Nas Config
    const nasRow = oldDb.prepare('SELECT * FROM nas_config WHERE id = 1').get();
    if (nasRow) {
      let parsedRooms = [];
      try { parsedRooms = JSON.parse(nasRow.rooms); } catch(e) { parsedRooms = [nasRow.rooms]; }
      
      await prisma.nasConfig.upsert({
        where: { id: 1 },
        update: {
          nas_root: nasRow.nas_root, rooms: parsedRooms, segment_duration: nasRow.segment_duration,
          date_format: nasRow.date_format, output_format: nasRow.output_format, codec: nasRow.codec,
          source_dir: nasRow.source_dir, delete_source: Boolean(nasRow.delete_source),
          run_mode: nasRow.run_mode, log_file: nasRow.log_file, watch_interval: nasRow.watch_interval
        },
        create: {
          id: 1, nas_root: nasRow.nas_root, rooms: parsedRooms, segment_duration: nasRow.segment_duration,
          date_format: nasRow.date_format, output_format: nasRow.output_format, codec: nasRow.codec,
          source_dir: nasRow.source_dir, delete_source: Boolean(nasRow.delete_source),
          run_mode: nasRow.run_mode, log_file: nasRow.log_file, watch_interval: nasRow.watch_interval
        }
      });
      console.log(`✅ Đã chuyển Cấu hình NAS`);
    }

    console.log('\n🎉 HOÀN TẤT CHUYỂN ĐỔI DỮ LIỆU!');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await prisma.$disconnect();
    oldDb.close();
  }
}

migrate();