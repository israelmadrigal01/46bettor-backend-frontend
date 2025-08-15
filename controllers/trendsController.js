// controllers/trendsController.js
const Pick = require('../models/Pick');

exports.getTrends = async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 60));
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 3600 * 1000);

    const pipeline = [
      { $match: { status: { $in: ['won','lost','push','void'] }, createdAt: { $gte: from } } },
      {
        $project: {
          sport: 1,
          market: 1,
          book: "$book",
          stake: { $ifNull: ['$stake', 0] },
          toWin: { $ifNull: ['$toWin', 0] },
          status: 1,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          profit: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'won'] }, then: { $ifNull: ['$toWin', 0] } },
                { case: { $eq: ['$status', 'lost'] }, then: { $multiply: [{ $ifNull: ['$stake', 0] }, -1] } },
              ],
              default: 0
            }
          }
        }
      },
      {
        $facet: {
          daily: [
            {
              $group: {
                _id: '$date',
                stake: { $sum: '$stake' },
                profit: { $sum: '$profit' },
                count: { $sum: 1 },
                wins: { $sum: { $cond: [{ $eq: ['$status','won'] }, 1, 0] } },
                losses: { $sum: { $cond: [{ $eq: ['$status','lost'] }, 1, 0] } },
                pushes: { $sum: { $cond: [{ $eq: ['$status','push'] }, 1, 0] } },
              }
            },
            { $sort: { _id: 1 } }
          ],
          bySport: [
            {
              $group: {
                _id: '$sport',
                stake: { $sum: '$stake' },
                profit: { $sum: '$profit' },
                count: { $sum: 1 },
                wins: { $sum: { $cond: [{ $eq: ['$status','won'] }, 1, 0] } },
                losses: { $sum: { $cond: [{ $eq: ['$status','lost'] }, 1, 0] } },
                pushes: { $sum: { $cond: [{ $eq: ['$status','push'] }, 1, 0] } },
              }
            },
            { $sort: { profit: -1 } }
          ],
          byMarket: [
            {
              $group: {
                _id: '$market',
                stake: { $sum: '$stake' },
                profit: { $sum: '$profit' },
                count: { $sum: 1 },
                wins: { $sum: { $cond: [{ $eq: ['$status','won'] }, 1, 0] } },
                losses: { $sum: { $cond: [{ $eq: ['$status','lost'] }, 1, 0] } },
                pushes: { $sum: { $cond: [{ $eq: ['$status','push'] }, 1, 0] } },
              }
            },
            { $sort: { profit: -1 } }
          ],
          byBook: [
            {
              $group: {
                _id: '$book',
                stake: { $sum: '$stake' },
                profit: { $sum: '$profit' },
                count: { $sum: 1 },
                wins: { $sum: { $cond: [{ $eq: ['$status','won'] }, 1, 0] } },
                losses: { $sum: { $cond: [{ $eq: ['$status','lost'] }, 1, 0] } },
                pushes: { $sum: { $cond: [{ $eq: ['$status','push'] }, 1, 0] } },
              }
            },
            { $sort: { profit: -1 } }
          ],
          bySportDaily: [
            {
              $group: {
                _id: { date: '$date', sport: '$sport' },
                stake: { $sum: '$stake' },
                profit: { $sum: '$profit' },
                count: { $sum: 1 },
                wins: { $sum: { $cond: [{ $eq: ['$status','won'] }, 1, 0] } },
                losses: { $sum: { $cond: [{ $eq: ['$status','lost'] }, 1, 0] } },
                pushes: { $sum: { $cond: [{ $eq: ['$status','push'] }, 1, 0] } },
              }
            },
            { $sort: { "_id.date": 1, "_id.sport": 1 } }
          ]
        }
      }
    ];

    const [facet] = await Pick.aggregate(pipeline);
    const daily = (facet?.daily || []).map(d => ({
      date: d._id, stake: d.stake, profit: d.profit,
      count: d.count, wins: d.wins, losses: d.losses, pushes: d.pushes,
      roi: d.stake > 0 ? d.profit / d.stake : null
    }));
    const bySport = (facet?.bySport || []).map(x => ({ key: x._id || '—', ...withRates(x) }));
    const byMarket = (facet?.byMarket || []).map(x => ({ key: x._id || '—', ...withRates(x) }));
    const byBook = (facet?.byBook || []).map(x => ({ key: x._id || '—', ...withRates(x) }));
    const bySportDaily = (facet?.bySportDaily || []).map(x => ({
      date: x._id?.date, sport: x._id?.sport || '—',
      stake: x.stake, profit: x.profit, count: x.count,
      wins: x.wins, losses: x.losses, pushes: x.pushes,
      roi: x.stake > 0 ? x.profit / x.stake : null
    }));

    const totals = daily.reduce((a, d) => {
      a.stake += d.stake; a.profit += d.profit;
      a.count += d.count; a.wins += d.wins; a.losses += d.losses; a.pushes += d.pushes;
      return a;
    }, { stake: 0, profit: 0, count: 0, wins: 0, losses: 0, pushes: 0 });
    const winrate = (totals.wins + totals.losses) > 0 ? totals.wins / (totals.wins + totals.losses) : null;
    const roi = totals.stake > 0 ? totals.profit / totals.stake : null;

    res.json({
      ok: true,
      data: {
        windowDays: days,
        from: from.toISOString(),
        to: now.toISOString(),
        totals: { ...totals, winrate, roi },
        series: { daily, bySportDaily },
        splits: { bySport, byMarket, byBook }
      }
    });
  } catch (err) {
    next(err);
  }
};

function withRates(x) {
  const stake = x.stake || 0;
  const profit = x.profit || 0;
  const wins = x.wins || 0;
  const losses = x.losses || 0;
  const wr = (wins + losses) > 0 ? wins / (wins + losses) : null;
  const roi = stake > 0 ? profit / stake : null;
  return { stake, profit, count: x.count || 0, wins, losses, pushes: x.pushes || 0, winrate: wr, roi };
}
