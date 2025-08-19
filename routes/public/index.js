// routes/public/index.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const here = __dirname;

let loadedHealth = false;

function maybeUse(file, marksHealth = false) {
  const p = path.join(here, file);
  if (fs.existsSync(p)) {
    try {
      router.use(require(p));
      if (marksHealth) loadedHealth = true;
      console.log(`[public] loaded ${file}`);
    } catch (e) {
      console.error(`[public] failed to load ${file}:`, e.message);
    }
  } else {
    console.log(`[public] ${file} not found — skipping`);
  }
}

maybeUse('health.js', true);
maybeUse('tiles.js');
maybeUse('ledger.js');
maybeUse('record.js');
maybeUse('scoreboard.js');
maybeUse('recent.js');
maybeUse('picks.js');

if (!loadedHealth) {
  router.get('/health', (req, res) => {
    res.json({ ok: true, service: '46bettor-backend/public', ts: new Date().toISOString() });
  });
}

module.exports = router;
