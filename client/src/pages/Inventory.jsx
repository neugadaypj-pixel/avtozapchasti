import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, useToast, Select } from '../components/ui.jsx';

export function InventoryPage() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [parts, setParts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [assignModal, setAssignModal] = useState(null);
  const [restockModal, setRestockModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [sellModal, setSellModal] = useState(null);
  const [editStockModal, setEditStockModal] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [pr, wr] = await Promise.all([
        API.parts.list({ search }),
        API.users.list(),
      ]);
      setParts(pr.data);
      setWorkers(wr.data.filter((u) => u.role === 'worker' && u.is_active));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function doAssign(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.transfers.assign({
        part_id: Number(fd.get('part_id')),
        to_worker_id: Number(fd.get('to_worker_id')),
        quantity: Number(fd.get('quantity')),
        reason: fd.get('reason'),
      });
      toast(t('inv.assigned'), 'success');
      setAssignModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function doRestock(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.transfers.restock({
        part_id: Number(fd.get('part_id')),
        expected_quantity: Number(fd.get('expected_quantity')),
        actual_quantity: Number(fd.get('actual_quantity')),
        purchase_cost: Number(fd.get('purchase_cost') || 0),
        reason: fd.get('reason'),
      });
      toast(t('inv.restock_done'), 'success');
      setRestockModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function doTransfer(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.transfers.workerTransfer({
        part_id: Number(fd.get('part_id')),
        from_worker_id: Number(fd.get('from_worker_id')),
        to_worker_id: Number(fd.get('to_worker_id')),
        quantity: Number(fd.get('quantity')),
        reason: fd.get('reason'),
      });
      toast(t('inv.transfer_done'), 'success');
      setTransferModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function doSetStock(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.parts.setStock(
        Number(fd.get('part_id')),
        Number(fd.get('warehouse_quantity'))
      );
      toast(t('inv.stock_saved'), 'success');
      setEditStockModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function doSell(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.sales.create({
        part_id: Number(fd.get('part_id')),
        quantity: Number(fd.get('quantity')),
        unit_price: Number(fd.get('unit_price')),
        client_name: fd.get('client_name'),
        client_phone: fd.get('client_phone'),
        note: fd.get('note'),
        payment_type: fd.get('payment_type'),
        payment_status: fd.get('payment_status'),
      });
      toast(t('inv.sold'), 'success');
      setSellModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>{t('inv.title')}</h2>
        <p className="muted">{t('inv.subtitle')}</p>
      </div>

      <div className="action-row">
        <input
          className="input search-input"
          placeholder={t('inv.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isAdmin && <Button onClick={() => setSellModal(null) || setSellModal({})}>💰 {t('inv.sell')}</Button>}
        <Button onClick={() => setRestockModal({})}>📥 {t('inv.restock')}</Button>
        <Button onClick={() => setAssignModal({})}>🚚 {t('inv.assign')}</Button>
        <Button variant="secondary" onClick={() => setTransferModal({})}>🔄 {t('inv.worker_transfer')}</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : parts.length === 0 ? (
        <Empty title={t('inv.empty')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('inv.part')}</th>
                <th>{t('inv.in_warehouse')}</th>
                <th>{t('inv.with_workers')}</th>
                <th>{t('inv.total')}</th>
                <th>{t('inv.detail')}</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id}>
                  <td className="list-title">
                    {p.name}
                    {p.sku && <div className="small muted">{p.sku}</div>}
                  </td>
                  <td>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="badge badge-success badge-btn"
                        title={t('inv.edit_stock')}
                        onClick={() => setEditStockModal({ part: p })}
                      >
                        {p.warehouse_qty} {t('common.pieces')} ✎
                      </button>
                    ) : (
                      <Badge tone={p.warehouse_qty > 0 ? 'success' : 'gray'}>{p.warehouse_qty} {t('common.pieces')}</Badge>
                    )}
                  </td>
                  <td>
                    <Badge tone={p.workers.length > 0 ? 'info' : 'gray'}>
                      {p.workers.reduce((s, w) => s + w.quantity, 0)} {t('common.pieces')} · {p.workers.length} {t('common.workers_short')}
                    </Badge>
                  </td>
                  <td><strong>{p.total} {t('common.pieces')}</strong></td>
                  <td>
                    {p.workers.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <div className="worker-list">
                        {p.workers.map((w) => (
                          <div key={w.worker_id} className="worker-chip">
                            {w.full_name} · {w.city || '—'}: <strong>{w.quantity}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="text-right">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={p.warehouse_qty <= 0}
                        onClick={() => setSellModal({ part: p })}
                      >
                        💰 {t('inv.sell')}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Приход */}
      <Modal open={!!restockModal} title={t('inv.restock')} onClose={() => setRestockModal(null)}>
        <form onSubmit={doRestock} className="form-grid">
          <Field label={t('inv.part')} required>
            <Select name="part_id" placeholder={t('common.select')} required>
              <option value="">{t('common.select')}</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('inv.expected_qty')} required>
            <input name="expected_quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label={t('inv.actual_qty')} required hint={t('inv.shortage_hint')}>
            <input name="actual_quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label={t('inv.purchase_cost')}>
            <input name="purchase_cost" type="number" min="0" className="input" placeholder="0" />
          </Field>
          <Field label={t('inv.reason')} hint={t('inv.reason_hint')}>
            <input name="reason" className="input" placeholder={t('inv.delivery_placeholder')} />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setRestockModal(null)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('inv.accept')}</Button>
          </div>
        </form>
      </Modal>

      {/* Распределение */}
      <Modal open={!!assignModal} title={t('inv.assign_title')} onClose={() => setAssignModal(null)}>
        <form onSubmit={doAssign} className="form-grid">
          <Field label={t('inv.part')} required>
            <Select name="part_id" placeholder={t('common.select')} required>
              <option value="">{t('common.select')}</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({t('common.in_warehouse')}: {p.warehouse_qty})</option>
              ))}
            </Select>
          </Field>
          <Field label={t('inv.worker')} required>
            <Select name="to_worker_id" placeholder={t('common.select')} required>
              <option value="">{t('common.select')}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.quantity')} required>
            <input name="quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label={t('inv.reason')}>
            <input name="reason" className="input" placeholder={t('common.optional')} />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setAssignModal(null)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('inv.assign_btn')}</Button>
          </div>
        </form>
      </Modal>

      {/* Между рабочими */}
      <Modal open={!!transferModal} title={t('inv.worker_transfer')} onClose={() => setTransferModal(null)}>
        <form onSubmit={doTransfer} className="form-grid">
          <Field label={t('inv.part')} required>
            <Select name="part_id" placeholder={t('common.select')} required>
              <option value="">{t('common.select')}</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('inv.from_worker')} required>
            <Select name="from_worker_id" placeholder={t('common.select')} required>
              <option value="">{t('common.select')}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('inv.to_worker')} required>
            <Select name="to_worker_id" placeholder={t('common.select')} required>
              <option value="">{t('common.select')}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.quantity')} required>
            <input name="quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label={t('inv.reason')}>
            <input name="reason" className="input" placeholder={t('common.optional')} />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setTransferModal(null)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('inv.transfer_btn')}</Button>
          </div>
        </form>
      </Modal>

      {/* Продажа со склада (админ) */}
      <Modal open={!!sellModal} title={t('inv.sell_title')} onClose={() => setSellModal(null)}>
        <form onSubmit={doSell} className="form-grid">
          {sellModal?.part ? (
            <Field label={t('inv.part')}>
              <input className="input" value={`${sellModal.part.name} (${t('common.in_warehouse')}: ${sellModal.part.warehouse_qty})`} disabled />
              <input type="hidden" name="part_id" value={sellModal.part.id} />
            </Field>
          ) : (
            <Field label={t('inv.part')} required>
              <Select name="part_id" placeholder={t('common.select')} required>
                <option value="">{t('common.select')}</option>
                {parts.filter((p) => p.warehouse_qty > 0).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({t('common.in_warehouse')}: {p.warehouse_qty})</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t('sale.quantity')} required>
            <input name="quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label={t('sale.unit_price')} required>
            <input name="unit_price" type="number" min="0" className="input" defaultValue={sellModal?.part?.sell_price || 0} required />
          </Field>
          <Field label={t('sale.client')}>
            <input name="client_name" className="input" placeholder={t('sale.client_placeholder')} />
          </Field>
          <Field label={t('sale.client_phone')}>
            <input name="client_phone" className="input" placeholder="+998 …" />
          </Field>
          <Field label={t('sale.payment_type')} required>
            <Select name="payment_type" defaultValue="cash" required>
              <option value="cash">{t('sale.cash')}</option>
              <option value="card">{t('sale.card')}</option>
              <option value="bank">{t('sale.bank')}</option>
            </Select>
          </Field>
          <Field label={t('sale.payment_when')} required>
            <Select name="payment_status" defaultValue="paid" required>
              <option value="paid">{t('sale.paid_now')}</option>
              <option value="pending">{t('sale.paid_later')}</option>
            </Select>
          </Field>
          <Field label={t('sale.note')}>
            <input name="note" className="input" placeholder={t('sale.note_placeholder')} />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setSellModal(null)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('sale.sell')}</Button>
          </div>
        </form>
      </Modal>

      {/* Изменение количества на складе (админ) */}
      <Modal open={!!editStockModal} title={t('inv.edit_stock_title')} onClose={() => setEditStockModal(null)}>
        {editStockModal?.part && (
          <form onSubmit={doSetStock} className="form-grid">
            <Field label={t('inv.part')}>
              <input className="input" value={`${editStockModal.part.name} ${editStockModal.part.sku ? `(${editStockModal.part.sku})` : ''}`} disabled />
              <input type="hidden" name="part_id" value={editStockModal.part.id} />
            </Field>
            <Field label={t('inv.in_warehouse')} required>
              <input
                name="warehouse_quantity"
                type="number"
                min="0"
                step="1"
                className="input"
                defaultValue={editStockModal.part.warehouse_qty}
                required
              />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setEditStockModal(null)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
