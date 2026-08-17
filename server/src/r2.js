// Работа с Cloudflare R2 (S3-совместимое хранилище) с fallback на локальный диск.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
  publicUrl: process.env.R2_PUBLIC_URL,
};

const isConfigured = Boolean(
  config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName
);

let s3 = null;
let putCommand = null;
let deleteCommand = null;

if (isConfigured) {
  // Ленивый require, чтобы не тянуть зависимость, если R2 не используется.
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  putCommand = PutObjectCommand;
  deleteCommand = DeleteObjectCommand;
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

const localDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(localDir)) {
  fs.mkdirSync(localDir, { recursive: true });
}

function newKey(ext) {
  return `parts/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

// Загружает изображение, возвращает публичный URL.
async function uploadImage(buffer, contentType, ext) {
  const key = newKey(ext);
  if (isConfigured) {
    await s3.send(
      new putCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    const base = (config.publicUrl || '').replace(/\/$/, '');
    return `${base}/${key}`;
  }

  // Локальный fallback: сохраняем файл, отдаём через /uploads/.
  const filename = key.split('/').pop();
  fs.writeFileSync(path.join(localDir, filename), buffer);
  return `/uploads/${filename}`;
}

// Удаляет изображение по URL (если оно было загружено).
async function deleteImage(url) {
  if (!url) return;
  try {
    if (isConfigured) {
      const parts = url.split('/');
      const key = parts.slice(-2).join('/');
      await s3.send(new deleteCommand({ Bucket: config.bucketName, Key: key }));
    } else if (url.startsWith('/uploads/')) {
      const filename = url.split('/').pop();
      const p = path.join(localDir, filename);
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
  } catch (e) {
    console.error('Ошибка удаления изображения:', e.message);
  }
}

module.exports = { uploadImage, deleteImage, isConfigured };
