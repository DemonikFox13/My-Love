const fs = require('fs');
const path = require('path');
const config = require('./config');

const SAVES_DIR = path.join(__dirname, '..', config.SAVES_DIR_NAME);

function ensureDir() {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
    console.log('[storage] создана папка', SAVES_DIR);
  }
}

function listSaves() {
  ensureDir();
  return fs.readdirSync(SAVES_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => {
      const full = path.join(SAVES_DIR, f);
      return {
        name: f,
        url: `/saves/${f}`,
        time: fs.statSync(full).mtime
      };
    })
    .sort((a, b) => b.time - a.time);
}

function savePng(dataUrl) {
  ensureDir();
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('Ожидается data:image/png;base64,...');
  }
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const name = `draw-${Date.now()}.png`;
  fs.writeFileSync(path.join(SAVES_DIR, name), base64, 'base64');
  return { name, url: `/saves/${name}` };
}

function deleteSave(name) {
  ensureDir();
  const safe = path.basename(name);
  const full = path.join(SAVES_DIR, safe);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

module.exports = { SAVES_DIR, listSaves, savePng, deleteSave };
