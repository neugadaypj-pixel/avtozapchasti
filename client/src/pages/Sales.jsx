import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Empty, Spinner, Badge, fmtMoney, fmtDate, Button, Modal, Field, useToast } from '../components/ui.jsx';

const PAYMENT_LABELS = {
  cash: "Naqd pul",
  card: "Karta",
  bank: "Bank",
};

export function SalesPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
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
    if (!confirm("To'lov qabul qilindi deb tasdiqlaysizmi?")) return;
    try {
      await API.sales.confirm(id);
      toast("To'lov tasdiqlandi", 'success');
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
      toast("Sotuv yangilandi", 'success');
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
    const headers = ['Sana', 'Mahsulot', 'Artikul', isAdmin ? 'Ishchi' : null, 'Mijoz', 'Telefon', 'Miqdor', 'Narx', 'Summa', "To'lov turi", "To'lov holati", 'Izoh'].filter(Boolean);
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
      PAYMENT_LABELS[s.payment_type] || s.payment_type,
      s.payment_status === 'paid' ? "To'langan" : 'Kutilmoqda',
      s.note || '',
    ].filter((v) => v !== null));

    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(sep))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sotuvlar_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function canEdit(s) {
    const hours = (new Date() - new Date(s.created_at)) / (1000 * 60 * 60);
    return hours <= 24;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{isAdmin ? 'Sotuvlar' : 'Mening sotuvlarim'}</h2>
          <p className="muted">
            {isAdmin ? "Barcha ishchilar bo'yicha sotuvlar" : 'Sotuvlaringiz tarixi'} · Jami: <strong>{fmtMoney(total)}</strong>
          </p>
        </div>
        {sales.length > 0 && (
          <Button variant="secondary" onClick={exportCsv}>⬇ CSV eksport</Button>
        )}
      </div>

      {sales.length === 0 ? (
        <Empty title="Sotuvlar yo'q" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Mahsulot</th>
                {isAdmin && <th>Ishchi</th>}
                <th>Mijoz</th>
                <th>Miqdor</th>
                <th>Narx</th>
                <th>Summa</th>
                <th>To'lov</th>
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
                      {PAYMENT_LABELS[s.payment_type] || s.payment_type}
                      {' · '}
                      {s.payment_status === 'paid' ? "to'langan" : 'kutilmoqda'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      {s.payment_status === 'pending' && (
                        <Button variant="success" size="sm" onClick={() => confirmPayment(s.id)}>To'landi</Button>
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

      {/* Редактирование продажи */}
      <Modal open={!!editSale} title="Sotuvni tahrirlash" onClose={() => setEditSale(null)}>
        {editSale && (
          <form onSubmit={saveEdit} className="form-grid">
            <Field label="Miqdor" required>
              <input name="quantity" type="number" min="1" className="input" defaultValue={editSale.quantity} required />
            </Field>
            <Field label="Bir dona narxi" required>
              <input name="unit_price" type="number" min="0" className="input" defaultValue={editSale.unit_price} required />
            </Field>
            <Field label="Mijoz">
              <input name="client_name" className="input" defaultValue={editSale.client_name || ''} />
            </Field>
            <Field label="Mijoz telefoni">
              <input name="client_phone" className="input" defaultValue={editSale.client_phone || ''} />
            </Field>
            <Field label="Izoh">
              <input name="note" className="input" defaultValue={editSale.note || ''} />
            </Field>
            <Field label="To'lov turi" required>
              <select name="payment_type" className="input select" defaultValue={editSale.payment_type} required>
                <option value="cash">Naqd pul</option>
                <option value="card">Karta</option>
                <option value="bank">Bank</option>
              </select>
            </Field>
            <Field label="To'lov holati" required>
              <select name="payment_status" className="input select" defaultValue={editSale.payment_status} required>
                <option value="paid">To'langan</option>
                <option value="pending">Kutilmoqda</option>
              </select>
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setEditSale(null)}>Bekor qilish</Button>
              <Button type="submit">Saqlash</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
