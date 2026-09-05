// Интеграция с DeepSeek API для «умного» разбора Excel-таблиц запчастей.
// Модель настраивается через env: DEEPSEEK_MODEL (по умолчанию deepseek-v4-pro).
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1/chat/completions';

// Вызов DeepSeek Chat Completions.
async function callDeepSeek(messages, { jsonMode = false } = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY не задан');
  }
  const body = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: 0,
    max_tokens: 8000,
  };
  if (jsonMode) {
    // DeepSeek поддерживает JSON mode (гарантирует валидный JSON в ответе).
    body.response_format = { type: 'json_object' };
  }
  const response = await fetch(DEEPSEEK_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
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

// Достаём JSON из ответа модели (она может обернуть его в пояснения, markdown и т.п.).
function extractJson(text) {
  if (!text) throw new Error('Пустой ответ от ИИ');

  let cleaned = text.trim();

  // 1. Снимаем markdown-обёртку ```json ... ``` / ``` ... ```.
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();

  // 2. Пробуем распарсить как есть.
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 3. Ищем первый '[' и последний ']' (JSON-массив внутри текста).
  const firstArr = cleaned.indexOf('[');
  const lastArr = cleaned.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    try {
      return JSON.parse(cleaned.slice(firstArr, lastArr + 1));
    } catch {}
  }

  // 4. Ищем первый '{' и последний '}' (JSON-объект внутри текста).
  const firstObj = cleaned.indexOf('{');
  const lastObj = cleaned.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    try {
      return JSON.parse(cleaned.slice(firstObj, lastObj + 1));
    } catch {}
  }

  console.error('Не удалось разобрать ответ ИИ. Сырой ответ:', text.slice(0, 2000));
  throw new Error('ИИ вернул нечитаемый формат данных');
}

// Преобразует сырые строки Excel в массив нормализованных запчастей.
// rows: массив массивов (как из XLSX sheet_to_json с header:1).
async function extractPartsFromRows(rows) {
  const prompt = `Ты — ассистент магазина автозапчастей. Ниже сырые данные из Excel-таблицы (массив строк, первая строка обычно заголовки, но не всегда).

Данные:
${JSON.stringify(rows)}

Разбери эту таблицу и верни JSON-объект строго такого формата:
{"parts": [
  {
    "name": "название запчасти",
    "sku": "артикул или null",
    "brand": "бренд или null",
    "quantity": 0,
    "cost_price": 0,
    "sell_price": 0,
    "shelf": "полка или null",
    "description": "описание или null"
  }
]}

Правила:
1. Пропускай пустые строки и строки-заголовки.
2. Определяй назначение колонок по содержимому (артикул обычно выглядит как код, например 90915-10009 или 04465-33220; количество — целое число).
3. Если колонка цены указана с валютой — оставь только число.
4. Если поля нет в таблице — ставь null (для quantity/cost_price/sell_price — 0).
5. Верни ТОЛЬКО JSON, без пояснений и markdown.`;

  const content = await callDeepSeek(
    [
      { role: 'system', content: 'Ты отвечаешь строго валидным JSON-объектом без пояснений.' },
      { role: 'user', content: prompt },
    ],
    { jsonMode: true }
  );

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
