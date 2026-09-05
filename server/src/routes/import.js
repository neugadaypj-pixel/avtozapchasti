const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { adminOnly } = require('../auth');
const { col } = require('../db');
const { adjustStock } = require('../inventory');
const { logAction } = require('../audit');
const { extractPartsFromRows } = require('../ai');
const { parseRows } = require('../excel');

const router = express.Router();
router.use(adminOnly);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 МБ
});

// Шаг 1: разобрать Excel и вернуть нормализованное превью (ничего не сохраняет).
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не получен' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, error: 'Файл не содержит листов' });
    }
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const clean = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ''));
    if (clean.length === 0) {
      return res.status(400).json({ success: false, error: 'Таблица пуста' });
    }

    // 1. Пробуем детерминированный разбор по заголовкам колонок (все строки).
    let preview = [];
    let usedAi = false;
    const parsed = parseRows(clean);
    preview = parsed.parts;

    // 2. Если не распознали — подключаем ИИ (партиями, чтобы не упереться в лимит токенов).
    if (!parsed.recognized) {
      try {
        const all = [];
        const CHUNK = 250;
        for (let i = 0; i < clean.length; i += CHUNK) {
          const chunk = clean.slice(i, i + CHUNK);
          const part = await extractPartsFromRows(chunk);
          all.push(...part);
        }
        preview = all;
        usedAi = true;
      } catch (e) {
        console.error('ИИ-разбор не удался:', e.message);
      }
    }

    res.json({
      success: true,
      data: {
        preview,
        total_rows: clean.length,
        used_ai: usedAi,
        model: usedAi ? (process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro') : null,
      },
    });
  } catch (e) {
    console.error('Ошибка разбора Excel:', e);
    res.status(500).json({ success: false, error: e.message || 'Не удалось разобрать файл' });
  }
});

// Шаг 2: подтвердить импорт — создать запчасти и начальные остатки.
router.post('/confirm', async (req, res) => {
  const { parts } = req.body || {};
  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ success: false, error: 'Нет данных для импорта' });
  }

  let created = 0;
  const errors = [];
  for (const p of parts) {
    try {
      const name = String(p.name || '').trim();
      if (!name) {
        errors.push({ sku: p.sku || null, error: 'Нет названия' });
        continue;
      }
      const sku = p.sku ? String(p.sku).trim() : null;
      if (sku) {
        const exists = await col('parts').findOne({ sku });
        if (exists) {
          errors.push({ sku, error: 'Артикул уже существует' });
          continue;
        }
      }

      // Важно: не пишем sku: null — разреженный уникальный индекс
      // падает с duplicate key { sku: null } при нескольких товарах без артикула.
      const doc = {
        name,
        brand: p.brand ? String(p.brand).trim() : null,
        category_id: p.category_id ? Number(p.category_id) : null,
        cost_price: Number(p.cost_price) || 0,
        sell_price: Number(p.sell_price) || 0,
        cost_currency: p.cost_currency || 'UZS',
        sell_currency: p.sell_currency || 'UZS',
        description: p.description ? String(p.description).trim() : null,
        shelf: p.shelf ? String(p.shelf).trim() : null,
        image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (sku) doc.sku = sku;

      const part = await col('parts').insert(doc);

      const qty = Math.max(0, Number(p.quantity) || 0);
      if (qty > 0) {
        await adjustStock(part.id, 'warehouse', null, qty);
      }
      created++;
    } catch (e) {
      errors.push({ sku: p.sku || null, error: e.message });
    }
  }

  await logAction(req.user, 'import', 'parts', null, { created, total: parts.length });
  res.json({ success: true, data: { created, errors } });
});

module.exports = router;
