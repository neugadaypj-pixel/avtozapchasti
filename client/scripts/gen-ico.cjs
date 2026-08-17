// Генерирует .ico файл из PNG (ICO поддерживает встроенный PNG для 256x256).
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
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const off = y * (width * 4 + 1) + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function makeIcoFromPng(png) {
  // ICO header: 0=reserved, 1=type(1=icon), 2=count
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  // directory entry (16 bytes)
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width (0 = 256)
  entry.writeUInt8(0, 1); // height (0 = 256)
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // size
  entry.writeUInt32LE(22, 12); // offset (6 + 16)
  return Buffer.concat([header, entry, png]);
}

const size = 256;
function insideRounded(x, y, r) {
  const cx = Math.min(Math.max(x, r), size - 1 - r);
  const cy = Math.min(Math.max(y, r), size - 1 - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

const png = makePng(size, size, (x, y) => {
  const t = (x + y) / (2 * size);
  const r = Math.round(79 + (139 - 79) * t);
  const g = Math.round(70 + (92 - 70) * t);
  const b = Math.round(229 + (246 - 229) * t);
  if (!insideRounded(x, y, 48)) return [0, 0, 0, 0];
  const cx = size / 2, cy = size / 2;
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  const top = y > cy - 55 && y < cy - 20 && Math.abs(x - cx) < 50;
  const bottom = y > cy + 20 && y < cy + 55 && Math.abs(x - cx) < 50;
  const diag = Math.abs((x - cx) - (y - cy)) < 12 && dx < 55 && dy < 55;
  if (top || bottom || diag) return [255, 255, 255, 255];
  return [r, g, b, 255];
});

const ico = makeIcoFromPng(png);
const out = path.join(__dirname, '..', 'public', 'icon.ico');
fs.writeFileSync(out, ico);
console.log('ICO создан: public/icon.ico');
