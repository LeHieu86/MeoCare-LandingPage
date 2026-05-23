import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const NAV = [
  { path:"/employee",          label:"Tổng quan",   icon:"🏠", exact:true },
  { path:"/employee/shifts",   label:"Ca làm",      icon:"📅" },
  { path:"/employee/attendance",label:"Chấm công",  icon:"⏰" },
  { path:"/employee/leave",    label:"Nghỉ phép",   icon:"🏖️" },
  { path:"/employee/salary",   label:"Bảng lương",  icon:"💰" },
];

const EmployeeLayout = () => {
  const navigate  = useNavigate();
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("mc_employee_token") || localStorage.getItem("mc_admin_token");
    if (!token) { navigate("/login"); return; }
    fetch(`${API_BASE}/auth/verify`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.valid) { navigate("/login"); return; }
        // Chỉ cho phép employee / manager / admin vào employee portal
        if (!["employee","manager","admin"].includes(d.user.role)) {
          navigate("/"); return;
        }
        setUser(d.user);
        // Lưu token đúng key
        if (!localStorage.getItem("mc_employee_token")) {
          localStorage.setItem("mc_employee_token", token);
        }
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("mc_employee_token");
    navigate("/login");
  };

  const isActive = (item) => item.exact ? pathname === item.path : pathname.startsWith(item.path);

  return (
    <div style={{ display:"flex",minHeight:"100vh",background:"#0f1117",fontFamily:"'Nunito',sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside style={{ width:220,background:"#1a1d2e",borderRight:"1px solid #2d3154",display:"flex",flexDirection:"column",position:"fixed",height:"100vh" }}>
        <div style={{ padding:"20px 20px 16px",borderBottom:"1px solid #2d3154" }}>
          <div style={{ fontSize:22,marginBottom:4 }}>🐱</div>
          <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:15 }}>Meo Care</div>
          <div style={{ color:"#8b90a7",fontSize:11 }}>Cổng nhân viên</div>
        </div>

        {user && (
          <div style={{ padding:"14px 20px",borderBottom:"1px solid #2d3154",display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",background:"#2d3154",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>
              {user.avatar ? <img src={user.avatar} alt="" style={{ width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover" }} /> : "👤"}
            </div>
            <div>
              <div style={{ color:"#e8eaf0",fontWeight:600,fontSize:13 }}>{user.fullName || user.username}</div>
              <div style={{ color:"#8b90a7",fontSize:11 }}>{user.role === "manager" ? "Quản lý" : "Nhân viên"}</div>
            </div>
          </div>
        )}

        <nav style={{ flex:1,padding:"12px 0",overflowY:"auto" }}>
          {NAV.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display:"flex",alignItems:"center",gap:12,padding:"10px 20px",
                textDecoration:"none",fontSize:14,fontWeight:600,borderRadius:0,
                background: isActive(item) ? "rgba(91,124,246,.15)" : "transparent",
                color:      isActive(item) ? "#5b7cf6" : "#8b90a7",
                borderLeft: isActive(item) ? "3px solid #5b7cf6" : "3px solid transparent",
                transition:"all .15s",
              }}
            >
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}

          {/* Link về admin panel nếu là manager/admin */}
          {user?.role !== "employee" && (
            <Link to="/admin" style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 20px",textDecoration:"none",fontSize:13,color:"#6b7280",marginTop:8 }}>
              <span>⚙️</span>Admin Panel
            </Link>
          )}
        </nav>

        <div style={{ padding:"12px 20px",borderTop:"1px solid #2d3154" }}>
          <a href="/" style={{ display:"block",color:"#8b90a7",fontSize:13,textDecoration:"none",marginBottom:8 }}>🌐 Trang web</a>
          <button onClick={logout} style={{ background:"transparent",border:"none",color:"#ef4444",fontSize:13,cursor:"pointer",padding:0,fontWeight:600 }}>🚪 Đăng xuất</button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ marginLeft:220,flex:1,minHeight:"100vh" }}>
        <Outlet context={{ user }} />
      </main>
    </div>
  );
};

export default EmployeeLayout;
