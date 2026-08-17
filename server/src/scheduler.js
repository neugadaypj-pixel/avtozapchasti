// Планировщик периодического резервного копирования MongoDB.
// Бэкап запускается каждые N часов (по умолчанию 24) и кладётся локально + в R2.
const { spawn } = require('child_process');
const path = require('path');

const BACKUP_INTERVAL_HOURS = Number(process.env.BACKUP_INTERVAL_HOURS) || 24;

function runBackup() {
  console.log(`[backup] Запуск резервного копирования (${new Date().toISOString()})`);
  const child = spawn(process.execPath, [path.join(__dirname, 'backup.js')], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    console.log(`[backup] Бэкап завершён с кодом ${code}`);
  });
}

function startScheduler() {
  // Запускаем первый бэкап через 5 минут после старта.
  setTimeout(runBackup, 5 * 60 * 1000);
  // Далее периодически.
  setInterval(runBackup, BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
  console.log(`[backup] Планировщик бэкапов включён (каждые ${BACKUP_INTERVAL_HOURS} ч)`);
}

module.exports = { startScheduler };
