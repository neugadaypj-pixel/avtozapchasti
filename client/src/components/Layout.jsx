import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './ui.jsx';

export function Layout({ current, onNavigate, children }) {
  const { user, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const adminNav = [
    { id: 'dashboard', label: 'Обзор', icon: 'dashboard' },
    { id: 'inventory', label: 'Склад', icon: 'warehouse' },
    { id: 'parts', label: 'Каталог', icon: 'parts' },
    { id: 'workers', label: 'Рабочие', icon: 'workers' },
    { id: 'sales', label: 'Продажи', icon: 'sales' },
    { id: 'transfers', label: 'Передачи', icon: 'transfers' },
    { id: 'categories', label: 'Категории', icon: 'categories' },
  ];

  const workerNav = [
    { id: 'dashboard', label: 'Обзор', icon: 'dashboard' },
    { id: 'my-stock', label: 'Мои запчасти', icon: 'box' },
    { id: 'parts', label: 'Поиск по базе', icon: 'search' },
    { id: 'sales', label: 'Мои продажи', icon: 'money' },
    { id: 'transfers', label: 'Мои передачи', icon: 'transfers' },
  ];

  const nav = isAdmin ? adminNav : workerNav;

  const initials = (user?.full_name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <Icon name="parts" size={22} />
          </div>
          <div className="brand-text">
            <strong>ZapChast</strong>
            <span>{isAdmin ? 'Панель управления' : 'Рабочее место'}</span>
          </div>
        </div>

        <div className="nav-label">{isAdmin ? 'Разделы' : 'Меню'}</div>
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
                {isAdmin ? 'Администратор' : (user?.city || 'Рабочий')}
              </div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <Icon name="logout" size={16} />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
            <Icon name="menu" size={20} />
          </button>
          <div className="topbar-title">{nav.find((n) => n.id === current)?.label || ''}</div>
          <div className="topbar-spacer" />
          <div className="topbar-user">
            <div className="avatar avatar-sm">{initials}</div>
            <div className="topbar-user-meta">
              <span className="topbar-name">{user?.full_name}</span>
              <span className="topbar-role">{isAdmin ? 'Администратор' : 'Рабочий'}</span>
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
