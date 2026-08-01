import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", icon: "◉" },
  { to: "/people", label: "People", icon: "◎" },
  { to: "/classes", label: "Classes", icon: "▤" },
  { to: "/dataset", label: "Dataset & Train", icon: "▣" },
  { to: "/recognize", label: "Recognize", icon: "◈" },
  { to: "/attendance", label: "Check-in", icon: "✓" },
  { to: "/view-attendance", label: "View Attendance", icon: "☰" },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">👤</div>
          <div>
            <h1>Face Attendance</h1>
            <p>Multi-person recognition</p>
          </div>
        </div>
        <nav className="nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              <span className="nav-icon">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          API docs at <a href="/docs" target="_blank" rel="noreferrer">/docs</a>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
