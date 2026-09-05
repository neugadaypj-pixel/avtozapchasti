// Вспомогательные функции для работы со складскими остатками (MongoDB).
const { col } = require('./db');

function inventoryQuery(partId, ownerType, workerId) {
  return { part_id: partId, owner_type: ownerType, worker_id: workerId ?? null };
}

async function getQuantity(partId, ownerType, workerId) {
  const row = await col('inventory').findOne(inventoryQuery(partId, ownerType, workerId));
  return row ? row.quantity : 0;
}

// Изменяет количество на складе/у рабочего. delta может быть отрицательной.
async function adjustStock(partId, ownerType, workerId, delta) {
  const q = inventoryQuery(partId, ownerType, workerId);
  const row = await col('inventory').findOne(q);
  if (row) {
    const newQty = row.quantity + delta;
    await col('inventory').update({ _id: row._id }, { $set: { quantity: newQty } });
    return newQty;
  }
  await col('inventory').insert({ ...q, quantity: delta });
  return delta;
}

// Устанавливает точное количество на складе/у рабочего (перезапись вместо дельты).
async function setStock(partId, ownerType, workerId, quantity) {
  const q = inventoryQuery(partId, ownerType, workerId);
  const qty = Math.max(0, Number(quantity) || 0);
  const row = await col('inventory').findOne(q);
  if (row) {
    await col('inventory').update({ _id: row._id }, { $set: { quantity: qty } });
  } else if (qty > 0) {
    await col('inventory').insert({ ...q, quantity: qty });
  }
  return qty;
}

// Распределение запчасти по локациям: склад + по каждому рабочему.
async function availability(partId) {
  const rows = await col('inventory').find({ part_id: partId, quantity: { $gt: 0 } });
  const users = await col('users').find({});
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const warehouse = rows.find((r) => r.owner_type === 'warehouse');
  const workers = rows
    .filter((r) => r.owner_type === 'worker')
    .map((r) => ({
      worker_id: r.worker_id,
      full_name: userMap[r.worker_id]?.full_name || '—',
      city: userMap[r.worker_id]?.city || null,
      phone: userMap[r.worker_id]?.phone || null,
      quantity: r.quantity,
    }))
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  const total = rows.reduce((s, r) => s + r.quantity, 0);
  return { warehouse: warehouse ? warehouse.quantity : 0, workers, total };
}

module.exports = { getQuantity, adjustStock, setStock, availability };
