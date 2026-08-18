import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui.jsx';
import { Layout } from './components/Layout.jsx';
import { Login } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { PartsPage } from './pages/Parts.jsx';
import { MyStock } from './pages/MyStock.jsx';
import { SalesPage } from './pages/Sales.jsx';
import { TransfersPage } from './pages/Transfers.jsx';
import { InventoryPage } from './pages/Inventory.jsx';
import { WorkersPage } from './pages/Workers.jsx';
import { CategoriesPage } from './pages/Categories.jsx';
import { AuditLogPage } from './pages/AuditLog.jsx';
import { MoneyPage } from './pages/Money.jsx';
import { OrdersPage } from './pages/Orders.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isAdmin = user.role === 'admin';

  function renderPage() {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={setPage} />;
      case 'parts':
        return <PartsPage onNavigate={setPage} />;
      case 'my-stock':
        return isAdmin ? <InventoryPage /> : <MyStock onNavigate={setPage} />;
      case 'sales':
        return <SalesPage />;
      case 'transfers':
        return <TransfersPage />;
      case 'inventory':
        return isAdmin ? <InventoryPage /> : <MyStock onNavigate={setPage} />;
      case 'workers':
        return isAdmin ? <WorkersPage /> : <Dashboard onNavigate={setPage} />;
      case 'categories':
        return isAdmin ? <CategoriesPage /> : <Dashboard onNavigate={setPage} />;
      case 'audit':
        return isAdmin ? <AuditLogPage /> : <Dashboard onNavigate={setPage} />;
      case 'money':
        return <MoneyPage />;
      case 'orders':
        return <OrdersPage />;
      default:
        return <Dashboard onNavigate={setPage} />;
    }
  }

  return (
    <ToastProvider>
      <Layout current={page} onNavigate={setPage}>
        {renderPage()}
      </Layout>
    </ToastProvider>
  );
}
