import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Empty, Spinner, Badge, fmtDate, useToast } from '../components/ui.jsx';

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
  if (t.type === 'restock') return 'Ta\'minotchi → Ombor';
  if (t.type === 'return') return `${t.from_name || 'Ishchi'} → Ombor`;
  if (t.type === 'assign') {
    const from = t.from_type === 'warehouse' ? 'Ombor' : (t.from_name || 'Ishchi');
    const to = t.to_type === 'worker' ? (t.to_name || 'Ishchi') : 'Ombor';
    return `${from} → ${to}`;
  }
  return '—';
}

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
    if (!confirm("Tovarni qabul qildingizmi?")) return;
    try {
      await API.transfers.confirm(id);
      toast("Tovar qabul qilindi", 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <Spinner />;

  // Показываем блок ожидающих подтверждения для рабочего.
  const pendingForMe = transfers.filter(
    (tr) => tr.type === 'assign' && tr.to_worker_id === user?.id && tr.status === 'pending'
  );

  return (
    <div className="page">
      <div className="page-head">
        <h2>{isAdmin ? t('transfer.history') : t('transfer.my_history')}</h2>
        <p className="muted">{isAdmin ? 'Tovar harakati' : 'Siz bilan bog\'liq tovar harakati'}</p>
      </div>

      {!isAdmin && pendingForMe.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3>Qabul qilish kutilmoqda</h3>
            <Badge tone="warn">{pendingForMe.length} ta</Badge>
          </div>
          <div className="list">
            {pendingForMe.map((tr) => (
              <div className="list-row" key={tr.id}>
                <div>
                  <div className="list-title">{tr.part_name} — {tr.quantity} dona</div>
                  <div className="muted small">{fmtDate(tr.created_at)}</div>
                </div>
                <Button variant="success" size="sm" onClick={() => confirmReceipt(tr.id)}>
                  Qabul qildim
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
                <th>Sana</th>
                <th>Tur</th>
                <th>Ehtiyot qism</th>
                <th>Yo'nalish</th>
                <th>Miqdor</th>
                <th>Sabab</th>
                <th>Holat</th>
                {isAdmin && <th>Kim rasmiylashtirgan</th>}
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr) => (
                <tr key={tr.id}>
                  <td className="muted nowrap">{fmtDate(tr.created_at)}</td>
                  <td><Badge tone={typeTones[tr.type] || 'gray'}>{typeLabels[tr.type] || tr.type}</Badge></td>
                  <td className="list-title">
                    {tr.part_name}
                    {tr.sku && <div className="small muted">{tr.sku}</div>}
                  </td>
                  <td>{locationLabel(tr)}</td>
                  <td>{tr.quantity} dona</td>
                  <td className="muted">{tr.reason || '—'}</td>
                  <td>
                    {tr.type === 'assign' ? (
                      <Badge tone={tr.status === 'completed' ? 'success' : 'warn'}>
                        {tr.status === 'completed' ? 'Tasdiqlangan' : 'Kutilmoqda'}
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
