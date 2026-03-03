//import "../Styles/.css";
import React from "react"
import "../Styles/dashboard.css";
import "../Styles/defaults.css";

export default function DashboardPage({ user }) {
  const username = user?.username || user?.id || "User";

  return (
    <section className="dashboard">
        <aside className="sidebar">
            <nav className="sidebar-nav">
                <div className="nav-section">
                    <p className="nav-label">Welcome back</p>
                    <p className="user-greeting">{username}</p>
                </div>

                <div className="nav-section">
                    <span className="section-title">General</span>
                    <ul>
                        <li><a href="/dashboard/servers"><i className="fa-solid fa-server"></i><span>Servers</span></a></li>
                        <li><a href="/dashboard/settings"><i className="fa-solid fa-gear"></i><span>Settings</span></a></li>
                    </ul>
                </div>

                <div className="nav-section">
                    <span className="section-title">Management</span>
                    <ul>
                        <li><a href="/dashboard/logs"><i className="fa-solid fa-file-alt"></i><span>Logs</span></a></li>
                        <li><a href="/dashboard/analytics"><i className="fa-solid fa-chart-line"></i><span>Analytics</span></a></li>
                    </ul>
                </div>
            </nav>
        </aside>

        <main className="main-content">

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <div className="card-icon servers-icon">
                        <i className="fa-solid fa-server"></i>
                    </div>
                    <h3>Servers</h3>
                    <p className="card-stat">0</p>
                    <p className="card-label">Active</p>
                </div>

                <div className="dashboard-card">
                    <div className="card-icon activity-icon">
                        <i className="fa-solid fa-chart-line"></i>
                    </div>
                    <h3>Users</h3>
                    <p className="card-stat">0</p>
                    <p className="card-label">Online</p>
                </div>

                <div className="dashboard-card">
                    <div className="card-icon analytics-icon">
                        <i className="fa-solid fa-gauge"></i>
                    </div>
                    <h3>Uptime</h3>
                    <p className="card-stat">100%</p>
                    <p className="card-label">Within the last 24 hours</p>
                </div>

                <div className="dashboard-card">
                    <div className="card-icon logs-icon">
                        <i className="fa-solid fa-file-alt"></i>
                    </div>
                    <h3>Commits</h3>
                    <p className="card-stat">0</p>
                    <p className="card-label">Within the last 24 hours</p>
                </div>
            </div>
        </main>
    </section>
  );
} 