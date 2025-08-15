// controllers/dashboardController.js
const Pick = require('../models/Pick');

exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();

    const [total, pending, won, lost, push, voidCt] = await Promise.all([
      Pick.countDocuments({}),
      Pick.countDocuments({ status: 'pending' }),
      Pick.countDocuments({ status: 'won' }),
      Pick.countDocuments({ status: 'lost' }),
      Pick.countDocuments({ status: 'push' }),
      Pick.countDocuments({ status: 'void' }),
    ]);

    // Pending money snapshot
    const [pendAgg] = await Pick.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: null,
          staked: { $sum: { $ifNull: ['$stake', 0] } },
          toWin: { $sum: { $ifNull: ['$toWin', 0] } },
        },
      },
    ]);

    // Realized profit from completed picks (won/lost/push/void)
    const [realAgg] = await Pick.aggregate([
      { $match: { status: { $in: ['won', 'lost', 'push', 'void'] } } },
      {
        $project: {
          stake: { $ifNull: ['$stake', 0] },
          toWin: { $ifNull: ['$toWin', 0] },
          status: 1,
          realizedProfit: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'won'] }, then: { $ifNull: ['$toWin', 0] } },
                { case: { $eq: ['$status', 'lost'] }, then: { $multiply: [{ $ifNull: ['$stake', 0] }, -1] } },
                // push/void -> 0
              ],
              default: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          realizedProfit: { $sum: '$realizedProfit' },
          stakedCompleted: {
            // stake only counts against ROI when a result occurs (lost); wins don’t risk more than stake either way
            $sum: {
              $cond: [{ $eq: ['$status', 'lost'] }, { $ifNull: ['$stake', 0] }, 0],
            },
          },
          wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
        },
      },
    ]);

    const recent = await Pick.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const upcoming = await Pick.find({
      status: 'pending',
      startTime: { $gte: now },
    })
      .sort({ startTime: 1 })
      .limit(10)
      .lean();

    const stakedPending = pendAgg?.staked || 0;
    const potentialWinPending = pendAgg?.toWin || 0;

    const realizedProfit = realAgg?.realizedProfit || 0;
    const stakedCompleted = realAgg?.stakedCompleted || 0;
    const roiPct = stakedCompleted > 0 ? (realizedProfit / stakedCompleted) * 100 : null;

    res.json({
      ok: true,
      data: {
        counts: { total, pending, won, lost, push, void: voidCt },
        money: {
          pending: {
            staked: round2(stakedPending),
            toWin: round2(potentialWinPending),
          },
          realizedProfit: round2(realizedProfit),
          roiPct: roiPct != null ? round2(roiPct) : null,
          wins: realAgg?.wins || 0,
          losses: realAgg?.losses || 0,
        },
        upcoming,
        recent,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

function round2(x) {
  return Math.round((Number(x || 0) + Number.EPSILON) * 100) / 100;
}
