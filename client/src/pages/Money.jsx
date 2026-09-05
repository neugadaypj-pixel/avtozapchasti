import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, StatCard, fmtMoney, fmtDate, useToast, useConfirm, Select } from '../components/ui.jsx';

export function MoneyPage() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [turnover, setTurnover] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [sales, setSales] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpense, setShowExpense] = useState(false);
  const [showDebtPayment, setShowDebtPayment] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [workers, setWorkers] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const [t, e, s] = await Promise.all([
        API.money.turnover(isAdmin && selectedWorker ? selectedWorker : undefined),
        API.money.expenses(),
        API.sales.list(),
      ]);
      setTurnover(t.data);
      setExpenses(e.data);
      setSales(s.data);
      if (isAdmin) {
        const [u, d] = await Promise.all([
          API.users.list(),
          API.money.debtPayments(),
        ]);
        setWorkers(u.data.filter((x) => x.role === 'worker'));
        setDebtPayments(d.data);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedWorker]);

  async function addExpense(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.money.addExpense({
        amount: Number(fd.get('amount')),
        description: fd.get('description'),
      });
      toast(t('money.expense_added'), 'success');
      setShowExpense(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function addDebtPayment(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.money.addDebtPayment({
        amount: Number(fd.get('amount')),
        worker_id: Number(fd.get('worker_id')),
        description: fd.get('description'),
      });
      toast(t('money.debt_paid_added'), 'success');
      setShowDebtPayment(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function confirmPayment(saleId) {
    if (!(await confirm(t('money.confirm_payment_q')))) return;
    try {
      await API.sales.confirm(saleId);
      toast(t('money.payment_confirmed'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (loading) return <Spinner />;

  const turnoverData = turnover;
  const pendingSales = sales.filter((s) => s.payment_status === 'pending');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{isAdmin ? t('money.title_admin') : t('money.title_worker')}</h2>
          <p className="muted">
            {isAdmin ? t('money.subtitle_admin') : t('money.subtitle_worker')}
          </p>
        </div>
        <div className="page-actions">
          {isAdmin && (
            <Button variant="success" onClick={() => setShowDebtPayment(true)}>✓ {t('money.confirm_debt')}</Button>
          )}
          {!isAdmin && (
            <Button onClick={() => setShowExpense(true)}>+ {t('money.add_expense')}</Button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="filter-bar">
          <Select value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)} placeholder={t('common.all')}>
            <option value="">{t('common.all')}</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
            ))}
          </Select>
        </div>
      )}

      {isAdmin && !selectedWorker ? (
        <AdminTurnover t={turnoverData} />
      ) : (
        <WorkerTurnover data={turnoverData} />
      )}

      {/* Кнопка подтверждения оплаты для pending продаж */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h3>{t('money.pending_payments')}</h3>
          <Badge tone="warn">{pendingSales.length} {t('money.count')}</Badge>
        </div>
        {pendingSales.length === 0 ? (
          <Empty title={t('money.pending_none')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('money.client')}</th>
                  <th>{t('money.product')}</th>
                  <th>{t('money.sum')}</th>
                  {isAdmin && <th>{t('money.worker')}</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingSales.map((s) => (
                  <tr key={s.id}>
                    <td className="muted nowrap">{fmtDate(s.created_at)}</td>
                    <td>{s.client_name || '—'}</td>
                    <td>{s.part_name}</td>
                    <td className="nowrap"><strong>{fmtMoney(s.total)}</strong></td>
                    {isAdmin && <td>{s.worker_name}</td>}
                    <td className="text-right">
                      <Button variant="success" size="sm" onClick={() => confirmPayment(s.id)}>
                        {t('money.confirm_paid')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Расходы */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h3>{t('money.expenses_title')}</h3>
        </div>
        {expenses.length === 0 ? (
          <Empty title={t('money.expenses_none')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('money.description')}</th>
                  {isAdmin && <th>{t('money.worker')}</th>}
                  <th>{t('money.sum')}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((x) => (
                  <tr key={x.id}>
                    <td className="muted nowrap">{fmtDate(x.created_at)}</td>
                    <td className="muted">{x.description || '—'}</td>
                    {isAdmin && <td>{x.worker_name}</td>}
                    <td className="nowrap"><strong>{fmtMoney(x.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Подтверждения возврата долга */}
      {isAdmin && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h3>{t('money.debt_payments_title')}</h3>
          </div>
          {debtPayments.length === 0 ? (
            <Empty title={t('money.debt_payments_none')} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('money.worker')}</th>
                    <th>{t('money.description')}</th>
                    <th>{t('money.sum')}</th>
                  </tr>
                </thead>
                <tbody>
                  {debtPayments.map((x) => (
                    <tr key={x.id}>
                      <td className="muted nowrap">{fmtDate(x.created_at)}</td>
                      <td>{x.worker_name}</td>
                      <td className="muted">{x.description || '—'}</td>
                      <td className="nowrap"><strong>{fmtMoney(x.amount)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Модалка добавления расхода */}
      <Modal open={showExpense} title={t('money.add_expense')} onClose={() => setShowExpense(false)}>
        <form onSubmit={addExpense} className="form-grid">
          <Field label={t('money.sum')} required>
            <input name="amount" type="number" min="1" className="input" required />
          </Field>
          <Field label={t('money.description')} hint={t('common.optional')}>
            <input name="description" className="input" placeholder={t('money.description')} />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setShowExpense(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.add')}</Button>
          </div>
        </form>
      </Modal>

      {/* Модалка подтверждения возврата долга */}
      <Modal open={showDebtPayment} title={t('money.confirm_debt')} onClose={() => setShowDebtPayment(false)}>
        <form onSubmit={addDebtPayment} className="form-grid">
          <Field label={t('money.worker')} required>
            <Select name="worker_id" required>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('money.sum')} required>
            <input name="amount" type="number" min="1" className="input" required />
          </Field>
          <Field label={t('money.description')} hint={t('common.optional')}>
            <input name="description" className="input" placeholder={t('money.description')} />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setShowDebtPayment(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.confirm')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function WorkerTurnover({ data }) {
  const { t } = useI18n();
  if (!data) return <Empty title={t('stats.no_data')} />;
  return (
    <>
      <div className="stats-grid">
        <StatCard icon="money" label={t('money.total_sales')} value={fmtMoney(data.total_sales)} />
        <StatCard icon="sales" label={t('money.cash_hand')} value={fmtMoney(data.cash_paid)} tone={data.cash_paid > 0 ? 'warn' : ''} />
        <StatCard icon="warehouse" label={t('money.card_transfer')} value={fmtMoney(data.card_paid)} />
        <StatCard icon="box" label={t('money.bank_transfer')} value={fmtMoney(data.bank_paid)} />
        <StatCard icon="alert" label={t('money.pending')} value={fmtMoney(data.pending)} />
        <StatCard icon="return" label={t('money.debt')} value={fmtMoney(data.debt_to_admin)} tone={data.debt_to_admin > 0 ? 'danger' : ''} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>{t('money.expenses_title')}</h3></div>
        <div className="list">
          <div className="list-row"><span>{t('money.total_expenses')}</span><strong>{fmtMoney(data.expenses_total)}</strong></div>
          <div className="list-row"><span>{t('money.debt_paid')}</span><strong>{fmtMoney(data.debt_paid)}</strong></div>
          <div className="list-row"><span>{t('money.debt')}</span><strong>{fmtMoney(data.debt_to_admin)}</strong></div>
        </div>
      </div>
    </>
  );
}

function AdminTurnover({ t }) {
  const { t: tr } = useI18n();
  if (!t || !t.workers) return <Empty title={tr('stats.no_data')} />;
  return (
    <>
      <div className="stats-grid">
        <StatCard icon="money" label={tr('money.revenue')} value={fmtMoney(t.total.revenue)} />
        <StatCard icon="box" label={tr('money.cogs')} value={fmtMoney(t.total.cogs)} />
        <StatCard icon="sales" label={tr('money.total_expenses')} value={fmtMoney(t.total.expenses_total)} />
        <StatCard icon="money" label={tr('money.profit')} value={fmtMoney(t.total.profit)} tone={t.total.profit >= 0 ? 'success' : 'danger'} />
        <StatCard icon="warehouse" label={tr('money.card')} value={fmtMoney(t.total.card_paid)} />
        <StatCard icon="box" label={tr('money.bank')} value={fmtMoney(t.total.bank_paid)} />
        <StatCard icon="alert" label={tr('money.pending')} value={fmtMoney(t.total.pending)} />
        <StatCard icon="sales" label={tr('money.cash')} value={fmtMoney(t.total.cash_paid)} />
      </div>

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>{tr('workers.name')}</th>
              <th>{tr('money.total_sales')}</th>
              <th>{tr('money.cash')}</th>
              <th>{tr('money.card')}</th>
              <th>{tr('money.bank')}</th>
              <th>{tr('money.pending')}</th>
              <th>{tr('money.expenses')}</th>
              <th>{tr('money.debt_paid')}</th>
              <th>{tr('money.profit')}</th>
              <th>{tr('money.debt')}</th>
            </tr>
          </thead>
          <tbody>
            {t.workers.map((w) => (
              <tr key={w.worker_id}>
                <td className="list-title">{w.full_name}</td>
                <td className="nowrap">{fmtMoney(w.total_sales)}</td>
                <td className="nowrap">{fmtMoney(w.cash_paid)}</td>
                <td className="nowrap">{fmtMoney(w.card_paid)}</td>
                <td className="nowrap">{fmtMoney(w.bank_paid)}</td>
                <td className="nowrap">{fmtMoney(w.pending)}</td>
                <td className="nowrap">{fmtMoney(w.expenses_total)}</td>
                <td className="nowrap">{fmtMoney(w.debt_paid)}</td>
                <td className="nowrap"><Badge tone={w.profit >= 0 ? 'success' : 'danger'}>{fmtMoney(w.profit)}</Badge></td>
                <td className="nowrap"><Badge tone={w.debt_to_admin > 0 ? 'danger' : 'success'}>{fmtMoney(w.debt_to_admin)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
