// services/picksLiveService.js
const { fetchLiveScores } = require('./liveScoresService');

/* ===========================================================
   Team metadata (abbreviations + aliases) for MLB, NBA, NFL
   Used for fuzzy matching (e.g., "NYY", "Yankees", "New York Yankees")
   =========================================================== */

/* ------------------------------ MLB ------------------------------ */
const MLB_TEAMS = [
  { abbr: 'ARI', city: 'Arizona',        nickname: 'Diamondbacks', aliases: ['Dbacks','D-Backs','Snakes','ARZ','AZ'] },
  { abbr: 'ATL', city: 'Atlanta',        nickname: 'Braves',       aliases: [] },
  { abbr: 'BAL', city: 'Baltimore',      nickname: 'Orioles',      aliases: ['Os','O’s'] },
  { abbr: 'BOS', city: 'Boston',         nickname: 'Red Sox',      aliases: ['Sox'] },
  { abbr: 'CHC', city: 'Chicago',        nickname: 'Cubs',         aliases: [] },
  { abbr: 'CWS', city: 'Chicago',        nickname: 'White Sox',    aliases: ['CHW','Sox'] },
  { abbr: 'CIN', city: 'Cincinnati',     nickname: 'Reds',         aliases: [] },
  { abbr: 'CLE', city: 'Cleveland',      nickname: 'Guardians',    aliases: [] },
  { abbr: 'COL', city: 'Colorado',       nickname: 'Rockies',      aliases: [] },
  { abbr: 'DET', city: 'Detroit',        nickname: 'Tigers',       aliases: [] },
  { abbr: 'HOU', city: 'Houston',        nickname: 'Astros',       aliases: [] },
  { abbr: 'KC',  city: 'Kansas City',    nickname: 'Royals',       aliases: ['KCR'] },
  { abbr: 'LAA', city: 'Los Angeles',    nickname: 'Angels',       aliases: ['ANA','Angels of Anaheim'] },
  { abbr: 'LAD', city: 'Los Angeles',    nickname: 'Dodgers',      aliases: ['LA'] },
  { abbr: 'MIA', city: 'Miami',          nickname: 'Marlins',      aliases: [] },
  { abbr: 'MIL', city: 'Milwaukee',      nickname: 'Brewers',      aliases: [] },
  { abbr: 'MIN', city: 'Minnesota',      nickname: 'Twins',        aliases: [] },
  { abbr: 'NYM', city: 'New York',       nickname: 'Mets',         aliases: [] },
  { abbr: 'NYY', city: 'New York',       nickname: 'Yankees',      aliases: [] },
  { abbr: 'OAK', city: 'Oakland',        nickname: 'Athletics',    aliases: ['A’s','As',"A's"] },
  { abbr: 'PHI', city: 'Philadelphia',   nickname: 'Phillies',     aliases: [] },
  { abbr: 'PIT', city: 'Pittsburgh',     nickname: 'Pirates',      aliases: [] },
  { abbr: 'SD',  city: 'San Diego',      nickname: 'Padres',       aliases: ['SDP'] },
  { abbr: 'SEA', city: 'Seattle',        nickname: 'Mariners',     aliases: [] },
  { abbr: 'SF',  city: 'San Francisco',  nickname: 'Giants',       aliases: ['SFG'] },
  { abbr: 'STL', city: 'St. Louis',      nickname: 'Cardinals',    aliases: [] },
  { abbr: 'TB',  city: 'Tampa Bay',      nickname: 'Rays',         aliases: ['TBR'] },
  { abbr: 'TEX', city: 'Texas',          nickname: 'Rangers',      aliases: [] },
  { abbr: 'TOR', city: 'Toronto',        nickname: 'Blue Jays',    aliases: [] },
  { abbr: 'WSH', city: 'Washington',     nickname: 'Nationals',    aliases: ['WSN'] },
];

