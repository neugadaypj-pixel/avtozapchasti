// Уведомления для рабочих.
const { col } = require('./db');

async function notify(workerId, type, message, data) {
  try {
    await col('notifications').insert({
      worker_id: workerId,
      type,
      message,
      data: data || null,
      read: 0,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Ошибка уведомления:', e.message);
  }
}

// Получить непрочитанные уведомления рабочего + мало остатков.
async function getNotifications(workerId) {
  const rows = await col('notifications').find({ worker_id: workerId });
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  return rows.slice(0, 50);
}

async function markRead(workerId, ids) {
  const { getDb } = require('./db');
  const d = await getDb();
  await d.collection('notifications').updateMany(
    { worker_id: workerId, id: { $in: ids } },
    { $set: { read: 1 } }
  );
}

module.exports = { notify, getNotifications, markRead };
