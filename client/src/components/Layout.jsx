import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../api.js';
import { Icon, fmtDate } from './ui.jsx';

export function Layout({ current, onNavigate, children }) {
  const { user, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const adminNav = [
    { id: 'dashboard', label: "Umumiy ko'rinish", icon: 'dashboard' },
    { id: 'inventory', label: 'Ombor', icon: 'warehouse' },
    { id: 'parts', label: 'Katalog', icon: 'parts' },
    { id: 'workers', label: "Ishchilar", icon: 'workers' },
    { id: 'sales', label: "Sotuvlar", icon: 'sales' },
    { id: 'transfers', label: "O'tkazmalar", icon: 'transfers' },
    { id: 'categories', label: "Kategoriyalar", icon: 'categories' },
    { id: 'money', label: "Moliya", icon: 'money' },
    { id: 'audit', label: "Harakatlar jurnali", icon: 'edit' },
  ];

  const workerNav = [
    { id: 'dashboard', label: "Umumiy ko'rinish", icon: 'dashboard' },
    { id: 'my-stock', label: "Mening ehtiyot qismlarim", icon: 'box' },
    { id: 'parts', label: "Baza bo'yicha qidiruv", icon: 'search' },
    { id: 'sales', label: "Mening sotuvlarim", icon: 'money' },
    { id: 'money', label: "Pul aylanmasi", icon: 'money' },
    { id: 'transfers', label: "Mening o'tkazmalarim", icon: 'transfers' },
  ];

  const nav = isAdmin ? adminNav : workerNav;

  const initials = (user?.full_name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    if (!isAdmin) {
      API.notifications.list()
        .then((r) => setNotifs(r.data))
        .catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    function onClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  async function openNotifs() {
    setNotifOpen(!notifOpen);
    if (!notifOpen && unread > 0) {
      const ids = notifs.filter((n) => !n.read).map((n) => n.id);
      try {
        await API.notifications.read(ids);
        setNotifs((prev) => prev.map((n) => ({ ...n, read: 1 })));
      } catch {}
    }
  }

  return (
    <div className="layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <Icon name="parts" size={22} />
          </div>
          <div className="brand-text">
            <strong>ZapChast</strong>
            <span>{isAdmin ? 'Boshqaruv paneli' : 'Ish joyi'}</span>
          </div>
        </div>

        <div className="nav-label">{isAdmin ? "Bo'limlar" : 'Menyu'}</div>
        <nav className="nav">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${current === item.id ? 'active' : ''}`}
              onClick={() => {
                onNavigate(item.id);
                setMenuOpen(false);
              }}
            >
              <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
              <span>{item.label}</span>
              {current === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <div className="user-name">{user?.full_name}</div>
              <div className="user-role">
                {isAdmin ? 'Administrator' : (user?.city || 'Ishchi')}
              </div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <Icon name="logout" size={16} />
            <span>Chiqish</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menyu">
            <Icon name="menu" size={20} />
          </button>
          <div className="topbar-title">{nav.find((n) => n.id === current)?.label || ''}</div>
          <div className="topbar-spacer" />

          {!isAdmin && (
            <div className="notif-wrap" ref={notifRef}>
              <button className="icon-btn" onClick={openNotifs} aria-label="Bildirishnomalar">
                <Icon name="alert" size={20} />
                {unread > 0 && <span className="notif-badge">{unread}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-head">Bildirishnomalar</div>
                  {notifs.length === 0 ? (
                    <div className="notif-empty">Bildirishnomalar yo'q</div>
                  ) : (
                    notifs.slice(0, 15).map((n) => (
                      <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-date">{fmtDate(n.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="topbar-user">
            <div className="avatar avatar-sm">{initials}</div>
            <div className="topbar-user-meta">
              <span className="topbar-name">{user?.full_name}</span>
              <span className="topbar-role">{isAdmin ? 'Administrator' : 'Ishchi'}</span>
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
