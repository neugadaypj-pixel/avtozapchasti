// Интеграция с DeepSeek API для «умного» разбора Excel-таблиц запчастей.
// Модель настраивается через env: DEEPSEEK_MODEL (по умолчанию deepseek-v4-pro).
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1/chat/completions';

// Вызов DeepSeek Chat Completions.
async function callDeepSeek(messages, temperature = 0) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY не задан');
  }
  const response = await fetch(DEEPSEEK_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature,
      max_tokens: 4000,
    }),
  });

  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    const message = data.error?.message || `DeepSeek API error ${response.status}`;
    throw new Error(message);
  }

  // Некоторые модели (reasoner-типа) кладут ответ в reasoning_content, а content пустой.
  const msg = data.choices?.[0]?.message || {};
  const content = msg.content || msg.reasoning_content || '';
  if (!content) {
    throw new Error('DeepSeek вернул пустой ответ (проверьте DEEPSEEK_MODEL)');
  }
  return content;
}

// Достаём JSON из ответа модели (она может обернуть его в пояснения).
function extractJson(text) {
  if (!text) throw new Error('Пустой ответ от ИИ');
  try {
    return JSON.parse(text);
  } catch {}
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {}
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {}
  }
  throw new Error('ИИ вернул нечитаемый формат данных');
}

// Преобразует сырые строки Excel в массив нормализованных запчастей.
// rows: массив массивов (как из XLSX sheet_to_json с header:1).
async function extractPartsFromRows(rows) {
  const prompt = `Ты — ассистент магазина автозапчастей. Ниже сырые данные из Excel-таблицы (массив строк, первая строка обычно заголовки, но не всегда).

Данные:
${JSON.stringify(rows)}

Разбери эту таблицу и верни ТОЛЬКО JSON-массив объектов запчастей. Каждый объект должен содержать поля:
- "name": название запчасти (string)
- "sku": артикул/номер детали (string или null)
- "brand": бренд (string или null)
- "quantity": количество на складе (integer, по умолчанию 0)
- "cost_price": закупочная цена (number, по умолчанию 0)
- "sell_price": цена продажи (number, по умолчанию 0)
- "shelf": полка/место хранения (string или null)
- "description": дополнительное описание (string или null)

Правила:
1. Пропускай пустые строки и строки-заголовки.
2. Определяй назначение колонок по содержимому (артикул обычно выглядит как код, например 90915-10009 или 04465-33220; количество — целое число).
3. Если колонка цены указана в рублях или долларах, оставь число как есть (без валютного символа).
4. Если поля нет в таблице — ставь null (для quantity/cost_price/sell_price — 0).
5. Верни массив, ничего больше, без пояснений и markdown.`;

  const content = await callDeepSeek([
    { role: 'system', content: 'Ты отвечаешь строго валидным JSON без пояснений.' },
    { role: 'user', content: prompt },
  ]);

  const parsed = extractJson(content);
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.parts) ? parsed.parts : []);
  return list
    .filter((p) => p && (p.name || p.sku))
    .map((p) => ({
      name: String(p.name || '').trim(),
      sku: p.sku ? String(p.sku).trim() : null,
      brand: p.brand ? String(p.brand).trim() : null,
      quantity: Math.max(0, Number(p.quantity) || 0),
      cost_price: Number(p.cost_price) || 0,
      sell_price: Number(p.sell_price) || 0,
      shelf: p.shelf ? String(p.shelf).trim() : null,
      description: p.description ? String(p.description).trim() : null,
    }));
}

module.exports = { extractPartsFromRows, callDeepSeek };
