// Детерминированный разбор Excel-строк в запчасти по заголовкам колонок.
// Поддерживает русские, английские и узбекские заголовки.
// Используется в первую очередь; если ничего не распознано — подключается ИИ.

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,;:()\[\]\"'`/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RULES = [
  {
    key: 'sku',
    words: [
      'артикул', 'арт', 'артикул номер', 'sku', 'oem', 'номер', 'код', 'код товара',
      'каталожный', 'кат номер', 'штрих', 'штрихкод', 'штрих код', 'баркод', 'бар код',
      'shtrix', 'shtrix kod', 'barcode', 'article', 'number', 'code', 'part number',
    ],
  },
  {
    key: 'name',
    words: [
      'название', 'наименование', 'наименование товара', 'номи', 'товар', 'деталь', 'часть',
      'название детали', 'mahsulot', 'mahsulot nomi', 'name', 'description', 'title', 'part name',
    ],
  },
  {
    key: 'brand',
    words: ['бренд', 'марка', 'производитель', 'изготовитель', 'brand', 'make', 'manufacturer'],
  },
  {
    key: 'quantity',
    words: [
      'количество', 'кол во', 'колво', 'кол', 'остаток', 'остатки', 'шт', 'штук',
      'количество шт', 'колдик', 'qoldiq', 'qolgan', 'miqdor', 'soni', 'quantity', 'qty', 'count', 'stock',
    ],
  },
  {
    key: 'cost_price',
    words: [
      'закуп', 'закупочная', 'закупка', 'себестоимость', 'приходная', 'входная', 'цена закупа',
      'опт', 'oxirgi narx', 'oxirgi', 'kirim', 'cost', 'purchase', 'приход цена',
    ],
  },
  {
    key: 'sell_price',
    words: [
      'продаж', 'продажная', 'розница', 'розничная', 'цена', 'стоимость', 'цена продажи',
      'цена реализации', 'sotuv', 'sotuv narxi', 'narx', 'sell', 'price', 'retail',
    ],
  },
  {
    key: 'shelf',
    words: [
      'полка', 'место', 'место хранения', 'стеллаж', 'ячейка', 'локация', 'расположение',
      'shelf', 'location', 'tokcha', 'joy',
    ],
  },
];

function matchColumn(header) {
  const h = norm(header);
  if (!h) return null;
  for (const rule of RULES) {
    for (const w of rule.words) {
      if (h === w || h.startsWith(w + ' ') || h.endsWith(' ' + w) || h.includes(w)) {
        return rule.key;
      }
    }
  }
  return null;
}

function looksLikeHeader(row) {
  if (!Array.isArray(row)) return false;
  let textCells = 0;
  let numericCells = 0;
  for (const cell of row) {
    const s = String(cell ?? '').trim();
    if (!s) continue;
    if (/^[-+]?\d+([.,]\d+)?$/.test(s.replace(/\s/g, ''))) numericCells++;
    else textCells++;
  }
  // Заголовок — преимущественно текст.
  return textCells > 0 && textCells >= numericCells;
}

// Разбирает сырые строки Excel в массив запчастей.
// Возвращает { parts, recognized: boolean }.
function parseRows(rows) {
  const clean = (rows || []).filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ''));

  // 1. Ищем строку-заголовок среди первых 10 строк.
  let headerIndex = -1;
  let columnMap = null;
  for (let i = 0; i < Math.min(clean.length, 10); i++) {
    if (looksLikeHeader(clean[i])) {
      const map = {};
      let matched = 0;
      clean[i].forEach((cell, idx) => {
        const key = matchColumn(cell);
        if (key && map[key] === undefined) {
          map[key] = idx;
          matched++;
        }
      });
      if (matched >= 2) {
        headerIndex = i;
        columnMap = map;
        break;
      }
    }
  }

  // Если заголовок не найден — пробуем позиционное сопоставление по первой строке.
  if (headerIndex === -1 && clean.length > 0) {
    const first = clean[0];
    const positional = { name: null, sku: null, brand: null, quantity: null, cost_price: null, sell_price: null, shelf: null };
    first.forEach((cell, idx) => {
      const s = String(cell ?? '').trim();
      if (!s) return;
      if (/^[-+]?\d+([.,]\d+)?$/.test(s.replace(/\s/g, ''))) {
        if (positional.quantity === null) positional.quantity = idx;
        else if (positional.cost_price === null) positional.cost_price = idx;
        else if (positional.sell_price === null) positional.sell_price = idx;
      } else {
        if (positional.sku === null && /[0-9]/.test(s) && s.length <= 24) positional.sku = idx;
        else if (positional.name === null) positional.name = idx;
      }
    });
    const anyMatched = Object.values(positional).some((v) => v !== null);
    if (anyMatched) {
      columnMap = positional;
      headerIndex = 0;
    }
  }

  if (!columnMap) {
    return { parts: [], recognized: false };
  }

  const parts = [];
  for (let i = headerIndex + 1; i < clean.length; i++) {
    const row = clean[i];
    const get = (key) => {
      const idx = columnMap[key];
      if (idx === null || idx === undefined) return null;
      const v = row[idx];
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s === '' ? null : s;
    };

    let name = get('name');
    let sku = get('sku');

    // Если артикул совпадает с названием — это не артикул, а дубликат названия.
    if (sku && name && norm(sku) === norm(name)) {
      sku = null;
    }
    // Если артикул не похож на код (нет цифр) — оставляем только название.
    if (sku && !/[0-9]/.test(sku)) {
      sku = null;
    }

    if (!name && !sku) continue;

    const num = (key) => {
      const v = get(key);
      if (v === null) return 0;
      const parsed = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    parts.push({
      name: name || '',
      sku: sku || null,
      brand: get('brand') || null,
      quantity: Math.max(0, Math.round(num('quantity'))),
      cost_price: num('cost_price'),
      sell_price: num('sell_price'),
      shelf: get('shelf') || null,
      description: null,
    });
  }

  const withData = parts.filter((p) => p.name || p.sku);
  return { parts: withData, recognized: withData.length > 0 };
}

module.exports = { parseRows };