/* ------------------------------ NBA ------------------------------ */
const NBA_TEAMS = [
  { abbr: 'ATL', city: 'Atlanta',       nickname: 'Hawks',       aliases: [] },
  { abbr: 'BOS', city: 'Boston',        nickname: 'Celtics',     aliases: [] },
  { abbr: 'BKN', city: 'Brooklyn',      nickname: 'Nets',        aliases: [] },
  { abbr: 'CHA', city: 'Charlotte',     nickname: 'Hornets',     aliases: [] },
  { abbr: 'CHI', city: 'Chicago',       nickname: 'Bulls',       aliases: [] },
  { abbr: 'CLE', city: 'Cleveland',     nickname: 'Cavaliers',   aliases: ['Cavs'] },
  { abbr: 'DAL', city: 'Dallas',        nickname: 'Mavericks',   aliases: ['Mavs'] },
  { abbr: 'DEN', city: 'Denver',        nickname: 'Nuggets',     aliases: [] },
  { abbr: 'DET', city: 'Detroit',       nickname: 'Pistons',     aliases: [] },
  { abbr: 'GSW', city: 'Golden State',  nickname: 'Warriors',    aliases: ['Dubs'] },
  { abbr: 'HOU', city: 'Houston',       nickname: 'Rockets',     aliases: [] },
  { abbr: 'IND', city: 'Indiana',       nickname: 'Pacers',      aliases: [] },
  { abbr: 'LAC', city: 'LA',            nickname: 'Clippers',    aliases: ['Clips','Los Angeles Clippers'] },
  { abbr: 'LAL', city: 'LA',            nickname: 'Lakers',      aliases: ['Los Angeles Lakers'] },
  { abbr: 'MEM', city: 'Memphis',       nickname: 'Grizzlies',   aliases: [] },
  { abbr: 'MIA', city: 'Miami',         nickname: 'Heat',        aliases: [] },
  { abbr: 'MIL', city: 'Milwaukee',     nickname: 'Bucks',       aliases: [] },
  { abbr: 'MIN', city: 'Minnesota',     nickname: 'Timberwolves',aliases: ['Wolves','T-Wolves','T Wolves'] },
  { abbr: 'NOP', city: 'New Orleans',   nickname: 'Pelicans',    aliases: ['Pels'] },
  { abbr: 'NYK', city: 'New York',      nickname: 'Knicks',      aliases: [] },
  { abbr: 'OKC', city: 'Oklahoma City', nickname: 'Thunder',     aliases: [] },
  { abbr: 'ORL', city: 'Orlando',       nickname: 'Magic',       aliases: [] },
  { abbr: 'PHI', city: 'Philadelphia',  nickname: '76ers',       aliases: ['Sixers','Seventy Sixers','76 ers'] },
  { abbr: 'PHX', city: 'Phoenix',       nickname: 'Suns',        aliases: [] },
  { abbr: 'POR', city: 'Portland',      nickname: 'Trail Blazers',aliases:['Blazers'] },
  { abbr: 'SAC', city: 'Sacramento',    nickname: 'Kings',       aliases: [] },
  { abbr: 'SAS', city: 'San Antonio',   nickname: 'Spurs',       aliases: [] },
  { abbr: 'TOR', city: 'Toronto',       nickname: 'Raptors',     aliases: [] },
  { abbr: 'UTA', city: 'Utah',          nickname: 'Jazz',        aliases: [] },
  { abbr: 'WAS', city: 'Washington',    nickname: 'Wizards',     aliases: [] },
];

