// Генерирует простую PNG-иконку для приложения (256x256).
// Используется как иконка Electron и Capacitor.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const off = y * (width * 4 + 1) + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Рисуем: тёмно-синий фон со скруглёнными углами + белая шестерёнка-буква "Z".
const size = 256;
function insideRounded(x, y, r) {
  const cx = Math.min(Math.max(x, r), size - 1 - r);
  const cy = Math.min(Math.max(y, r), size - 1 - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

const png = makePng(size, size, (x, y) => {
  // фон с градиентом (индиго → фиолетовый)
  const t = (x + y) / (2 * size);
  let r = Math.round(79 + (139 - 79) * t);
  let g = Math.round(70 + (92 - 70) * t);
  let b = Math.round(229 + (246 - 229) * t);
  if (!insideRounded(x, y, 48)) return [0, 0, 0, 0]; // прозрачные углы

  // белая буква Z в центре
  const cx = size / 2, cy = size / 2;
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  // простая "Z" из трёх полос
  const top = y > cy - 55 && y < cy - 20 && Math.abs(x - cx) < 50;
  const bottom = y > cy + 20 && y < cy + 55 && Math.abs(x - cx) < 50;
  const diag = Math.abs((x - cx) - (y - cy)) < 12 && dx < 55 && dy < 55;
  if (top || bottom || diag) return [255, 255, 255, 255];
  return [r, g, b, 255];
});

const out = path.join(__dirname, '..', 'public', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
// Копия в dist (для Electron после сборки).
const dist = path.join(__dirname, '..', 'dist', 'icon.png');
fs.mkdirSync(path.dirname(dist), { recursive: true });
fs.writeFileSync(dist, png);
console.log('Иконка создана: public/icon.png и dist/icon.png');
