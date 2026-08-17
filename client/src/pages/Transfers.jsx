import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Empty, Spinner, Badge, fmtDate } from '../components/ui.jsx';

const typeLabels = {
  assign: 'Передача',
  return: 'Возврат',
  restock: 'Приход',
};

const typeTones = {
  assign: 'info',
  return: 'warn',
  restock: 'success',
};

function locationLabel(t) {
  if (t.type === 'restock') return 'Поставщик → Склад';
  if (t.type === 'return') return `${t.from_name || 'Рабочий'} → Склад`;
  if (t.type === 'assign') {
    const from = t.from_type === 'warehouse' ? 'Склад' : (t.from_name || 'Рабочий');
    const to = t.to_type === 'worker' ? (t.to_name || 'Рабочий') : 'Склад';
    return `${from} → ${to}`;
  }
  return '—';
}

export function TransfersPage() {
  const { isAdmin } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    API.transfers.list()
      .then((r) => setTransfers(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <Spinner />;

  return (
    <div className="page">
      <div className="page-head">
        <h2>{isAdmin ? 'История передач' : 'Мои передачи'}</h2>
        <p className="muted">{isAdmin ? 'Все движения товара' : 'Движения товара, связанные с вами'}</p>
      </div>

      {transfers.length === 0 ? (
        <Empty title="Передач пока нет" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Запчасть</th>
                <th>Маршрут</th>
                <th>Кол-во</th>
                <th>Причина</th>
                {isAdmin && <th>Кто оформил</th>}
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td className="muted nowrap">{fmtDate(t.created_at)}</td>
                  <td><Badge tone={typeTones[t.type] || 'gray'}>{typeLabels[t.type] || t.type}</Badge></td>
                  <td className="list-title">
                    {t.part_name}
                    {t.sku && <div className="small muted">{t.sku}</div>}
                  </td>
                  <td>{locationLabel(t)}</td>
                  <td>{t.quantity} шт.</td>
                  <td className="muted">{t.reason || '—'}</td>
                  {isAdmin && <td className="muted">{t.created_by_name || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
