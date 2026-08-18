import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { Button, Field, Modal, Empty, Spinner, Badge, useToast } from '../components/ui.jsx';

export function InventoryPage() {
  const toast = useToast();
  const [parts, setParts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [assignModal, setAssignModal] = useState(null);
  const [restockModal, setRestockModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);

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
      toast('Товар распределён рабочему', 'success');
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
      toast('Omborga qabul qilindi', 'success');
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
      toast('Передача между рабочими выполнена', 'success');
      setTransferModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Ombor va taqsimlash</h2>
        <p className="muted">Qoldiqlarni boshqaring: Xitoydan kirim, ishchilarga taqsimlash, ular orasida o'tkazish</p>
      </div>

      <div className="action-row">
        <input
          className="input search-input"
          placeholder="Ehtiyot qism qidirish…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={() => setRestockModal({})}>📥 Omborga kirim</Button>
        <Button onClick={() => setAssignModal({})}>🚚 Ishchilarga taqsimlash</Button>
        <Button variant="secondary" onClick={() => setTransferModal({})}>🔄 Ishchilar orasida</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : parts.length === 0 ? (
        <Empty title="Ehtiyot qismlar yo'q" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Запчасть</th>
                <th>На складе</th>
                <th>У рабочих</th>
                <th>Всего</th>
                <th>Детализация</th>
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
                    <Badge tone={p.warehouse_qty > 0 ? 'success' : 'gray'}>{p.warehouse_qty} шт.</Badge>
                  </td>
                  <td>
                    <Badge tone={p.workers.length > 0 ? 'info' : 'gray'}>
                      {p.workers.reduce((s, w) => s + w.quantity, 0)} шт. · {p.workers.length} раб.
                    </Badge>
                  </td>
                  <td><strong>{p.total} шт.</strong></td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Приход */}
      <Modal open={!!restockModal} title="Omborga tovar kirimi" onClose={() => setRestockModal(null)}>
        <form onSubmit={doRestock} className="form-grid">
          <Field label="Ehtiyot qism" required>
            <select name="part_id" className="input select" required>
              <option value="">— tanlang —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Kutilgan miqdor" required>
            <input name="expected_quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label="Haqiqiy kelgan miqdor" required hint="Agar kam kelsa, qarz hisobga olinadi">
            <input name="actual_quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label="Sotib olish narxi (summa)">
            <input name="purchase_cost" type="number" min="0" className="input" placeholder="0" />
          </Field>
          <Field label="Izoh" hint="Masalan, Xitoydan kelgan yetkazib berish raqami">
            <input name="reason" className="input" placeholder="Yetkazib berish №…" />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setRestockModal(null)}>Bekor qilish</Button>
            <Button type="submit">Omborga qabul qilish</Button>
          </div>
        </form>
      </Modal>

      {/* Распределение */}
      <Modal open={!!assignModal} title="Распределить товар рабочему" onClose={() => setAssignModal(null)}>
        <form onSubmit={doAssign} className="form-grid">
          <Field label="Запчасть" required>
            <select name="part_id" className="input select" required>
              <option value="">— выберите —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (на складе: {p.warehouse_qty})</option>
              ))}
            </select>
          </Field>
          <Field label="Рабочий" required>
            <select name="to_worker_id" className="input select" required>
              <option value="">— выберите —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
              ))}
            </select>
          </Field>
          <Field label="Количество" required>
            <input name="quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label="Примечание">
            <input name="reason" className="input" placeholder="Необязательно" />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setAssignModal(null)}>Отмена</Button>
            <Button type="submit">Распределить</Button>
          </div>
        </form>
      </Modal>

      {/* Между рабочими */}
      <Modal open={!!transferModal} title="Передача между рабочими" onClose={() => setTransferModal(null)}>
        <form onSubmit={doTransfer} className="form-grid">
          <Field label="Запчасть" required>
            <select name="part_id" className="input select" required>
              <option value="">— выберите —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="От рабочего" required>
            <select name="from_worker_id" className="input select" required>
              <option value="">— выберите —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
              ))}
            </select>
          </Field>
          <Field label="Кому" required>
            <select name="to_worker_id" className="input select" required>
              <option value="">— выберите —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
              ))}
            </select>
          </Field>
          <Field label="Количество" required>
            <input name="quantity" type="number" min="1" className="input" defaultValue={1} required />
          </Field>
          <Field label="Примечание">
            <input name="reason" className="input" placeholder="Необязательно" />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setTransferModal(null)}>Отмена</Button>
            <Button type="submit">Передать</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
