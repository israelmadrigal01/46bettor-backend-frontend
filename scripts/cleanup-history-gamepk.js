require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fortysixbettor';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const col = db.collection('historicalgames');

    console.log('[cleanup] Unsetting gamePk from all docs...');
    const r1 = await col.updateMany(
      { gamePk: { $exists: true } },
      { $unset: { gamePk: "" } }
    );
    console.log('[cleanup] docs updated:', r1.modifiedCount);

    console.log('[cleanup] Dropping index sport_1_gamePk_1 (if present)...');
    try { await col.dropIndex('sport_1_gamePk_1'); }
    catch (e) { console.log('[cleanup] dropIndex info:', e.message); }

    const idx = await col.indexes();
    console.table(idx.map(i => ({ name: i.name, key: JSON.stringify(i.key), unique: !!i.unique })));

    await mongoose.disconnect();
    console.log('[cleanup] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[cleanup] Fatal:', err);
    process.exit(1);
  }
})();
