/**
 * routes/agent.js
 * API cho EDGE AGENT (Kubuntu mỗi chi nhánh) — auth bằng agent-token, KHÔNG phải JWT user.
 *
 * Phase 1: chỉ GET /config — agent kéo về danh sách camera + ổ đĩa của ĐÚNG chi nhánh
 * mình (suy ra từ agent_token) để tự ghi cục bộ.
 * Phase 2 sẽ bổ sung /heartbeat + /commands tại đây.
 */
const express = require('express');
const router  = express.Router();
const prisma  = require('../lib/prisma');
const { agentAuth } = require('../middleware/agentAuth');

// GET /api/agent/config
// Trả desired-state để agent ghi cục bộ: cameras + disks (mount_path là đường dẫn HDD
// CỤC BỘ trên Kubuntu chi nhánh) + segment_duration.
router.get('/config', agentAuth, async (req, res) => {
  try {
    const config  = req.nasConfig;
    const cameras = await prisma.camera.findMany({
      where:  { store_id: req.storeId },
      select: {
        id: true, name: true, rtsp_url: true, rtsp_sub_url: true,
        disk_id: true, recording: true,
      },
      orderBy: { id: 'asc' },
    });
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

module.exports = router;
