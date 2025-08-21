// integrations/balldontlie.js (CommonJS)
// Fetch NBA games from balldontlie with proper Authorization header.

const axios = require("axios");

function getKey() {
  // Support either name
  return process.env.BALLDONTLIE_API_KEY || process.env.BALLDONTLIE_KEY || "";
}

/**
 * fetchNBAGames({ date: 'YYYY-MM-DD', signal? })
 */
async function fetchNBAGames({ date, signal }) {
  const key = getKey();
  if (!key) {
    return { ok: false, error: "balldontlie key missing (set BALLDONTLIE_API_KEY in Render env)" };
  }

  const url = "https://api.balldontlie.io/v1/games";
  const params = { "dates[]": date, per_page: 100 };

  try {
    const resp = await axios.get(url, {
      params,
      signal,
      timeout: 12000,
      headers: {
        Authorization: `Bearer ${key}`,   // REQUIRED by balldontlie
        Accept: "application/json",
      },
    });

    const data = resp?.data?.data ?? [];
    const items = data.map((g) => ({
      provider: "balldontlie",
      sport: "NBA",
      league: "NBA",
      id: String(g.id),
      startsAt: g.date,
      status: g.status || "",
      homeTeam: g.home_team?.full_name || g.home_team?.name || g.home_team?.abbreviation || "",
      awayTeam: g.visitor_team?.full_name || g.visitor_team?.name || g.visitor_team?.abbreviation || "",
      homeScore: Number.isFinite(g.home_team_score) ? g.home_team_score : null,
      awayScore: Number.isFinite(g.visitor_team_score) ? g.visitor_team_score : null,
      extras: { season: g.season, period: g.period, postseason: g.postseason },
    }));

    return { ok: true, provider: "balldontlie", count: items.length, items };
  } catch (e) {
    const msg =
      e?.response?.data ||
      (e?.response?.status ? `HTTP ${e.response.status}` : e?.message) ||
      "upstream_error";
    return { ok: false, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
  }
}

module.exports = { fetchNBAGames };
