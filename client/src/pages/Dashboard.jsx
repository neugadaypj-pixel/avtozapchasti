import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { StatCard, Empty, Spinner, fmtMoney, fmtDate, Badge } from '../components/ui.jsx';

export function Dashboard({ onNavigate }) {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
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
          <h2>{isAdmin ? t('dash.title_admin') : t('dash.title_worker')}</h2>
          <p className="muted">{isAdmin ? t('dash.subtitle_admin') : t('dash.subtitle_worker')}</p>
        </div>
      </div>

      <div className="stats-grid">
        {isAdmin ? (
          <>
            <StatCard icon="parts" label={t('dash.total_parts')} value={stats.total_parts} />
            <StatCard icon="warehouse" label={t('dash.warehouse')} value={stats.warehouse_quantity} sub={`${t('common.pieces')}`} />
            <StatCard icon="workers" label={t('dash.workers')} value={stats.workers_quantity} sub={`${stats.workers_count} ${t('role.worker').toLowerCase()}`} />
            <StatCard icon="alert" label={t('dash.low_stock')} value={stats.low_stock_count} tone={stats.low_stock_count > 0 ? 'warn' : ''} />
            <StatCard icon="money" label={t('dash.sold_today')} value={fmtMoney(stats.sales_today.s)} sub={`${stats.sales_today.c} ${t('nav.sales').toLowerCase()}`} />
            <StatCard icon="sales" label={t('dash.sold_month')} value={fmtMoney(stats.sales_month.s)} sub={`${stats.sales_month.c} ${t('nav.sales').toLowerCase()}`} />
          </>
        ) : (
          <>
            <StatCard icon="box" label={t('dash.my_positions')} value={my_stock ? my_stock.length : 0} />
            <StatCard icon="warehouse" label={t('dash.my_units')} value={my_stock ? my_stock.reduce((s, x) => s + x.quantity, 0) : 0} />
            <StatCard icon="money" label={t('dash.my_sales_month')} value={fmtMoney(stats.sales_month.s)} sub={`${stats.sales_month.c} ${t('nav.sales').toLowerCase()}`} />
            <StatCard icon="sales" label={t('dash.sold_today')} value={fmtMoney(stats.sales_today.s)} />
          </>
        )}
      </div>

      <div className="dashboard-main">
        <section className="card">
          <div className="card-head">
            <h3>{t('dash.sales_7days')}</h3>
          </div>
          <SalesChart data={sales_by_day} />
        </section>

        {isAdmin && (
          <section className="card">
            <div className="card-head">
              <h3>{t('dash.top_workers')}</h3>
            </div>
            {top_workers.length === 0 || top_workers.every((w) => w.total === 0) ? (
              <Empty title={t('dash.no_sales')} />
            ) : (
              <div className="list">
                {top_workers.map((w, i) => (
                  <div className="list-row" key={w.id}>
                    <div className="rank-row">
                      <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                      <div>
                        <div className="list-title">{w.full_name}</div>
                        <div className="muted small">{w.city || '—'} · {w.count} {t('dash.sales_count')}</div>
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
            <h3>{isAdmin ? t('dash.recent_sales') : t('dash.my_recent_sales')}</h3>
            <button className="link" onClick={() => onNavigate('sales')}>{t('common.all')} →</button>
          </div>
          {recent_sales.length === 0 ? (
            <Empty title={t('dash.no_sales')} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('sales.product')}</th>
                  {isAdmin && <th>{t('sales.worker')}</th>}
                  <th>{t('common.quantity')}</th>
                  <th>{t('sales.amount')}</th>
                  <th>{t('common.date')}</th>
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
              <h3>{t('dash.my_parts')}</h3>
              <button className="link" onClick={() => onNavigate('my-stock')}>{t('common.all')} →</button>
            </div>
            {!my_stock || my_stock.length === 0 ? (
              <Empty title={t('dash.no_parts')} />
            ) : (
              <div className="list">
                {my_stock.slice(0, 8).map((x, i) => (
                  <div className="list-row" key={i}>
                    <div>
                      <div className="list-title">{x.name}</div>
                      <div className="muted small">{x.sku || '—'} · {x.category_name || t('common.none')}</div>
                    </div>
                    <Badge tone={x.quantity <= 3 ? 'warn' : 'success'}>{x.quantity} {t('common.pieces')}</Badge>
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
  const { t } = useI18n();
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
      {!hasData && <div className="chart-empty">{t('dash.no_chart_data')}</div>}
    </div>
  );
}