/* ------------------------------ NFL ------------------------------ */
const NFL_TEAMS = [
  { abbr: 'ARI', city: 'Arizona',      nickname: 'Cardinals',  aliases: [] },
  { abbr: 'ATL', city: 'Atlanta',      nickname: 'Falcons',    aliases: [] },
  { abbr: 'BAL', city: 'Baltimore',    nickname: 'Ravens',     aliases: [] },
  { abbr: 'BUF', city: 'Buffalo',      nickname: 'Bills',      aliases: [] },
  { abbr: 'CAR', city: 'Carolina',     nickname: 'Panthers',   aliases: [] },
  { abbr: 'CHI', city: 'Chicago',      nickname: 'Bears',      aliases: [] },
  { abbr: 'CIN', city: 'Cincinnati',   nickname: 'Bengals',    aliases: [] },
  { abbr: 'CLE', city: 'Cleveland',    nickname: 'Browns',     aliases: [] },
  { abbr: 'DAL', city: 'Dallas',       nickname: 'Cowboys',    aliases: [] },
  { abbr: 'DEN', city: 'Denver',       nickname: 'Broncos',    aliases: [] },
  { abbr: 'DET', city: 'Detroit',      nickname: 'Lions',      aliases: [] },
  { abbr: 'GB',  city: 'Green Bay',    nickname: 'Packers',    aliases: ['GBP','GNB'] },
  { abbr: 'HOU', city: 'Houston',      nickname: 'Texans',     aliases: [] },
  { abbr: 'IND', city: 'Indianapolis', nickname: 'Colts',      aliases: [] },
  { abbr: 'JAX', city: 'Jacksonville', nickname: 'Jaguars',    aliases: ['JAC'] },
  { abbr: 'KC',  city: 'Kansas City',  nickname: 'Chiefs',     aliases: ['KCC'] },
  { abbr: 'LV',  city: 'Las Vegas',    nickname: 'Raiders',    aliases: ['LVR','OAK'] },
  { abbr: 'LAC', city: 'Los Angeles',  nickname: 'Chargers',   aliases: ['SD','SDC'] },
  { abbr: 'LAR', city: 'Los Angeles',  nickname: 'Rams',       aliases: ['STL'] },
  { abbr: 'MIA', city: 'Miami',        nickname: 'Dolphins',   aliases: [] },
  { abbr: 'MIN', city: 'Minnesota',    nickname: 'Vikings',    aliases: [] },
  { abbr: 'NE',  city: 'New England',  nickname: 'Patriots',   aliases: ['NEP'] },
  { abbr: 'NO',  city: 'New Orleans',  nickname: 'Saints',     aliases: ['NOS'] },
  { abbr: 'NYG', city: 'New York',     nickname: 'Giants',     aliases: [] },
  { abbr: 'NYJ', city: 'New York',     nickname: 'Jets',       aliases: [] },
  { abbr: 'PHI', city: 'Philadelphia', nickname: 'Eagles',     aliases: [] },
  { abbr: 'PIT', city: 'Pittsburgh',   nickname: 'Steelers',   aliases: [] },
  { abbr: 'SF',  city: 'San Francisco',nickname: '49ers',      aliases: ['Niners','SF49ers'] },
  { abbr: 'SEA', city: 'Seattle',      nickname: 'Seahawks',   aliases: [] },
  { abbr: 'TB',  city: 'Tampa Bay',    nickname: 'Buccaneers', aliases: ['Bucs'] },
  { abbr: 'TEN', city: 'Tennessee',    nickname: 'Titans',     aliases: [] },
  { abbr: 'WAS', city: 'Washington',   nickname: 'Commanders', aliases: ['WFT','Football Team','Redskins'] },
];

/* ----------------------- alias map builders ---------------------- */
const _norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function buildAliasMaps(teams) {
  const BY_ABBR = new Map();   // abbr(norm) -> team
  const ALIASES = new Map();   // alias(norm) -> abbr
  for (const t of teams) {
    const full = `${t.city} ${t.nickname}`;
    const abbr = t.abbr;
    BY_ABBR.set(_norm(abbr), t);

    const names = [
      full,
      t.nickname,
      abbr,
      ...t.aliases,
      full.replace(/\s+/g, ''),       // NewYorkGiants
      t.nickname.replace(/\s+/g, ''), // RedSox / 49ers
    ];
    for (const n of names) ALIASES.set(_norm(n), abbr);
  }
  return { BY_ABBR, ALIASES };
}

const ALIAS_REGISTRY = {
  mlb: buildAliasMaps(MLB_TEAMS),
  nba: buildAliasMaps(NBA_TEAMS),
  nfl: buildAliasMaps(NFL_TEAMS),
};

/* ----------------------------- utils ----------------------------- */
function uniq(arr) {
  const set = new Set(arr.filter(Boolean));
  return Array.from(set);
}
function tokensPlusCombined(str) {
  const s = String(str || '').trim();
  if (!s) return [];
  const parts = s.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return uniq([s, ...parts, parts.join('')]);
}
function extractFromMatchup(str = '') {
  // supports "A @ B", "A@B", "A vs B", "A v. B"
  const parts = String(str).split(/@|vs|v\./i).map((x) => x && x.trim());
  return parts.filter(Boolean);
}
function teamAliasesForMatching(league, raw) {
  const reg = ALIAS_REGISTRY[String(league || '').toLowerCase()];
  const out = new Set();
  for (const tok of tokensPlusCombined(raw)) {
    const key = _norm(tok);
    out.add(key);
    if (reg?.ALIASES?.has(key)) {
      const abbr = reg.ALIASES.get(key);
      out.add(_norm(abbr));
      const meta = reg.BY_ABBR.get(_norm(abbr));
      if (meta) {
        out.add(_norm(meta.nickname));
        out.add(_norm(`${meta.city} ${meta.nickname}`));
        out.add(_norm(meta.nickname.replace(/\s+/g, '')));
      }
    }
  }
  return Array.from(out);
}

