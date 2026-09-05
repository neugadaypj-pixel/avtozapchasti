// Детерминированный разбор Excel-строк в запчасти по заголовкам колонок.
// Поддерживает русские, английские и узбекские заголовки.
// Также определяет валюту цен (UZS / USD) из отдельной колонки "Валюта"
// или из самого значения ячейки (например "96.131 USD", "350000 So'm").

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

// Является ли заголовок колонкой валюты.
function isCurrencyHeader(header) {
  const h = norm(header);
  return /valyuta|валюта|валюта цены|currency|pul birligi|pul/.test(h);
}

// Определяем валюту из текста.
function detectCurrency(value) {
  const s = String(value ?? '');
  if (/usd|\$|доллар|dollar/i.test(s)) return 'USD';
  if (/som|so'm|сум|sum|uzs/i.test(s)) return 'UZS';
  return null;
}

// Вычищаем валюту и прочий мусор, оставляя только число.
function stripCurrency(value) {
  return String(value ?? '')
    .replace(/\$/g, '')
    .replace(/usd|dollar|доллар/gi, '')
    .replace(/so'm|som|сум|sum|uzs/gi, '')
    .replace(/[^\d.,\-]/g, '')
    .trim();
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
  return textCells > 0 && textCells >= numericCells;
}

function parseNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = stripCurrency(v);
  if (!s) return 0;
  const parsed = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Разбирает сырые строки Excel в массив запчастей.
// Возвращает { parts, recognized: boolean }.
function parseRows(rows) {
  const clean = (rows || []).filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ''));

  // 1. Ищем строку-заголовок среди первых 10 строк.
  let headerIndex = -1;
  let columnMap = null;
  let currencyCols = []; // индексы колонок валюты
  for (let i = 0; i < Math.min(clean.length, 10); i++) {
    if (looksLikeHeader(clean[i])) {
      const map = {};
      let matched = 0;
      const cur = [];
      clean[i].forEach((cell, idx) => {
        const key = matchColumn(cell);
        if (key && map[key] === undefined) {
          map[key] = idx;
          matched++;
        }
        if (isCurrencyHeader(cell)) cur.push(idx);
      });
      if (matched >= 2) {
        headerIndex = i;
        columnMap = map;
        currencyCols = cur;
        break;
      }
    }
  }

  if (!columnMap) {
    return { parts: [], recognized: false };
  }

  // Сопоставляем колонку валюты с соответствующей ценой (валюта идёт сразу после цены).
  let costCurrencyCol = null;
  let sellCurrencyCol = null;
  for (const idx of currencyCols) {
    if (columnMap.cost_price !== undefined && idx === columnMap.cost_price + 1) costCurrencyCol = idx;
    if (columnMap.sell_price !== undefined && idx === columnMap.sell_price + 1) sellCurrencyCol = idx;
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

    if (sku && name && norm(sku) === norm(name)) sku = null;
    if (sku && !/[0-9]/.test(sku)) sku = null;

    if (!name && !sku) continue;

    const costRaw = get('cost_price');
    const sellRaw = get('sell_price');

    // Валюта: сначала из отдельной колонки, иначе из значения самой цены, иначе по умолчанию UZS.
    const costCurrency =
      (costCurrencyCol !== null ? detectCurrency(row[costCurrencyCol]) : null) ||
      detectCurrency(costRaw) ||
      'UZS';
    const sellCurrency =
      (sellCurrencyCol !== null ? detectCurrency(row[sellCurrencyCol]) : null) ||
      detectCurrency(sellRaw) ||
      'UZS';

    parts.push({
      name: name || '',
      sku: sku || null,
      brand: get('brand') || null,
      quantity: Math.max(0, Math.round(parseNumber(get('quantity')))),
      cost_price: parseNumber(costRaw),
      sell_price: parseNumber(sellRaw),
      cost_currency: costCurrency,
      sell_currency: sellCurrency,
      shelf: get('shelf') || null,
      description: null,
    });
  }

  const withData = parts.filter((p) => p.name || p.sku);
  return { parts: withData, recognized: withData.length > 0 };
}

module.exports = { parseRows, detectCurrency };
