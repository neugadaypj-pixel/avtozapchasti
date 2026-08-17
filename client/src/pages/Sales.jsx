import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Empty, Spinner, Badge, fmtMoney, fmtDate, Button } from '../components/ui.jsx';

export function SalesPage() {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    API.sales.list()
      .then((r) => setSales(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <Spinner />;

  const total = sales.reduce((s, x) => s + x.total, 0);

  function exportCsv() {
    const sep = ';';
    const headers = ['Дата', 'Запчасть', 'Артикул', isAdmin ? 'Рабочий' : null, 'Клиент', 'Телефон', 'Кол-во', 'Цена', 'Сумма', 'Комментарий'].filter(Boolean);
    const rows = sales.map((s) => [
      fmtDate(s.created_at),
      s.part_name,
      s.sku || '',
      isAdmin ? (s.worker_name || '') : null,
      s.client_name || '',
      s.client_phone || '',
      s.quantity,
      s.unit_price,
      s.total,
      s.note || '',
    ].filter((v) => v !== null));

    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(sep))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `продажи_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{isAdmin ? 'Продажи' : 'Мои продажи'}</h2>
          <p className="muted">
            {isAdmin ? 'Все продажи по рабочим' : 'История ваших продаж'} · Итого: <strong>{fmtMoney(total)}</strong>
          </p>
        </div>
        {sales.length > 0 && (
          <Button variant="secondary" onClick={exportCsv}>⬇ Экспорт CSV</Button>
        )}
      </div>

      {sales.length === 0 ? (
        <Empty title="Продаж пока нет" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Запчасть</th>
                {isAdmin && <th>Рабочий</th>}
                <th>Клиент</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="muted nowrap">{fmtDate(s.created_at)}</td>
                  <td className="list-title">
                    {s.part_name}
                    {s.sku && <div className="small muted">{s.sku}</div>}
                  </td>
                  {isAdmin && <td>{s.worker_name || '—'}</td>}
                  <td>
                    {s.client_name || '—'}
                    {s.client_phone && <div className="small muted">{s.client_phone}</div>}
                  </td>
                  <td>{s.quantity}</td>
                  <td className="nowrap">{fmtMoney(s.unit_price)}</td>
                  <td className="nowrap"><strong>{fmtMoney(s.total)}</strong></td>
                  <td className="muted">{s.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