/* ------------------------ multi-day fetch ------------------------ */
// Fetch games for date ± flexDays and merge (dedupe by league:gameId)
async function fetchGamesFlex({ league, sport, date, demo, flexDays = 0 }) {
  if (!date || !Number.isInteger(flexDays) || flexDays <= 0) {
    return fetchLiveScores({ league, sport, date, demo, save: false });
  }

  const dates = [];
  const n = Math.max(0, Math.min(flexDays, 180)); // safety cap (~season)
  for (let d = -n; d <= n; d++) {
    const y = Number(date.slice(0,4));
    const m = Number(date.slice(4,6)) - 1;
    const dd = Number(date.slice(6,8));
    const dt = new Date(Date.UTC(y, m, dd));
    dt.setUTCDate(dt.getUTCDate() + d);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd2 = String(dt.getUTCDate()).padStart(2, '0');
    dates.push(`${dt.getUTCFullYear()}${mm}${dd2}`);
  }

  const seen = new Set();
  const all = [];
  for (const d of dates) {
    const arr = await fetchLiveScores({ league, sport, date: d, demo, save: false });
    for (const g of arr) {
      const key = `${g.league}:${g.gameId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(g);
    }
  }
  return all.sort((a, b) => {
    const at = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
    return at - bt;
  });
}

/* ---------------------- index from live games -------------------- */
function buildGameIndex(games = []) {
  // index: alias -> [{ game, side }]
  const index = new Map();
  const push = (alias, game, side) => {
    const key = _norm(alias);
    if (!key) return;
    const lst = index.get(key) || [];
    lst.push({ game, side });
    index.set(key, lst);
  };

  for (const g of games) {
    const league = String(g.league || '').toLowerCase();
    const sides = [
      { team: g.homeTeam || {}, side: 'home' },
      { team: g.awayTeam || {}, side: 'away' },
    ];
    for (const s of sides) {
      const t = s.team;
      const fields = uniq([
        t.name, t.shortName, t.abbreviation,
        ...(tokensPlusCombined(t.name)),
        ...(tokensPlusCombined(t.shortName)),
        t.abbreviation,
      ]);
      fields.forEach((f) => push(f, g, s.side));
      for (const f of fields) {
        teamAliasesForMatching(league, f).forEach((alias) => push(alias, g, s.side));
      }
    }
  }
  return index;
}

/* ---------------------------- matching --------------------------- */
function findGameForSingleTeam(index, league, teamQuery) {
  const tokens = teamAliasesForMatching(league, teamQuery);
  // exact
  for (const t of tokens) {
    if (index.has(t)) return index.get(t)[0];
  }
  // fuzzy
  const keys = Array.from(index.keys());
  let best = null, bestLen = 0;
  for (const t of tokens) {
    for (const k of keys) {
      if (k.includes(t) || t.includes(k)) {
        if (k.length > bestLen) {
          best = index.get(k)[0];
          bestLen = k.length;
        }
      }
    }
  }
  return best;
}

function gameHasTeam(league, game, query) {
  const qTokens = teamAliasesForMatching(league, query);
  const gTokens = new Set();
  const fields = [
    game.homeTeam?.name, game.homeTeam?.shortName, game.homeTeam?.abbreviation,
    game.awayTeam?.name, game.awayTeam?.shortName, game.awayTeam?.abbreviation,
  ];
  for (const f of fields) {
    teamAliasesForMatching(league, f).forEach((x) => gTokens.add(x));
  }
  for (const qt of qTokens) if (gTokens.has(qt)) return true;
  return false;
}

function findGameForMatchup(games, league, teamA, teamB) {
  for (const g of games) {
    if (gameHasTeam(league, g, teamA) && gameHasTeam(league, g, teamB)) {
      const isHomeA = gameHasTeam(league, { ...g, awayTeam: {} }, teamA);
      const isAwayA = gameHasTeam(league, { ...g, homeTeam: {} }, teamA);
      const side = isHomeA ? 'home' : (isAwayA ? 'away' : null);
      return { game: g, side };
    }
  }
  return null;
}

/* -------------- nearest head-to-head fallback (season) -------------- */
function dateDistance(a, b) {
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb);
}

function findNearestHeadToHead(games, league, teamA, teamB, refDateISO) {
  const candidates = games.filter((g) => gameHasTeam(league, g, teamA) && gameHasTeam(league, g, teamB));
  if (!candidates.length) return null;
  if (!refDateISO) return { game: candidates[0], side: null, matchedDate: candidates[0]?.startTime || null };
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const g of candidates) {
    const dist = dateDistance(g.startTime, refDateISO);
    if (dist < bestDist) {
      bestDist = dist;
      best = g;
    }
  }
  return best ? { game: best, side: null, matchedDate: best.startTime || null } : null;
}

/* ---------------------- context derivation ----------------------- */
function deriveLiveContext(game, side, extras = {}) {
  const h = game.homeTeam?.score ?? 0;
  const a = game.awayTeam?.score ?? 0;
  let myScore = null, oppScore = null;
  if (side === 'home') { myScore = h; oppScore = a; }
  else if (side === 'away') { myScore = a; oppScore = h; }
  const winning = (myScore != null && oppScore != null) ? (myScore > oppScore) : null;

  return {
    league: game.league,
    sport: game.sport,
    status: game.status,
    startTime: game.startTime,
    period: game.period,
    clock: game.clock,
    tags: game.tags || [],
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    mySide: side || null,
    myScore, oppScore,
    winning,
    closeGame: (game.tags || []).includes('Close Game'),
    gameId: game.gameId,
    ...extras, // e.g., { matchedDate: ... }
  };
}

/* ------------------------------ public --------------------------- */
async function enrichPicks(picks = [], { league, sport, date, demo, flexDays, nearestHeadToHead = false, nearestFlexDays } = {}) {
  // First pass: fetch within given flex window (fast)
  const games = await fetchGamesFlex({ league, sport, date, demo, flexDays });
  const leagueForAliases = (league || games[0]?.league || 'mlb').toLowerCase();
  const index = buildGameIndex(games);

  const refISO = date && /^\d{8}$/.test(date)
    ? `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`
    : null;

  const out = [];

  for (const p of picks) {
    let match = null;
    let ctxExtras = {};

    // strict matchup if provided
    if (p.matchup) {
      const [teamA, teamB] = extractFromMatchup(p.matchup);
      if (teamA && teamB) {
        match = findGameForMatchup(games, leagueForAliases, teamA, teamB);

        // nearest fallback if not found
        if (!match && nearestHeadToHead) {
          // widen window (season-level) to look for the closest SF vs SEA, etc.
          const widen = Math.max(Number(nearestFlexDays || 0), Number(flexDays || 0), 120);
          const seasonGames = await fetchGamesFlex({ league, sport, date, demo, flexDays: widen });
          const nearest = findNearestHeadToHead(seasonGames, leagueForAliases, teamA, teamB, refISO);
          if (nearest) {
            match = { game: nearest.game, side: null };
            ctxExtras.matchedDate = nearest.matchedDate || null;
          }
        }
      }
    }

    // otherwise single-team
    if (!match) {
      const candidate = p.team || p.teamName || p.selection || p.pickTeam || p.abbreviation || p.shortName || p.name;
      if (candidate) match = findGameForSingleTeam(index, leagueForAliases, candidate);
    }

    if (!match) {
      out.push({ ...p, liveContext: null });
      continue;
    }
    const ctx = deriveLiveContext(match.game, match.side, ctxExtras);
    out.push({ ...p, liveContext: ctx });
  }

  return out;
}

function summarizeEnriched(enriched = []) {
  const out = { totals: { count: enriched.length, withContext: 0, pre: 0, in: 0, post: 0, winning: 0, closeGame: 0 } };
  for (const p of enriched) {
    const ctx = p.liveContext;
    if (ctx) {
      out.totals.withContext++;
      out.totals[ctx.status] = (out.totals[ctx.status] || 0) + 1;
      if (ctx.winning === true) out.totals.winning++;
      if (ctx.closeGame) out.totals.closeGame++;
    }
  }
  return out;
}

function listAliases(league = 'mlb') {
  const reg = ALIAS_REGISTRY[String(league).toLowerCase()];
  if (!reg) return [];
  const items = [];
  for (const [normAlias, abbr] of reg.ALIASES.entries()) {
    items.push({ alias: normAlias, abbr });
  }
  return items.sort((a, b) => a.alias.localeCompare(b.alias));
}

module.exports = {
  enrichPicks,
  summarizeEnriched,
  listAliases,
};
