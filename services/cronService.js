const cron = require('node-cron');
const { fetchAndStoreByDate } = require('./historyService');

function startCronJobs() {
  // MLB yesterday @ 03:05
  cron.schedule('0 5 3 * * *', async () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      console.log(`[CRON] MLB save ${dateStr}`);
      const res = await fetchAndStoreByDate('MLB', dateStr);
      console.log('[CRON] MLB done:', res);
    } catch (e) {
      console.error('[CRON] MLB failed:', e.message);
    }
  });

  // NBA yesterday @ 03:10
  cron.schedule('0 10 3 * * *', async () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      console.log(`[CRON] NBA save ${dateStr}`);
      const res = await fetchAndStoreByDate('NBA', dateStr);
      console.log('[CRON] NBA done:', res);
    } catch (e) {
      console.error('[CRON] NBA failed:', e.message);
    }
  });

  console.log('⏰ Cron scheduled: MLB@03:05, NBA@03:10 daily');
}

module.exports = { startCronJobs };
