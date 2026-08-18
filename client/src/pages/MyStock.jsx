import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, fmtMoney, useToast } from '../components/ui.jsx';

export function MyStock({ onNavigate }) {
  const { user } = useAuth();
  const { t } = useI18n();
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
      toast(t('mystock.returned'), 'success');
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
      toast(t('mystock.sold'), 'success');
      setSellModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>{t('nav.mystock')}</h2>
        <p className="muted">{t('mystock.subtitle')}</p>
      </div>

      {loading ? (
        <Spinner />
      ) : stock.length === 0 ? (
        <Empty title={t('dash.no_parts')}>
          {t('mystock.empty_desc')}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>{t('parts.name')}</th>
                <th>{t('parts.sku')}</th>
                <th>{t('parts.category')}</th>
                <th>{t('mystock.mine')}</th>
                <th>{t('common.price')}</th>
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
                    <Badge tone={myQty(p) <= 3 ? 'warn' : 'success'}>{myQty(p)} {t('common.pieces')}</Badge>
                  </td>
                  <td className="nowrap">{fmtMoney(p.sell_price)}</td>
                  <td className="text-right">
                    <div className="row-actions">
                      <Button variant="success" size="sm" onClick={() => setSellModal({ part: p })}>{t('sale.sell')}</Button>
                      <Button variant="warning" size="sm" onClick={() => setReturnModal({ part: p })}>{t('mystock.return_btn')}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Возврат на склад */}
      <Modal open={!!returnModal} title={t('return.title')} onClose={() => setReturnModal(null)}>
        {returnModal && (
          <form onSubmit={doReturn} className="form-grid">
            <p className="muted">
              <strong>{returnModal.part.name}</strong> — {t('mystock.you_have')} {myQty(returnModal.part)} {t('common.pieces')}.
            </p>
            <Field label={t('common.quantity')} required>
              <input name="quantity" type="number" min="1" max={myQty(returnModal.part)} className="input" defaultValue={1} required />
            </Field>
            <Field label={t('return.reason')} hint={t('return.reason_hint')}>
              <input name="reason" className="input" placeholder={t('return.reason_placeholder')} />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setReturnModal(null)}>{t('common.cancel')}</Button>
              <Button type="submit" variant="warning">{t('return.submit')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Продажа */}
      <Modal open={!!sellModal} title={t('sale.form')} onClose={() => setSellModal(null)}>
        {sellModal && (
          <form onSubmit={doSell} className="form-grid">
            <p className="muted">
              <strong>{sellModal.part.name}</strong> — {t('mystock.you_have')} {myQty(sellModal.part)} {t('common.pieces')}.
            </p>
            <Field label={t('sale.quantity')} required>
              <input name="quantity" type="number" min="1" max={myQty(sellModal.part)} className="input" defaultValue={1} required />
            </Field>
            <Field label={t('sale.unit_price')}>
              <input name="unit_price" type="number" min="0" className="input" defaultValue={sellModal.part.sell_price} />
            </Field>
            <Field label={t('sale.payment_type')} required>
              <select name="payment_type" className="input select" required>
                <option value="cash">{t('sale.cash')}</option>
                <option value="card">{t('sale.card')}</option>
                <option value="bank">{t('sale.bank')}</option>
              </select>
            </Field>
            <Field label={t('sale.payment_when')} required>
              <select name="payment_status" className="input select" required>
                <option value="paid">{t('sale.paid_now')}</option>
                <option value="pending">{t('sale.paid_later')}</option>
              </select>
            </Field>
            <Field label={t('sale.client')}>
              <input name="client_name" className="input" placeholder={t('sale.client_placeholder')} />
            </Field>
            <Field label={t('sale.client_phone')}>
              <input name="client_phone" className="input" placeholder="+998 …" />
            </Field>
            <Field label={t('sale.note')}>
              <input name="note" className="input" placeholder={t('sale.note_placeholder')} />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setSellModal(null)}>{t('common.cancel')}</Button>
              <Button type="submit" variant="success">{t('sale.sell')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
