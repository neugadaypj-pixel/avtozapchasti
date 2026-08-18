const express = require('express');
const { col } = require('../db');
const { adminOnly } = require('../auth');
const { logAction } = require('../audit');

const router = express.Router();

// Типы расходов рабочего: rent (аренда), bonus (бонус клиенту), other.
const EXPENSE_TYPES = ['rent', 'bonus', 'other'];

// Создание расхода (рабочий добавляет свои расходы, админ может за любого).
router.post('/expenses', async (req, res) => {
  const { amount, type, description, worker_id } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ success: false, error: "Musbat summa kiriting" });
  }
  if (!EXPENSE_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: "Xarajat turini tanlang" });
  }

  let workerId = req.user.id;
  if (req.user.role === 'admin' && worker_id) {
    workerId = Number(worker_id);
  }

  const e = await col('expenses').insert({
    worker_id: workerId,
    amount: amt,
    type,
    description: description || null,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  });

  await logAction(req.user, 'expense', 'expense', e.id, { worker_id: workerId, amount: amt, type });
  res.status(201).json({ success: true, data: e });
});

// Список расходов.
router.get('/expenses', async (req, res) => {
  let rows = await col('expenses').find({});
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  if (req.user.role !== 'admin') {
    rows = rows.filter((e) => e.worker_id === req.user.id);
  }
  const users = await col('users').find({});
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const data = rows.map((e) => ({
    ...e,
    worker_name: userMap[e.worker_id]?.full_name || '—',
  }));
  res.json({ success: true, data: data.slice(0, 500) });
});

// Денежный оборот для рабочего (или админ видит по всем/конкретному).
router.get('/turnover', async (req, res) => {
  let sales = await col('sales').find({});
  let expenses = await col('expenses').find({});

  let scopeWorkerId = req.user.id;
  if (req.user.role === 'admin') {
    if (req.query.worker_id) {
      scopeWorkerId = Number(req.query.worker_id);
    } else {
      // админ видит все
      const all = await allTurnover(sales, expenses);
      return res.json({ success: true, data: all });
    }
  }

  const workerSales = sales.filter((s) => s.worker_id === scopeWorkerId);
  const workerExpenses = expenses.filter((e) => e.worker_id === scopeWorkerId);

  // Долг рабочего = сумма paid продаж (cash — наличные, которые он должен отдать админу).
  // Карта принадлежит складчику (админ), банк — компании, поэтому долг менеджера = только cash (paid).
  const cashPaid = workerSales
    .filter((s) => s.payment_type === 'cash' && s.payment_status === 'paid')
    .reduce((sum, s) => sum + s.total, 0);

  const cardPaid = workerSales
    .filter((s) => s.payment_type === 'card' && s.payment_status === 'paid')
    .reduce((sum, s) => sum + s.total, 0);

  const bankPaid = workerSales
    .filter((s) => s.payment_type === 'bank' && s.payment_status === 'paid')
    .reduce((sum, s) => sum + s.total, 0);

  const pending = workerSales
    .filter((s) => s.payment_status === 'pending')
    .reduce((sum, s) => sum + s.total, 0);

  // Бонусы за счёт компании не включаются в долг.
  const bonusTotal = workerExpenses
    .filter((e) => e.type === 'bonus')
    .reduce((sum, e) => sum + e.amount, 0);

  const rentTotal = workerExpenses
    .filter((e) => e.type === 'rent')
    .reduce((sum, e) => sum + e.amount, 0);

  const otherTotal = workerExpenses
    .filter((e) => e.type === 'other')
    .reduce((sum, e) => sum + e.amount, 0);

  // Долг = наличные (должен отдать) - бонусы (за счёт компании).
  const debtToAdmin = cashPaid - bonusTotal;

  const result = {
    worker_id: scopeWorkerId,
    total_sales: workerSales.reduce((s, x) => s + x.total, 0),
    cash_paid: cashPaid,
    card_paid: cardPaid,
    bank_paid: bankPaid,
    pending: pending,
    expenses_total: workerExpenses.reduce((s, e) => s + e.amount, 0),
    bonus_total: bonusTotal,
    rent_total: rentTotal,
    other_total: otherTotal,
    debt_to_admin: debtToAdmin,
  };

  res.json({ success: true, data: result });
});

async function allTurnover(sales, expenses) {
  const [users, parts] = await Promise.all([
    col('users').find({}),
    col('parts').find({}),
  ]);
  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));
  const workers = users.filter((u) => u.role === 'worker' && !u.deleted);

  // Себестоимость проданного товара.
  function costOfGoods(list) {
    return list.reduce((sum, s) => {
      const part = partMap[s.part_id];
      return sum + (part ? part.cost_price * s.quantity : 0);
    }, 0);
  }

  const byWorker = workers.map((w) => {
    const ws = sales.filter((s) => s.worker_id === w.id);
    const we = expenses.filter((e) => e.worker_id === w.id);
    const paidSales = ws.filter((s) => s.payment_status === 'paid');
    const cashPaid = paidSales.filter((s) => s.payment_type === 'cash').reduce((sum, s) => sum + s.total, 0);
    const bonusTotal = we.filter((e) => e.type === 'bonus').reduce((sum, e) => sum + e.amount, 0);
    const revenue = paidSales.reduce((sum, s) => sum + s.total, 0);
    const cogs = costOfGoods(paidSales);
    // Чистая прибыль = выручка(оплаченная) - себестоимость - расходы рабочего.
    const profit = revenue - cogs - we.reduce((s, e) => s + e.amount, 0);

    return {
      worker_id: w.id,
      full_name: w.full_name,
      city: w.city,
      total_sales: ws.reduce((s, x) => s + x.total, 0),
      cash_paid: cashPaid,
      card_paid: paidSales.filter((s) => s.payment_type === 'card').reduce((sum, s) => sum + s.total, 0),
      bank_paid: paidSales.filter((s) => s.payment_type === 'bank').reduce((sum, s) => sum + s.total, 0),
      pending: ws.filter((s) => s.payment_status === 'pending').reduce((sum, s) => sum + s.total, 0),
      expenses_total: we.reduce((s, e) => s + e.amount, 0),
      bonus_total: bonusTotal,
      rent_total: we.filter((e) => e.type === 'rent').reduce((sum, e) => sum + e.amount, 0),
      other_total: we.filter((e) => e.type === 'other').reduce((sum, e) => sum + e.amount, 0),
      debt_to_admin: cashPaid - bonusTotal,
      revenue,
      cogs,
      profit,
    };
  });

  const paidSales = sales.filter((s) => s.payment_status === 'paid');
  const totalRevenue = paidSales.reduce((s, x) => s + x.total, 0);
  const totalCogs = costOfGoods(paidSales);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const total = {
    total_sales: sales.reduce((s, x) => s + x.total, 0),
    cash_paid: paidSales.filter((s) => s.payment_type === 'cash').reduce((sum, s) => sum + s.total, 0),
    card_paid: paidSales.filter((s) => s.payment_type === 'card').reduce((sum, s) => sum + s.total, 0),
    bank_paid: paidSales.filter((s) => s.payment_type === 'bank').reduce((sum, s) => sum + s.total, 0),
    pending: sales.filter((s) => s.payment_status === 'pending').reduce((sum, s) => sum + s.total, 0),
    expenses_total: totalExpenses,
    revenue: totalRevenue,
    cogs: totalCogs,
    profit: totalRevenue - totalCogs - totalExpenses,
  };

  return { workers: byWorker, total };
}

module.exports = router;
