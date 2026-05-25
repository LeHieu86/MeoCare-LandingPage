import React, { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import "../../styles/admin/backup.css";

const API = "/api/admin/backup";

function getToken() {
  return localStorage.getItem("mc_admin_token");
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}


// ── Confirm Modal ─────────────────────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="bkp-modal-overlay" onClick={onCancel}>
      <div className="bkp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bkp-modal-header">
          {danger ? "⚠️" : "❓"} {title}
        </div>
        <div className="bkp-modal-body">{body}</div>
        <div className="bkp-modal-actions">
          <button className="bkp-btn bkp-btn-ghost" onClick={onCancel}>
            Hủy
          </button>
          <button
            className={`bkp-btn ${danger ? "bkp-btn-danger" : "bkp-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function BackupManagement() {
  const push = (message, type = "info") => {
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message);
  };

  const [backups, setBackups] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringFile, setRestoringFile] = useState(null); // file being restored
  const [deletingFile, setDeletingFile] = useState(null);   // filename confirm delete

  const [selectedFile, setSelectedFile] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const fileInputRef = useRef();

  // ── Fetch list ──────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API}/list`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setBackups(data.data);
      else push(data.error || "Không tải được danh sách backup.", "error");
    } catch {
      push("Lỗi kết nối đến server.", "error");
    } finally {
      setLoadingList(false);
    }
  }, [push]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── Create backup ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    setCreatingBackup(true);
    push("Đang tạo backup, vui lòng đợi...", "info");
    try {
      const res = await fetch(`${API}/create`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Trigger browser download from blob
      const disposition = res.headers.get("Content-Disposition") || "";
      const nameMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = nameMatch ? nameMatch[1] : "backup.sql.gz";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      push(`Tạo backup thành công: ${filename}`, "success");
      fetchList();
    } catch (err) {
      push(`Tạo backup thất bại: ${err.message}`, "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  // ── Download backup ─────────────────────────────────────────────────────
  const handleDownload = (filename) => {
    const a = document.createElement("a");
    a.href = `${API}/download/${encodeURIComponent(filename)}`;
    a.download = filename;
    // Add token via query param fallback for direct download
    const token = getToken();
    a.href = `${API}/download/${encodeURIComponent(filename)}?token=${token}`;
    a.click();
  };

  // ── Delete backup ───────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    const filename = deletingFile;
    setDeletingFile(null);
    try {
      const res = await fetch(`${API}/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        push(`Đã xóa: ${filename}`, "success");
        setBackups((prev) => prev.filter((b) => b.name !== filename));
      } else {
        push(data.error || "Xóa thất bại.", "error");
      }
    } catch {
      push("Lỗi kết nối.", "error");
    }
  };

  // ── Restore ─────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".sql.gz")) {
      push("Chỉ chấp nhận file .sql.gz", "error");
      return;
    }
    setSelectedFile(file);
  };

  const handleRestoreConfirm = async () => {
    setRestoreConfirm(false);
    if (!selectedFile) return;
    setRestoringFile(selectedFile.name);
    push("Đang restore database, vui lòng không tắt trang...", "info");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const res = await fetch(`${API}/restore`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        push("Restore database thành công!", "success");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        push(data.error || "Restore thất bại.", "error");
      }
    } catch {
      push("Lỗi kết nối.", "error");
    } finally {
      setRestoringFile(null);
    }
  };

  // ── Download via token (intercepted in headers) ─────────────────────────
  // Actual download needs auth header — use fetch+blob instead
  const handleDownloadAuth = async (filename) => {
    try {
      const res = await fetch(`${API}/download/${encodeURIComponent(filename)}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      push(`Tải về thất bại: ${err.message}`, "error");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  const totalSize = backups.reduce((s, b) => s + b.size, 0);
  const latestBackup = backups[0];

  return (
    <div className="bkp-page">
      {/* Delete confirm */}
      {deletingFile && (
        <ConfirmModal
          title="Xóa backup"
          body={`Bạn chắc chắn muốn xóa file "${deletingFile}"? Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingFile(null)}
        />
      )}

      {/* Restore confirm */}
      {restoreConfirm && (
        <ConfirmModal
          title="Xác nhận Restore Database"
          body={
            <>
              <strong style={{ color: "var(--adm-danger)" }}>
                CẢNH BÁO: Thao tác này sẽ ghi đè toàn bộ dữ liệu hiện tại!
              </strong>
              <br />
              <br />
              File: <code style={{ color: "var(--adm-accent)" }}>{selectedFile?.name}</code>
              <br />
              <br />
              Toàn bộ đơn hàng, khách hàng, sản phẩm,... hiện tại sẽ bị thay thế bằng dữ liệu
              trong file backup. Bạn có chắc chắn muốn tiếp tục?
            </>
          }
          confirmLabel="Đồng ý Restore"
          danger
          onConfirm={handleRestoreConfirm}
          onCancel={() => setRestoreConfirm(false)}
        />
      )}

      {/* Header */}
      <div className="bkp-header">
        <div className="bkp-title">
          <div className="bkp-title-icon">🗄️</div>
          <div>
            <h1>Backup & Restore Database</h1>
            <p>Quản lý sao lưu và khôi phục dữ liệu PostgreSQL</p>
          </div>
        </div>
        <button
          className="bkp-btn bkp-btn-primary"
          onClick={handleCreate}
          disabled={creatingBackup}
        >
          {creatingBackup ? (
            <><div className="bkp-spinner" /> Đang tạo...</>
          ) : (
            <>"💾 Tạo Backup Ngay"</>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="bkp-stats">
        <div className="bkp-stat-card">
          <div className="bkp-stat-icon">📦</div>
          <div>
            <div className="bkp-stat-label">Tổng backup</div>
            <div className="bkp-stat-value">{backups.length}</div>
          </div>
        </div>
        <div className="bkp-stat-card">
          <div className="bkp-stat-icon">💽</div>
          <div>
            <div className="bkp-stat-label">Dung lượng</div>
            <div className="bkp-stat-value">{formatBytes(totalSize)}</div>
          </div>
        </div>
        <div className="bkp-stat-card">
          <div className="bkp-stat-icon">🕐</div>
          <div>
            <div className="bkp-stat-label">Backup gần nhất</div>
            <div className="bkp-stat-value" style={{ fontSize: 13 }}>
              {latestBackup ? formatDate(latestBackup.createdAt) : "Chưa có"}
            </div>
          </div>
        </div>
        <div className="bkp-stat-card">
          <div className="bkp-stat-icon">⏰</div>
          <div>
            <div className="bkp-stat-label">Auto Backup</div>
            <div className="bkp-stat-value" style={{ fontSize: 13, color: "var(--adm-success)" }}>
              2:00 AM / ngày
            </div>
          </div>
        </div>
      </div>

      {/* Backup list */}
      <div className="bkp-card">
        <div className="bkp-card-header">
          <h2>📋 Danh sách Backup</h2>
          <button className="bkp-btn bkp-btn-ghost bkp-btn-sm" onClick={fetchList} disabled={loadingList}>
            {loadingList ? <><div className="bkp-spinner" /> Đang tải...</> : "↻ Làm mới"}
          </button>
        </div>
        <div className="bkp-card-body" style={{ padding: 0 }}>
          {loadingList ? (
            <div className="bkp-empty">
              <div className="bkp-empty-icon">⏳</div>
              Đang tải danh sách...
            </div>
          ) : backups.length === 0 ? (
            <div className="bkp-empty">
              <div className="bkp-empty-icon">📭</div>
              Chưa có backup nào. Nhấn "Tạo Backup Ngay" để bắt đầu.
            </div>
          ) : (
            <div className="bkp-table-wrap">
              <table className="bkp-table">
                <thead>
                  <tr>
                    <th>Tên file</th>
                    <th>Ngày tạo</th>
                    <th>Kích thước</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.name}>
                      <td><span className="bkp-filename">{b.name}</span></td>
                      <td>{formatDate(b.createdAt)}</td>
                      <td>{formatBytes(b.size)}</td>
                      <td>
                        <div className="bkp-actions">
                          <button
                            className="bkp-btn bkp-btn-ghost bkp-btn-sm"
                            onClick={() => handleDownloadAuth(b.name)}
                          >
                            ⬇ Tải về
                          </button>
                          <button
                            className="bkp-btn bkp-btn-danger bkp-btn-sm"
                            onClick={() => setDeletingFile(b.name)}
                          >
                            🗑 Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Restore */}
      <div className="bkp-card">
        <div className="bkp-card-header">
          <h2>♻️ Restore Database</h2>
        </div>
        <div className="bkp-card-body">
          <div className="bkp-warning">
            <span className="bkp-warning-icon">⚠️</span>
            <span>
              <strong>Cảnh báo:</strong> Restore sẽ ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu
              trong file backup. Hãy tạo backup mới trước khi thực hiện restore để tránh mất dữ
              liệu không mong muốn.
            </span>
          </div>

          <div
            className="bkp-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dragover"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("dragover");
              const file = e.dataTransfer.files?.[0];
              if (file) {
                if (!file.name.endsWith(".sql.gz")) {
                  push("Chỉ chấp nhận file .sql.gz", "error");
                  return;
                }
                setSelectedFile(file);
              }
            }}
          >
            <div className="bkp-upload-icon">📂</div>
            <div className="bkp-upload-label">Kéo thả hoặc click để chọn file backup</div>
            <div className="bkp-upload-hint">Chỉ chấp nhận file .sql.gz (tối đa 500 MB)</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".sql.gz"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {selectedFile && (
            <div className="bkp-selected-file">
              <span>{selectedFile.name}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--adm-text-2)", fontSize: 12 }}>
                  {formatBytes(selectedFile.size)}
                </span>
                <button
                  className="bkp-btn bkp-btn-ghost bkp-btn-sm"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              className="bkp-btn bkp-btn-danger"
              disabled={!selectedFile || !!restoringFile}
              onClick={() => setRestoreConfirm(true)}
            >
              {restoringFile ? (
                <><div className="bkp-spinner" /> Đang restore...</>
              ) : (
                "♻️ Restore Database"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
