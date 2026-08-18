import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { StatCard, Empty, Spinner, Badge, fmtMoney, useToast, Button } from '../components/ui.jsx';

export function StatsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await API.stats.list();
      setData(r.data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function autoOrder() {
    if (!data || data.low_stock.length === 0) return;
    if (!confirm(t('stats.auto_order') + '?')) return;
    try {
      const items = data.low_stock.map((p) => ({
        part_id: p.part_id,
        expected_quantity: p.recommended,
      }));
      await API.orders.create({ supplier: 'Auto-order', items });
      toast(t('orders.new'), 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <Spinner />;

  const { daily, monthly, by_city, top_parts, low_stock, summary } = data;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('stats.title')}</h2>
          <p className="muted">{t('stats.subtitle')}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="money" label={t('stats.total_revenue')} value={fmtMoney(summary.total_revenue)} />
        <StatCard icon="sales" label={t('stats.total_profit')} value={fmtMoney(summary.total_profit)} tone={summary.total_profit >= 0 ? 'success' : 'danger'} />
        <StatCard icon="warehouse" label={t('stats.total_purchase')} value={fmtMoney(summary.total_purchase)} />
        <StatCard icon="box" label={t('stats.total_sales')} value={summary.total_sales} />
        <StatCard icon="alert" label={t('stats.low_stock')} value={summary.low_stock_count} tone={summary.low_stock_count > 0 ? 'warn' : ''} />
      </div>

      <div className="dashboard-main">
        <section className="card">
          <div className="card-head"><h3>{t('stats.daily')}</h3></div>
          <Chart data={daily.map((d) => ({ label: d.day.slice(5), value: d.total }))} />
        </section>
        <section className="card">
          <div className="card-head"><h3>{t('stats.by_city')}</h3></div>
          {by_city.length === 0 ? <Empty title={t('stats.no_data')} /> : (
            <div className="list">
              {by_city.map((c) => (
                <div className="list-row" key={c.city}>
                  <span>{c.city}</span>
                  <strong>{fmtMoney(c.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <section className="card">
          <div className="card-head"><h3>{t('stats.top_parts')}</h3></div>
          {top_parts.length === 0 ? <Empty title={t('stats.no_data')} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>{t('parts.name')}</th><th>{t('stats.quantity')}</th><th>{t('stats.profit')}</th></tr>
                </thead>
                <tbody>
                  {top_parts.map((p) => (
                    <tr key={p.part_id}>
                      <td className="list-title">{p.name}</td>
                      <td>{p.quantity}</td>
                      <td className="nowrap"><Badge tone={p.profit >= 0 ? 'success' : 'danger'}>{fmtMoney(p.profit)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>{t('stats.low_stock')}</h3>
            {low_stock.length > 0 && (
              <Button variant="warning" size="sm" onClick={autoOrder}>{t('stats.auto_order')}</Button>
            )}
          </div>
          {low_stock.length === 0 ? <Empty title={t('stats.no_data')} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>{t('parts.name')}</th><th>{t('stats.quantity')}</th><th>{t('stats.recommended')}</th></tr>
                </thead>
                <tbody>
                  {low_stock.map((p) => (
                    <tr key={p.part_id}>
                      <td className="list-title">{p.name}</td>
                      <td><Badge tone="warn">{p.quantity}</Badge></td>
                      <td>{p.recommended}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>{t('stats.monthly')}</h3></div>
        <Chart data={monthly.map((m) => ({ label: m.month, value: m.total }))} />
      </section>
    </div>
  );
}

function Chart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart" style={{ height: 180 }}>
      {data.map((d, i) => (
        <div className="chart-col" key={i} title={`${d.label}: ${fmtMoney(d.value)}`}>
          <div className="chart-bar" style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }} />
          <div className="chart-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}
