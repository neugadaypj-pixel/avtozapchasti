// Скрипт интеграционного тестирования API — самодостаточен: создаёт нужных
// рабочих через API, поэтому не зависит от демо-данных.
const BASE = 'http://localhost:4000/api';

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    console.log(`  ✖ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data };
}

async function main() {
  console.log('== Аутентификация ==');
  const bad = await req('POST', '/auth/login', { body: { username: 'admin', password: 'wrong' } });
  ok('Отклонён неверный пароль', bad.status === 401);

  const adminLogin = await req('POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
  ok('Вход админа', adminLogin.status === 200 && adminLogin.data.token);
  const adminToken = adminLogin.data.token;
  const adminId = adminLogin.data.user.id;

  console.log('== Пользователи ==');
  // Создаём двух рабочих (не зависят от демо-данных).
  const w1 = await req('POST', '/users', {
    token: adminToken,
    body: { username: 'test_worker1', password: 'pass1234', full_name: 'Тест Рабочий 1', city: 'Бухара', role: 'worker' },
  });
  ok('Создание рабочего 1', w1.status === 201);
  const worker1Id = w1.data.data.id;

  const w2 = await req('POST', '/users', {
    token: adminToken,
    body: { username: 'test_worker2', password: 'pass1234', full_name: 'Тест Рабочий 2', city: 'Навои', role: 'worker' },
  });
  ok('Создание рабочего 2', w2.status === 201);
  const worker2Id = w2.data.data.id;

  const dupWorker = await req('POST', '/users', {
    token: adminToken,
    body: { username: 'test_worker1', password: 'pass1234', full_name: 'Дубль' },
  });
  ok('Отклонён дубликат логина', dupWorker.status === 409);

  const worker1Login = await req('POST', '/auth/login', { body: { username: 'test_worker1', password: 'pass1234' } });
  ok('Вход рабочего 1', worker1Login.status === 200);
  const worker1Token = worker1Login.data.token;

  const worker2Login = await req('POST', '/auth/login', { body: { username: 'test_worker2', password: 'pass1234' } });
  ok('Вход рабочего 2', worker2Login.status === 200);
  const worker2Token = worker2Login.data.token;

  console.log('== Права доступа ==');
  const forbidden = await req('GET', '/users', { token: worker1Token });
  ok('Рабочему закрыт список пользователей', forbidden.status === 403);

  const noAuth = await req('GET', '/parts');
  ok('Без токена доступ запрещён', noAuth.status === 401);

  console.log('== Категории ==');
  const cats = await req('GET', '/categories', { token: adminToken });
  ok('Список категорий', cats.status === 200);

  const newCat = await req('POST', '/categories', { token: adminToken, body: { name: 'Трансмиссия' } });
  ok('Создание категории', newCat.status === 201);

  console.log('== Запчасти ==');
  const newPart = await req('POST', '/parts', {
    token: adminToken,
    body: { name: 'Сцепление Lada Vesta', sku: 'CLT-100', brand: 'Lada', category_id: newCat.data.data.id, cost_price: 200000, sell_price: 320000, initial_quantity: 15 },
  });
  ok('Создание запчасти с остатком', newPart.status === 201 && newPart.data.data.total === 15);
  const newPartId = newPart.data.data.id;

  const dupPart = await req('POST', '/parts', { token: adminToken, body: { name: 'Дубль', sku: 'CLT-100' } });
  ok('Отклонён дубликат SKU', dupPart.status === 409);

  const searchRes = await req('GET', '/parts?search=Vesta', { token: adminToken });
  ok('Поиск по названию', searchRes.status === 200 && searchRes.data.data.some((p) => p.id === newPartId));

  const lowStockRes = await req('GET', '/parts?low_stock=1', { token: adminToken });
  ok('Фильтр малых остатков', lowStockRes.status === 200);

  console.log('== Распределение и склад ==');
  const assign = await req('POST', '/transfers/assign', {
    token: adminToken,
    body: { part_id: newPartId, to_worker_id: worker1Id, quantity: 5, reason: 'Тестовая передача' },
  });
  ok('Распределение рабочему', assign.status === 201);

  const partAfterAssign = await req('GET', `/parts/${newPartId}`, { token: adminToken });
  ok('Склад уменьшился до 10', partAfterAssign.data.data.warehouse === 10);
  ok('У рабочего 5 шт.', partAfterAssign.data.data.workers.some((w) => w.worker_id === worker1Id && w.quantity === 5));

  const overAssign = await req('POST', '/transfers/assign', {
    token: adminToken,
    body: { part_id: newPartId, to_worker_id: worker1Id, quantity: 999 },
  });
  ok('Отклонено превышение остатка', overAssign.status === 400);

  const restock = await req('POST', '/transfers/restock', { token: adminToken, body: { part_id: newPartId, quantity: 20, reason: 'Приход из Китая' } });
  ok('Приход на склад', restock.status === 201);

  const partAfterRestock = await req('GET', `/parts/${newPartId}`, { token: adminToken });
  ok('Склад = 30 после прихода', partAfterRestock.data.data.warehouse === 30);

  console.log('== Продажи ==');
  const adminSell = await req('POST', '/sales', {
    token: adminToken,
    body: { part_id: newPartId, quantity: 1 },
  });
  ok('Администратор не может продавать', adminSell.status === 403);

  const sell = await req('POST', '/sales', {
    token: worker1Token,
    body: { part_id: newPartId, quantity: 2, unit_price: 320000, client_name: 'Клиент А', client_phone: '+998 90 555 55 55' },
  });
  ok('Продажа рабочим', sell.status === 201 && sell.data.data.total === 640000);

  const overSell = await req('POST', '/sales', {
    token: worker1Token,
    body: { part_id: newPartId, quantity: 100 },
  });
  ok('Отклонена продажа сверх остатка', overSell.status === 400);

  const partAfterSell = await req('GET', `/parts/${newPartId}`, { token: worker1Token });
  ok('У рабочего осталось 3', partAfterSell.data.data.workers.find((w) => w.worker_id === worker1Id).quantity === 3);

  const sales = await req('GET', '/sales', { token: adminToken });
  ok('Список продаж (админ)', sales.status === 200 && sales.data.data.length >= 1);

  const mySales = await req('GET', '/sales', { token: worker1Token });
  ok('Список своих продаж (рабочий)', mySales.status === 200 && mySales.data.data.every((s) => s.worker_id === worker1Id));

  console.log('== Возвраты ==');
  const ret = await req('POST', '/transfers/return', {
    token: worker1Token,
    body: { part_id: newPartId, quantity: 1, reason: 'Брак' },
  });
  ok('Возврат рабочим на склад', ret.status === 201);

  const partAfterReturn = await req('GET', `/parts/${newPartId}`, { token: adminToken });
  ok('Склад = 31, у рабочего 2', partAfterReturn.data.data.warehouse === 31 && partAfterReturn.data.data.workers.find((w) => w.worker_id === worker1Id).quantity === 2);

  console.log('== Передача между рабочими ==');
  const wt = await req('POST', '/transfers/worker-transfer', {
    token: adminToken,
    body: { part_id: newPartId, from_worker_id: worker1Id, to_worker_id: worker2Id, quantity: 1, reason: 'Переброска' },
  });
  ok('Передача между рабочими', wt.status === 201);

  const partAfterWT = await req('GET', `/parts/${newPartId}`, { token: adminToken });
  ok('Баланс после передачи', partAfterWT.data.data.workers.some((w) => w.worker_id === worker1Id && w.quantity === 1) && partAfterWT.data.data.workers.some((w) => w.worker_id === worker2Id && w.quantity === 1));

  console.log('== Поиск по всей базе (рабочий) ==');
  const workerSearch = await req('GET', '/parts?search=Lada', { token: worker1Token });
  ok('Рабочий видит запчасть с Lada', workerSearch.status === 200 && workerSearch.data.data.some((p) => p.brand === 'Lada'));

  const mineRes = await req('GET', '/parts?mine=1', { token: worker1Token });
  ok('Фильтр "только мои"', mineRes.status === 200 && mineRes.data.data.some((p) => p.id === newPartId));

  console.log('== История передач ==');
  const transfers = await req('GET', '/transfers', { token: adminToken });
  ok('История передач (админ)', transfers.status === 200 && transfers.data.data.length >= 4);

  const myTransfers = await req('GET', '/transfers', { token: worker1Token });
  ok('Свои передачи (рабочий)', myTransfers.status === 200 && myTransfers.data.data.every((t) => t.from_worker_id === worker1Id || t.to_worker_id === worker1Id));

  console.log('== Дашборд ==');
  const dashAdmin = await req('GET', '/dashboard', { token: adminToken });
  ok('Дашборд админа', dashAdmin.status === 200 && dashAdmin.data.data.stats);

  const dashWorker = await req('GET', '/dashboard', { token: worker1Token });
  ok('Дашборд рабочего', dashWorker.status === 200 && Array.isArray(dashWorker.data.data.my_stock));

  console.log('== Защита от самоуничтожения ==');
  const selfBlock = await req('PUT', `/users/${adminId}`, { token: adminToken, body: { is_active: 0 } });
  ok('Нельзя заблокировать себя', selfBlock.status === 400);

  const selfDelete = await req('DELETE', `/users/${adminId}`, { token: adminToken });
  ok('Нельзя удалить себя', selfDelete.status === 400);

  console.log('== Удаление с остатком заблокировано ==');
  const delWorkerWithStock = await req('DELETE', `/users/${worker1Id}`, { token: adminToken });
  ok('Рабочего с остатком нельзя удалить', delWorkerWithStock.status === 400);

  const delPartWithStock = await req('DELETE', `/parts/${newPartId}`, { token: adminToken });
  ok('Запчасть с остатком нельзя удалить', delPartWithStock.status === 400);

  console.log('== Обновление запчасти ==');
  const updPart = await req('PUT', `/parts/${newPartId}`, { token: adminToken, body: { sell_price: 350000 } });
  ok('Обновление цены', updPart.status === 200 && updPart.data.data.sell_price === 350000);

  console.log('== Обновление пользователя ==');
  const updWorker = await req('PUT', `/users/${worker1Id}`, { token: adminToken, body: { city: 'Хива' } });
  ok('Обновление города рабочего', updWorker.status === 200 && updWorker.data.data.city === 'Хива');

  console.log('\n==============================');
  console.log(`Результат: ${pass} пройдено, ${fail} упало`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Тест упал с исключением:', e);
  process.exit(1);
});
