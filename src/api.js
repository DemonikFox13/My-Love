const express = require('express');
const config = require('./config');
const storage = require('./storage');

const router = express.Router();

router.get('/gallery', (req, res) => {
  try {
    res.json(storage.listSaves());
  } catch (e) {
    console.error('[api] gallery error', e);
    res.status(500).json({ error: 'list failed' });
  }
});

router.post('/save', (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'no image' });
    const result = storage.savePng(image);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[api] save error', e);
    res.status(400).json({ error: e.message });
  }
});

router.delete('/gallery/:name', (req, res) => {
  try {
    storage.deleteSave(req.params.name);
    res.json({ ok: true });
  } catch (e) {
    console.error('[api] delete error', e);
    res.status(500).json({ error: 'delete failed' });
  }
});

module.exports = router;
