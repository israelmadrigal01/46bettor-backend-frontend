// routes/public-odds.js
// Public odds proxy for The Odds API
// GET /api/public/odds/:sport   where :sport ∈ nba|nfl|mlb|nhl

const express = require("express");
const axios = require("axios");

const router = express.Router();

const SPORT_KEYS = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
};

function errJson(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

router.get("/odds/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    const oddsKey = process.env.ODDS_API_KEY;

    if (!SPORT_KEYS[sport]) {
      return errJson(res, 400, `Unsupported sport "${sport}". Use nba, nfl, mlb, nhl`);
    }
    if (!oddsKey) {
      return errJson(res, 500, "ODDS_API_KEY not configured");
    }

    // The Odds API v4 style (most common):
    // https://api.the-odds-api.com/v4/sports/{key}/odds
    // markets=h2h (moneyline), regions=us, oddsFormat=american
    const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEYS[sport]}/odds`;
    const params = {
      apiKey: oddsKey,
      regions: "us",
      markets: "h2h",
      oddsFormat: "american",
      dateFormat: "iso",
    };

    const resp = await axios.get(url, { params, timeout: 12000 });
    const raw = Array.isArray(resp.data) ? resp.data : [];

    // Normalize:
    const items = raw.map((game) => {
      // Each game has .commence_time, .home_team, .away_team, .bookmakers[...]
      const books = Array.isArray(game.bookmakers) ? game.bookmakers : [];
      // Extract best ML among books
      let bestHome = null, bestAway = null;
      const simplifiedBooks = [];

      for (const b of books) {
        const markets = b.markets || [];
        const h2h = markets.find((m) => m.key === "h2h");
        if (!h2h || !Array.isArray(h2h.outcomes)) continue;

        const oHome = h2h.outcomes.find((o) => o.name === game.home_team);
        const oAway = h2h.outcomes.find((o) => o.name === game.away_team);

        if (oHome && typeof oHome.price === "number") {
          bestHome = bestHome === null ? oHome.price : Math.max(bestHome, oHome.price);
        }
        if (oAway && typeof oAway.price === "number") {
          bestAway = bestAway === null ? oAway.price : Math.max(bestAway, oAway.price);
        }

        simplifiedBooks.push({
          key: b.key,
          title: b.title,
          lastUpdate: b.last_update,
        });
      }

      return {
        provider: "the-odds-api",
        sport: sport.toUpperCase(),
        id: game.id,
        startsAt: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        bestHomeML: bestHome,
        bestAwayML: bestAway,
        books: simplifiedBooks,
      };
    });

    res.json({ ok: true, count: items.length, items });
  } catch (e) {
    const msg = e?.response?.data || e?.message || "upstream_error";
    res.status(400).json({ ok: false, error: typeof msg === "string" ? msg : JSON.stringify(msg) });
  }
});

module.exports = router;
