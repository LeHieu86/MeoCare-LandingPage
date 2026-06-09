/**
 * agentAuth.js
 * Xác thực EDGE AGENT (Kubuntu chi nhánh) gọi về trung tâm — KHÔNG dùng JWT user.
 * Mỗi chi nhánh có 1 agent_token bí mật lưu trong NasConfig. Agent gửi token qua
 * header "X-Agent-Token"; trung tâm tra ra đúng chi nhánh (store_id) tương ứng.
 * Fail-closed: thiếu/sai token → từ chối.
 */
const prisma = require('../lib/prisma');

async function agentAuth(req, res, next) {
  const token = req.headers['x-agent-token'];
  if (!token) {
    return res.status(401).json({ error: 'Thiếu agent token.' });
  }
  try {
    const config = await prisma.nasConfig.findUnique({ where: { agent_token: token } });
    if (!config) {
      return res.status(403).json({ error: 'Agent token không hợp lệ.' });
    }
    req.nasConfig = config;
    req.storeId   = config.store_id;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { agentAuth };
