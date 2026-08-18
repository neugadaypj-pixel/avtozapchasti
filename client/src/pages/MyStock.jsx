import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, fmtMoney, useToast } from '../components/ui.jsx';

export function MyStock({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returnModal, setReturnModal] = useState(null); // { part }
  const [sellModal, setSellModal] = useState(null); // { part }

  async function load() {
    setLoading(true);
    try {
      const r = await API.parts.list({ mine: '1' });
      setStock(r.data.filter((p) => p.total > 0));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const myQty = (part) => {
    const w = part.workers.find((x) => x.worker_id === user.id);
    return w ? w.quantity : 0;
  };

  async function doReturn(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.transfers.return({
        part_id: returnModal.part.id,
        quantity: Number(fd.get('quantity')),
        reason: fd.get('reason'),
      });
      toast('Товар возвращён на склад', 'success');
      setReturnModal(null);
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
        part_id: sellModal.part.id,
        quantity: Number(fd.get('quantity')),
        unit_price: Number(fd.get('unit_price')),
        client_name: fd.get('client_name'),
        client_phone: fd.get('client_phone'),
        note: fd.get('note'),
        payment_type: fd.get('payment_type'),
        payment_status: fd.get('payment_status'),
      });
      toast('Sotuv rasmiylashtirildi', 'success');
      setSellModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Мои запчасти</h2>
        <p className="muted">Товар, который вам выделили для продажи</p>
      </div>

      {loading ? (
        <Spinner />
      ) : stock.length === 0 ? (
        <Empty title="У вас пока нет запчастей">
          Администратор распределит товар — и он появится здесь.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Название</th>
                <th>Артикул</th>
                <th>Категория</th>
                <th>У меня</th>
                <th>Цена</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stock.map((p) => (
                <tr key={p.id}>
                  <td className="list-title">{p.name}</td>
                  <td className="muted">{p.sku || '—'}</td>
                  <td className="muted">{p.category_name || '—'}</td>
                  <td>
                    <Badge tone={myQty(p) <= 3 ? 'warn' : 'success'}>{myQty(p)} шт.</Badge>
                  </td>
                  <td className="nowrap">{fmtMoney(p.sell_price)}</td>
                  <td className="text-right">
                    <div className="row-actions">
                      <Button variant="success" size="sm" onClick={() => setSellModal({ part: p })}>Продать</Button>
                      <Button variant="warning" size="sm" onClick={() => setReturnModal({ part: p })}>Вернуть</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Возврат на склад */}
      <Modal open={!!returnModal} title="Вернуть товар на склад" onClose={() => setReturnModal(null)}>
        {returnModal && (
          <form onSubmit={doReturn} className="form-grid">
            <p className="muted">
              <strong>{returnModal.part.name}</strong> — у вас {myQty(returnModal.part)} шт.
            </p>
            <Field label="Количество" required>
              <input name="quantity" type="number" min="1" max={myQty(returnModal.part)} className="input" defaultValue={1} required />
            </Field>
            <Field label="Причина возврата" hint="Например, брак, повреждение, не продаётся">
              <input name="reason" className="input" placeholder="Причина" />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setReturnModal(null)}>Отмена</Button>
              <Button type="submit" variant="warning">Вернуть на склад</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Продажа */}
      <Modal open={!!sellModal} title="Sotuvni rasmiylashtirish" onClose={() => setSellModal(null)}>
        {sellModal && (
          <form onSubmit={doSell} className="form-grid">
            <p className="muted">
              <strong>{sellModal.part.name}</strong> — sizda {myQty(sellModal.part)} dona.
            </p>
            <Field label="Miqdor" required>
              <input name="quantity" type="number" min="1" max={myQty(sellModal.part)} className="input" defaultValue={1} required />
            </Field>
            <Field label="Bir dona narxi">
              <input name="unit_price" type="number" min="0" className="input" defaultValue={sellModal.part.sell_price} />
            </Field>
            <Field label="To'lov turi" required>
              <select name="payment_type" className="input select" required>
                <option value="cash">Naqd pul</option>
                <option value="card">Kartaga o'tkazish</option>
                <option value="bank">Bank hisobiga</option>
              </select>
            </Field>
            <Field label="Qachon to'lanadi?" required>
              <select name="payment_status" className="input select" required>
                <option value="paid">Darhol</option>
                <option value="pending">Keyinroq</option>
              </select>
            </Field>
            <Field label="Mijoz">
              <input name="client_name" className="input" placeholder="Mijoz ismi" />
            </Field>
            <Field label="Mijoz telefoni">
              <input name="client_phone" className="input" placeholder="+998 …" />
            </Field>
            <Field label="Izoh">
              <input name="note" className="input" placeholder="Izoh" />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setSellModal(null)}>Bekor qilish</Button>
              <Button type="submit" variant="success">Sotish</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
