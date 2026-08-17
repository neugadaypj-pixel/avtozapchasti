const express = require('express');
const multer = require('multer');
const { adminOnly } = require('../auth');
const { uploadImage } = require('../r2');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ максимум
});

// Загрузка изображения (только администратор). Поле формы: "image".
router.post('/', adminOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не получен' });
    }
    const extMatch = (req.file.originalname || '').match(/\.[a-zA-Z0-9]+$/);
    const ext = (extMatch ? extMatch[0] : '.jpg').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ success: false, error: 'Допустимы JPG, PNG, WEBP или GIF' });
    }
    const url = await uploadImage(req.file.buffer, req.file.mimetype, ext);
    res.status(201).json({ success: true, data: { url } });
  } catch (e) {
    console.error('Ошибка загрузки изображения:', e);
    res.status(500).json({ success: false, error: 'Не удалось загрузить изображение' });
  }
});

module.exports = router;
