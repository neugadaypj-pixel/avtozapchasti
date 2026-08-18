import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { Icon, fmtDate } from './ui.jsx';

export function Layout({ current, onNavigate, children }) {
  const { user, isAdmin, logout } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const adminNav = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
    { id: 'inventory', label: t('nav.inventory'), icon: 'warehouse' },
    { id: 'orders', label: t('orders.title'), icon: 'transfers' },
    { id: 'parts', label: t('nav.parts'), icon: 'parts' },
    { id: 'workers', label: t('nav.workers'), icon: 'workers' },
    { id: 'sales', label: t('nav.sales'), icon: 'sales' },
    { id: 'transfers', label: t('nav.transfers'), icon: 'transfers' },
    { id: 'categories', label: t('nav.categories'), icon: 'categories' },
    { id: 'money', label: t('nav.money'), icon: 'money' },
    { id: 'audit', label: t('nav.audit'), icon: 'edit' },
  ];

  const workerNav = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
    { id: 'my-stock', label: t('nav.mystock'), icon: 'box' },
    { id: 'parts', label: t('nav.search'), icon: 'search' },
    { id: 'sales', label: t('nav.mysales'), icon: 'money' },
    { id: 'money', label: t('nav.mymoney'), icon: 'money' },
    { id: 'transfers', label: t('nav.mytransfers'), icon: 'transfers' },
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
            <strong>{t('app.name')}</strong>
            <span>{isAdmin ? t('nav.admin_panel') : t('nav.workplace')}</span>
          </div>
        </div>

        <div className="nav-label">{isAdmin ? t('nav.sections') : t('nav.menu')}</div>
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
                {isAdmin ? t('role.admin') : (user?.city || t('role.worker'))}
              </div>
            </div>
          </div>
          <button className="btn-logout" onClick={toggleLang}>
            <Icon name="edit" size={16} />
            <span>{lang === 'uz' ? 'Русский' : "O'zbekcha"}</span>
          </button>
          <button className="btn-logout" onClick={logout}>
            <Icon name="logout" size={16} />
            <span>{t('nav.logout')}</span>
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

          <button className="icon-btn" onClick={toggleLang} title="Til">
            <span style={{ fontSize: 13, fontWeight: 600 }}>{lang === 'uz' ? 'RU' : 'UZ'}</span>
          </button>

          {!isAdmin && (
            <div className="notif-wrap" ref={notifRef}>
              <button className="icon-btn" onClick={openNotifs} aria-label="Bildirishnomalar">
                <Icon name="alert" size={20} />
                {unread > 0 && <span className="notif-badge">{unread}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-head">{t('nav.notifications')}</div>
                  {notifs.length === 0 ? (
                    <div className="notif-empty">{t('nav.no_notifications')}</div>
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
              <span className="topbar-role">{isAdmin ? t('role.admin') : t('role.worker')}</span>
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
