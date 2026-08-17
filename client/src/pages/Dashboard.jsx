import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatCard, Empty, Spinner, fmtMoney, fmtDate, Badge } from '../components/ui.jsx';

export function Dashboard({ onNavigate }) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.dashboard()
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;

  const { stats, my_stock, recent_sales, sales_by_day, top_workers } = data;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{isAdmin ? 'Обзор' : 'Мой кабинет'}</h2>
          <p className="muted">{isAdmin ? 'Состояние склада и продаж' : 'Ваши показатели и товар'}</p>
        </div>
      </div>

      <div className="stats-grid">
        {isAdmin ? (
          <>
            <StatCard icon="parts" label="Запчастей в базе" value={stats.total_parts} />
            <StatCard icon="warehouse" label="На складе" value={stats.warehouse_quantity} sub={`шт.`} />
            <StatCard icon="workers" label="У рабочих" value={stats.workers_quantity} sub={`${stats.workers_count} рабочих`} />
            <StatCard icon="alert" label="Мало остатков" value={stats.low_stock_count} tone={stats.low_stock_count > 0 ? 'warn' : ''} />
            <StatCard icon="money" label="Продано сегодня" value={fmtMoney(stats.sales_today.s)} sub={`${stats.sales_today.c} продаж`} />
            <StatCard icon="sales" label="Продано за месяц" value={fmtMoney(stats.sales_month.s)} sub={`${stats.sales_month.c} продаж`} />
          </>
        ) : (
          <>
            <StatCard icon="box" label="Моих позиций" value={my_stock ? my_stock.length : 0} />
            <StatCard icon="warehouse" label="Моих единиц" value={my_stock ? my_stock.reduce((s, x) => s + x.quantity, 0) : 0} />
            <StatCard icon="money" label="Мои продажи (месяц)" value={fmtMoney(stats.sales_month.s)} sub={`${stats.sales_month.c} продаж`} />
            <StatCard icon="sales" label="Продано сегодня" value={fmtMoney(stats.sales_today.s)} />
          </>
        )}
      </div>

      <div className="dashboard-main">
        <section className="card">
          <div className="card-head">
            <h3>Продажи за 7 дней</h3>
          </div>
          <SalesChart data={sales_by_day} />
        </section>

        {isAdmin && (
          <section className="card">
            <div className="card-head">
              <h3>Топ рабочих за месяц</h3>
            </div>
            {top_workers.length === 0 || top_workers.every((w) => w.total === 0) ? (
              <Empty title="Продаж пока нет" />
            ) : (
              <div className="list">
                {top_workers.map((w, i) => (
                  <div className="list-row" key={w.id}>
                    <div className="rank-row">
                      <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                      <div>
                        <div className="list-title">{w.full_name}</div>
                        <div className="muted small">{w.city || '—'} · {w.count} продаж</div>
                      </div>
                    </div>
                    <strong>{fmtMoney(w.total)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h3>{isAdmin ? 'Последние продажи' : 'Мои последние продажи'}</h3>
            <button className="link" onClick={() => onNavigate('sales')}>Все →</button>
          </div>
          {recent_sales.length === 0 ? (
            <Empty title="Продаж пока нет" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Запчасть</th>
                  {isAdmin && <th>Рабочий</th>}
                  <th>Кол-во</th>
                  <th>Сумма</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {recent_sales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.part_name}</td>
                    {isAdmin && <td>{s.worker_name || '—'}</td>}
                    <td>{s.quantity}</td>
                    <td className="nowrap">{fmtMoney(s.total)}</td>
                    <td className="muted nowrap">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {!isAdmin && (
          <section className="card">
            <div className="card-head">
              <h3>Мои запчасти</h3>
              <button className="link" onClick={() => onNavigate('my-stock')}>Все →</button>
            </div>
            {!my_stock || my_stock.length === 0 ? (
              <Empty title="У вас пока нет запчастей" />
            ) : (
              <div className="list">
                {my_stock.slice(0, 8).map((x, i) => (
                  <div className="list-row" key={i}>
                    <div>
                      <div className="list-title">{x.name}</div>
                      <div className="muted small">{x.sku || '—'} · {x.category_name || 'Без категории'}</div>
                    </div>
                    <Badge tone={x.quantity <= 3 ? 'warn' : 'success'}>{x.quantity} шт.</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- Простой SVG-график продаж за 7 дней ---------- */
function SalesChart({ data }) {
  const rows = useMemo(() => {
    const map = new Map();
    (data || []).forEach((d) => map.set(d.day, d.total));
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, label: d.toLocaleDateString('ru-RU', { weekday: 'short' }), total: map.get(key) || 0 });
    }
    return out;
  }, [data]);

  const max = Math.max(1, ...rows.map((r) => r.total));
  const hasData = rows.some((r) => r.total > 0);

  return (
    <div className="chart">
      {rows.map((r, i) => {
        const h = Math.round((r.total / max) * 100);
        return (
          <div className="chart-col" key={r.day} title={`${r.label}: ${fmtMoney(r.total)}`}>
            <div className="chart-val">{r.total > 0 ? fmtMoney(r.total) : ''}</div>
            <div className="chart-bar-wrap">
              <div className="chart-bar" style={{ height: `${Math.max(4, h)}%` }} />
            </div>
            <div className="chart-label">{r.label}</div>
          </div>
        );
      })}
      {!hasData && <div className="chart-empty">Нет данных за последние 7 дней</div>}
    </div>
  );
}
