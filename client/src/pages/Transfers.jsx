import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Empty, Spinner, Badge, fmtDate, useToast } from '../components/ui.jsx';

const typeTones = {
  assign: 'info',
  return: 'warn',
  restock: 'success',
};

export function TransfersPage() {
  const { isAdmin, user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await API.transfers.list();
      setTransfers(r.data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function confirmReceipt(id) {
    if (!confirm(t('transfer.confirm_receipt') + '?')) return;
    try {
      await API.transfers.confirm(id);
      toast(t('transfer.received'), 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function typeLabel(type) {
    if (type === 'assign') return t('transfer.assign');
    if (type === 'return') return t('transfer.return');
    if (type === 'restock') return t('transfer.restock');
    return type;
  }

  function locationLabel(tr) {
    if (tr.type === 'restock') return `${t('transfer.supplier')} → ${t('transfer.warehouse')}`;
    if (tr.type === 'return') return `${tr.from_name || t('transfer.worker')} → ${t('transfer.warehouse')}`;
    if (tr.type === 'assign') {
      const from = tr.from_type === 'warehouse' ? t('transfer.warehouse') : (tr.from_name || t('transfer.worker'));
      const to = tr.to_type === 'worker' ? (tr.to_name || t('transfer.worker')) : t('transfer.warehouse');
      return `${from} → ${to}`;
    }
    return '—';
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <Spinner />;

  const pendingForMe = transfers.filter(
    (tr) => tr.type === 'assign' && tr.to_worker_id === user?.id && tr.status === 'pending'
  );

  return (
    <div className="page">
      <div className="page-head">
        <h2>{isAdmin ? t('transfer.history') : t('transfer.my_history')}</h2>
        <p className="muted">{isAdmin ? t('transfer.history') : t('transfer.my_history')}</p>
      </div>

      {!isAdmin && pendingForMe.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3>{t('transfer.pending_receipt')}</h3>
            <Badge tone="warn">{pendingForMe.length}</Badge>
          </div>
          <div className="list">
            {pendingForMe.map((tr) => (
              <div className="list-row" key={tr.id}>
                <div>
                  <div className="list-title">{tr.part_name} — {tr.quantity} {t('common.pieces')}</div>
                  <div className="muted small">{fmtDate(tr.created_at)}</div>
                </div>
                <Button variant="success" size="sm" onClick={() => confirmReceipt(tr.id)}>
                  {t('transfer.received')}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {transfers.length === 0 ? (
        <Empty title={t('transfer.history')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('transfer.date')}</th>
                <th>{t('transfer.type')}</th>
                <th>{t('transfer.part')}</th>
                <th>{t('transfer.route')}</th>
                <th>{t('transfer.quantity')}</th>
                <th>{t('transfer.reason')}</th>
                <th>{t('transfer.status')}</th>
                {isAdmin && <th>{t('transfer.who')}</th>}
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr) => (
                <tr key={tr.id}>
                  <td className="muted nowrap">{fmtDate(tr.created_at)}</td>
                  <td><Badge tone={typeTones[tr.type] || 'gray'}>{typeLabel(tr.type)}</Badge></td>
                  <td className="list-title">
                    {tr.part_name}
                    {tr.sku && <div className="small muted">{tr.sku}</div>}
                  </td>
                  <td>{locationLabel(tr)}</td>
                  <td>{tr.quantity} {t('common.pieces')}</td>
                  <td className="muted">{tr.reason || '—'}</td>
                  <td>
                    {tr.type === 'assign' ? (
                      <Badge tone={tr.status === 'completed' ? 'success' : 'warn'}>
                        {tr.status === 'completed' ? t('transfer.completed') : t('transfer.pending')}
                      </Badge>
                    ) : '—'}
                  </td>
                  {isAdmin && <td className="muted">{tr.created_by_name || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
