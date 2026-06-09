/**
 * routes/agent.js
 * API cho EDGE AGENT (Kubuntu mỗi chi nhánh) — auth bằng agent-token, KHÔNG phải JWT user.
 *
 * - GET  /config    : desired-state (camera + ổ đĩa) — agent kéo lúc khởi động.
 * - POST /heartbeat : agent báo runtime (df + trạng thái ghi) MỖI ~15s; trung tâm trả LẠI
 *                     desired-state mới nhất + hàng lệnh chờ (round-trip 1 lần). Đây cũng là
 *                     kênh giữ config tươi (không cần poll /config riêng).
 *
 * Điều khiển ghi = desired-state: `camera.recording` trong DB là nguồn sự thật; agent
 * reconcile theo nó mỗi heartbeat. `pending_commands` dành cho lệnh tức thời (reload/restart).
 */
const express = require('express');
const router  = express.Router();
const prisma  = require('../lib/prisma');
const { agentAuth } = require('../middleware/agentAuth');

// Desired-state cameras cho 1 chi nhánh (dùng chung cho /config và /heartbeat response)
const desiredCameras = (storeId) => prisma.camera.findMany({
  where:  { store_id: storeId },
  select: { id: true, name: true, rtsp_url: true, rtsp_sub_url: true, disk_id: true, recording: true },
  orderBy: { id: 'asc' },
});

// GET /api/agent/config
// Trả desired-state để agent ghi cục bộ: cameras + disks (mount_path là đường dẫn HDD
// CỤC BỘ trên Kubuntu chi nhánh) + segment_duration.
router.get('/config', agentAuth, async (req, res) => {
  try {
    const config  = req.nasConfig;
    const cameras = await desiredCameras(req.storeId);
    res.json({
      success: true,
      data: {
        store_id:         req.storeId,
        segment_duration: config.segment_duration || 900,
        disks:            config.disks || [],   // [{id, mount_path, label}]
        cameras,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/heartbeat
// Body: { disks: {id:{total_gb,used_gb,free_gb,percent_used}}, cameras:[{id,recording,pid}], ts }
// → lưu runtime_status + last_heartbeat; trả desired-state mới + drain pending_commands.
router.post('/heartbeat', agentAuth, async (req, res) => {
  try {
    const config = req.nasConfig;
    const { disks = {}, cameras = [], ts } = req.body || {};

    const pending = Array.isArray(config.pending_commands) ? config.pending_commands : [];

    await prisma.nasConfig.update({
      where: { id: config.id },
      data: {
        last_heartbeat: new Date(),
        runtime_status: { disks, cameras, ts: ts || Date.now() },
        pending_commands: [],   // drain — agent đã nhận trong response
      },
    });

    const cams = await desiredCameras(req.storeId);
    res.json({
      success: true,
      config: {
        segment_duration: config.segment_duration || 900,
        disks:            config.disks || [],
        cameras:          cams,
      },
      commands: pending,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
