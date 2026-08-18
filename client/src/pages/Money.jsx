import React, { useEffect, useState } from 'react';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { Button, Field, Modal, Empty, Spinner, Badge, StatCard, fmtMoney, fmtDate, useToast } from '../components/ui.jsx';

const PAYMENT_LABELS = {
  cash: "Naqd pul",
  card: "Kartaga o'tkazish",
  bank: "Bank hisobiga",
};

const EXPENSE_LABELS = {
  rent: "Ijara",
  bonus: "Mijozga bonus",
  other: "Boshqa",
};

export function MoneyPage() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [turnover, setTurnover] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpense, setShowExpense] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [workers, setWorkers] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const params = isAdmin && selectedWorker ? `?worker_id=${selectedWorker}` : '';
      const [t, e, s] = await Promise.all([
        API.money.turnover(isAdmin && selectedWorker ? selectedWorker : undefined),
        API.money.expenses(),
        API.sales.list(),
      ]);
      setTurnover(t.data);
      setExpenses(e.data);
      setSales(s.data);
      if (isAdmin) {
        const u = await API.users.list();
        setWorkers(u.data.filter((x) => x.role === 'worker'));
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
        type: fd.get('type'),
        description: fd.get('description'),
      });
      toast("Xarajat qo'shildi", 'success');
      setShowExpense(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function confirmPayment(saleId) {
    if (!confirm("To'lov qabul qilindi deb tasdiqlaysizmi?")) return;
    try {
      await API.sales.confirm(saleId);
      toast("To'lov tasdiqlandi", 'success');
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
        {!isAdmin && (
          <Button onClick={() => setShowExpense(true)}>+ {t('money.add_expense')}</Button>
        )}
      </div>

      {isAdmin && (
        <div className="filter-bar">
          <select className="input select" value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.full_name} · {w.city || '—'}</option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && !selectedWorker ? (
        <AdminTurnover t={turnoverData} />
      ) : (
        <WorkerTurnover t={turnoverData} />
      )}

      {/* Кнопка подтверждения оплаты для pending продаж */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h3>Kutilayotgan to'lovlar</h3>
          <Badge tone="warn">{pendingSales.length} ta</Badge>
        </div>
        {pendingSales.length === 0 ? (
          <Empty title="Kutilayotgan to'lovlar yo'q" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Mijoz</th>
                  <th>Mahsulot</th>
                  <th>Summa</th>
                  {isAdmin && <th>Ishchi</th>}
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
                        To'landi deb tasdiqlash
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
          <h3>Xarajatlar</h3>
        </div>
        {expenses.length === 0 ? (
          <Empty title="Xarajatlar yo'q" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Tur</th>
                  <th>Tavsif</th>
                  {isAdmin && <th>Ishchi</th>}
                  <th>Summa</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((x) => (
                  <tr key={x.id}>
                    <td className="muted nowrap">{fmtDate(x.created_at)}</td>
                    <td><Badge tone="info">{EXPENSE_LABELS[x.type] || x.type}</Badge></td>
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

      {/* Модалка добавления расхода */}
      <Modal open={showExpense} title="Xarajat qo'shish" onClose={() => setShowExpense(false)}>
        <form onSubmit={addExpense} className="form-grid">
          <Field label="Summa" required>
            <input name="amount" type="number" min="1" className="input" required />
          </Field>
          <Field label="Tur" required>
            <select name="type" className="input select" required>
              <option value="rent">Ijara</option>
              <option value="bonus">Mijozga bonus</option>
              <option value="other">Boshqa</option>
            </select>
          </Field>
          <Field label="Tavsif" hint="Majburiy emas">
            <input name="description" className="input" placeholder="Tavsif" />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setShowExpense(false)}>Bekor qilish</Button>
            <Button type="submit">Qo'shish</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function WorkerTurnover({ t }) {
  if (!t) return <Empty title="Ma'lumot yo'q" />;
  return (
    <>
      <div className="stats-grid">
        <StatCard icon="money" label="Jami sotuv" value={fmtMoney(t.total_sales)} />
        <StatCard icon="sales" label="Naqd pul (topshirilishi kerak)" value={fmtMoney(t.cash_paid)} tone={t.cash_paid > 0 ? 'warn' : ''} />
        <StatCard icon="warehouse" label="Kartaga o'tkazish" value={fmtMoney(t.card_paid)} />
        <StatCard icon="box" label="Bank hisobiga" value={fmtMoney(t.bank_paid)} />
        <StatCard icon="alert" label="Kutilayotgan" value={fmtMoney(t.pending)} />
        <StatCard icon="return" label="Adminga qarz" value={fmtMoney(t.debt_to_admin)} tone={t.debt_to_admin > 0 ? 'danger' : ''} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Xarajatlar</h3></div>
        <div className="list">
          <div className="list-row"><span>Ijara</span><strong>{fmtMoney(t.rent_total)}</strong></div>
          <div className="list-row"><span>Mijozga bonus (kompaniya hisobidan)</span><strong>{fmtMoney(t.bonus_total)}</strong></div>
          <div className="list-row"><span>Boshqa</span><strong>{fmtMoney(t.other_total)}</strong></div>
          <div className="list-row"><span>Jami xarajat</span><strong>{fmtMoney(t.expenses_total)}</strong></div>
        </div>
      </div>
    </>
  );
}

function AdminTurnover({ t }) {
  const { t: tr } = useI18n();
  if (!t || !t.workers) return <Empty title="Ma'lumot yo'q" />;
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
