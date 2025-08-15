require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fortysixbettor';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const col = db.collection('historicalgames');

    console.log('[migrate] Checking indexes...');
    const idx = await col.indexes();
    console.table(idx.map(i => ({ name: i.name, key: JSON.stringify(i.key), unique: !!i.unique })));

    // 1) Backfill gameId from gamePk where missing
    console.log('[migrate] Backfilling gameId from gamePk (string -> string)...');
    const r1 = await col.updateMany(
      { gameId: { $exists: false }, gamePk: { $type: 'string' } },
      [{ $set: { gameId: '$gamePk' } }]
    );
    console.log(`[migrate] updated (string): ${r1.modifiedCount}`);

    console.log('[migrate] Backfilling gameId from gamePk (number -> string)...');
    const r2 = await col.updateMany(
      { gameId: { $exists: false }, gamePk: { $type: 'number' } },
      [{ $set: { gameId: { $toString: '$gamePk' } } }]
    );
    console.log(`[migrate] updated (number): ${r2.modifiedCount}`);

    // 2) Drop the old unique index on gamePk if it exists
    const hasGamePkIndex = idx.some(i => i.name === 'gamePk_1');
    if (hasGamePkIndex) {
      console.log('[migrate] Dropping index gamePk_1');
      try { await col.dropIndex('gamePk_1'); } catch (e) { console.log('[migrate] dropIndex error (ok):', e.message); }
    } else {
      console.log('[migrate] gamePk_1 not found (ok)');
    }

    // 3) Ensure the correct unique index { league:1, gameId:1 }
    console.log('[migrate] Creating index { league:1, gameId:1 } unique...');
    try {
      await col.createIndex({ league: 1, gameId: 1 }, { unique: true });
      console.log('[migrate] Index created/exists');
    } catch (e) {
      console.log('[migrate] createIndex error:', e.message);
    }

    // show final indexes
    const after = await col.indexes();
    console.table(after.map(i => ({ name: i.name, key: JSON.stringify(i.key), unique: !!i.unique })));

    await mongoose.disconnect();
    console.log('[migrate] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] Fatal:', err);
    process.exit(1);
  }
})();
