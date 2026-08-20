import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Empty, Spinner, Badge, fmtMoney, fmtDate, Button, Modal, Field, useToast, useConfirm } from '../components/ui.jsx';

const PAYMENT_LABELS = {
  cash: 'cash',
  card: 'card',
  bank: 'bank',
};

export function SalesPage() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editSale, setEditSale] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await API.sales.list();
      setSales(r.data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function confirmPayment(id) {
    if (!(await confirm(t('sales.confirm') + '?'))) return;
    try {
      await API.sales.confirm(id);
      toast(t('pay.paid'), 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.sales.update(editSale.id, {
        quantity: Number(fd.get('quantity')),
        unit_price: Number(fd.get('unit_price')),
        client_name: fd.get('client_name'),
        client_phone: fd.get('client_phone'),
        note: fd.get('note'),
        payment_type: fd.get('payment_type'),
        payment_status: fd.get('payment_status'),
      });
      toast(t('common.save'), 'success');
      setEditSale(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <Spinner />;

  const total = sales.reduce((s, x) => s + x.total, 0);

  function exportCsv() {
    const sep = ';';
    const headers = [
      t('common.date'), t('sales.product'), t('parts.sku'), isAdmin ? t('sales.worker') : null,
      t('sales.client'), t('sale.client_phone'), t('common.quantity'), t('common.price'),
      t('sales.amount'), t('sale.payment_type'), t('common.status'), t('sale.note'),
    ].filter(Boolean);
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
      t(`sale.${PAYMENT_LABELS[s.payment_type] || 'cash'}`),
      s.payment_status === 'paid' ? t('pay.paid') : t('pay.pending'),
      s.note || '',
    ].filter((v) => v !== null));

    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(sep))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function canEdit(s) {
    const hours = (new Date() - new Date(s.created_at)) / (1000 * 60 * 60);
    return hours <= 24;
  }

  function daysPending(s) {
    if (s.payment_status === 'paid') return null;
    const days = Math.floor((new Date() - new Date(s.created_at)) / (1000 * 60 * 60 * 24));
    return days;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{isAdmin ? t('sales.title_admin') : t('sales.title_worker')}</h2>
          <p className="muted">
            {isAdmin ? t('sales.subtitle_admin') : t('sales.subtitle_worker')} · {t('common.total')}: <strong>{fmtMoney(total)}</strong>
          </p>
        </div>
        {sales.length > 0 && (
          <Button variant="secondary" onClick={exportCsv}>⬇ {t('sales.export')}</Button>
        )}
      </div>

      {sales.length === 0 ? (
        <Empty title={t('sales.no_sales')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('sales.product')}</th>
                {isAdmin && <th>{t('sales.worker')}</th>}
                <th>{t('sales.client')}</th>
                <th>{t('common.quantity')}</th>
                <th>{t('common.price')}</th>
                <th>{t('sales.amount')}</th>
                <th>{t('sale.payment_type')}</th>
                <th></th>
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
                  <td>
                    <Badge tone={s.payment_status === 'paid' ? 'success' : 'warn'}>
                      {t(`sale.${PAYMENT_LABELS[s.payment_type] || 'cash'}`)}
                      {' · '}
                      {s.payment_status === 'paid' ? t('pay.paid') : t('pay.pending')}
                      {daysPending(s) > 0 && ` · ${daysPending(s)}d`}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      {s.payment_status === 'pending' && (
                        <Button variant="success" size="sm" onClick={() => confirmPayment(s.id)}>{t('pay.paid')}</Button>
                      )}
                      {canEdit(s) && (
                        <Button variant="secondary" size="sm" onClick={() => setEditSale(s)}>✏️</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editSale} title={t('sales.edit')} onClose={() => setEditSale(null)}>
        {editSale && (
          <form onSubmit={saveEdit} className="form-grid">
            <Field label={t('sale.quantity')} required>
              <input name="quantity" type="number" min="1" className="input" defaultValue={editSale.quantity} required />
            </Field>
            <Field label={t('sale.unit_price')} required>
              <input name="unit_price" type="number" min="0" className="input" defaultValue={editSale.unit_price} required />
            </Field>
            <Field label={t('sale.client')}>
              <input name="client_name" className="input" defaultValue={editSale.client_name || ''} />
            </Field>
            <Field label={t('sale.client_phone')}>
              <input name="client_phone" className="input" defaultValue={editSale.client_phone || ''} />
            </Field>
            <Field label={t('sale.note')}>
              <input name="note" className="input" defaultValue={editSale.note || ''} />
            </Field>
            <Field label={t('sale.payment_type')} required>
              <select name="payment_type" className="input select" defaultValue={editSale.payment_type} required>
                <option value="cash">{t('sale.cash')}</option>
                <option value="card">{t('sale.card')}</option>
                <option value="bank">{t('sale.bank')}</option>
              </select>
            </Field>
            <Field label={t('common.status')} required>
              <select name="payment_status" className="input select" defaultValue={editSale.payment_status} required>
                <option value="paid">{t('pay.paid')}</option>
                <option value="pending">{t('pay.pending')}</option>
              </select>
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setEditSale(null)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
