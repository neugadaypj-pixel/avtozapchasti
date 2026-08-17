// Аудит-лог действий: записывает кто, когда и что изменил.
const { col } = require('./db');

// Типы действий: create, update, delete, login, assign, return, restock, sell, etc.
async function logAction(actor, action, entity, entityId, details) {
  try {
    await col('audit_logs').insert({
      actor_id: actor ? actor.id : null,
      actor_name: actor ? actor.full_name : null,
      action,
      entity,
      entity_id: entityId ?? null,
      details: details || null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Ошибка записи аудит-лога:', e.message);
  }
}

// Список логов (для админа).
async function getLogs(limit = 100) {
  const rows = await col('audit_logs').find({});
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  return rows.slice(0, limit);
}

module.exports = { logAction, getLogs };
