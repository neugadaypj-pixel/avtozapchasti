import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, StatCard, fmtMoney, fmtDate, useToast, Select } from '../components/ui.jsx';

export function OrdersPage() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [debts, setDebts] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [o, d, p] = await Promise.all([
        API.orders.list(),
        API.orders.debts(),
        API.parts.list(),
      ]);
      setOrders(o.data);
      setDebts(d.data);
      setParts(p.data);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createOrder(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const supplier = fd.get('supplier');
    // Собираем позиции из полей part_id_0..N
    const items = [];
    let i = 0;
    while (fd.get(`part_id_${i}`)) {
      items.push({
        part_id: Number(fd.get(`part_id_${i}`)),
        expected_quantity: Number(fd.get(`expected_${i}`)),
      });
      i++;
    }
    if (items.length === 0) {
      toast(t('orders.add_item'), 'error');
      return;
    }
    try {
      await API.orders.create({ supplier, items });
      toast(t('orders.new'), 'success');
      setShowNew(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function confirmArrival(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = confirmOrder.items.map((it) => ({
      part_id: it.part_id,
      actual_quantity: Number(fd.get(`actual_${it.part_id}`)),
    }));
    try {
      const r = await API.orders.confirm(confirmOrder.id, { items });
      toast(`${t('orders.received')}: ${fmtMoney(r.data.shortage_cost)} ${t('orders.shortage')}`, 'success');
      setConfirmOrder(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (loading) return <Spinner />;

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('orders.title')}</h2>
          <p className="muted">{isAdmin ? t('orders.confirm_arrival_hint') : ''}</p>
        </div>
        {isAdmin && <Button onClick={() => setShowNew(true)}>+ {t('orders.new')}</Button>}
      </div>

      {/* Долги поставщиков */}
      <div className="stats-grid">
        <StatCard icon="alert" label={t('orders.debt_amount')} value={fmtMoney(totalDebt)} tone={totalDebt > 0 ? 'danger' : ''} />
        <StatCard icon="warehouse" label={t('orders.pending')} value={pendingOrders.length} />
      </div>

      {debts.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>{t('orders.debts')}</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>{t('orders.supplier_debt')}</th><th>{t('orders.debt_amount')}</th></tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <tr key={d.supplier}>
                    <td className="list-title">{d.supplier}</td>
                    <td className="nowrap"><Badge tone="danger">{fmtMoney(d.amount)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Список заказов */}
      {orders.length === 0 ? (
        <Empty title={t('orders.title')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('orders.supplier')}</th>
                <th>{t('orders.items')}</th>
                <th>{t('common.status')}</th>
                <th>{t('orders.shortage')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="muted nowrap">{fmtDate(o.created_at)}</td>
                  <td className="list-title">{o.supplier}</td>
                  <td>
                    <div className="worker-list">
                      {o.items.map((it, i) => (
                        <div className="worker-chip" key={i}>
                          {it.part_name || `#${it.part_id}`}: <strong>{it.actual_quantity ?? it.expected_quantity}</strong>/{it.expected_quantity}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge tone={o.status === 'received' ? 'success' : 'warn'}>
                      {o.status === 'received' ? t('orders.received') : t('orders.pending')}
                    </Badge>
                  </td>
                  <td className="nowrap">
                    {o.shortage_cost > 0 ? <Badge tone="danger">{fmtMoney(o.shortage_cost)}</Badge> : '—'}
                  </td>
                  <td className="text-right">
                    {isAdmin && o.status === 'pending' && (
                      <Button variant="success" size="sm" onClick={() => setConfirmOrder(o)}>
                        {t('orders.confirm_arrival')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Новый заказ */}
      <Modal open={showNew} title={t('orders.new')} onClose={() => setShowNew(false)} wide>
        <NewOrderForm parts={parts} t={t} onCancel={() => setShowNew(false)} onSubmit={createOrder} />
      </Modal>

      {/* Подтверждение прихода */}
      <Modal open={!!confirmOrder} title={t('orders.confirm_arrival')} onClose={() => setConfirmOrder(null)}>
        {confirmOrder && (
          <form onSubmit={confirmArrival} className="form-grid">
            <p className="muted" style={{ gridColumn: '1/-1' }}>
              <strong>{confirmOrder.supplier}</strong> — {t('orders.confirm_arrival_hint')}
            </p>
            {confirmOrder.items.map((it) => (
              <Field key={it.part_id} label={`${it.part_name} (${t('orders.expected')}: ${it.expected_quantity})`} required>
                <input
                  name={`actual_${it.part_id}`}
                  type="number"
                  min="0"
                  className="input"
                  defaultValue={it.expected_quantity}
                  required
                />
              </Field>
            ))}
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setConfirmOrder(null)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('orders.confirm')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function NewOrderForm({ parts, t, onCancel, onSubmit }) {
  const [items, setItems] = useState([{ part_id: '', expected_quantity: 1 }]);

  function addItem() {
    setItems([...items, { part_id: '', expected_quantity: 1 }]);
  }

  function updateItem(idx, field, value) {
    const copy = [...items];
    copy[idx][field] = value;
    setItems(copy);
  }

  function removeItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <form onSubmit={onSubmit} className="form-grid">
      <Field label={t('orders.supplier')} required>
        <input name="supplier" className="input" placeholder={t('orders.supplier')} required />
      </Field>

      <div className="order-items" style={{ gridColumn: '1/-1' }}>
        <div className="card-head"><h4>{t('orders.items')}</h4><Button type="button" variant="secondary" size="sm" onClick={addItem}>+ {t('orders.add_item')}</Button></div>
        {items.map((it, idx) => (
          <div className="order-item-row" key={idx}>
            <Select
              name={`part_id_${idx}`}
              value={it.part_id}
              onChange={(e) => updateItem(idx, 'part_id', e.target.value)}
              placeholder={t('orders.select_part')}
              required
            >
              <option value="">{t('orders.select_part')}</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
              ))}
            </Select>
            <input
              className="input"
              type="number"
              name={`expected_${idx}`}
              min="1"
              value={it.expected_quantity}
              onChange={(e) => updateItem(idx, 'expected_quantity', e.target.value)}
              placeholder={t('orders.expected')}
              required
            />
            {items.length > 1 && (
              <Button type="button" variant="danger" size="sm" onClick={() => removeItem(idx)}>×</Button>
            )}
          </div>
        ))}
      </div>

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit">{t('orders.confirm')}</Button>
      </div>
    </form>
  );
}
