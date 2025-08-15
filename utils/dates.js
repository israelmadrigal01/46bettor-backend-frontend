// utils/dates.js
function todayET() {
  const dt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const d = new Date(dt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function parseDateOrTodayET(s) {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayET();
}
module.exports = { todayET, parseDateOrTodayET };
