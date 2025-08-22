// routes/public-extras.js
// Public endpoints for Weather, News, Highlights.
// Uses server-side API keys from environment variables (no keys exposed to the browser).

const express = require('express');
const router = express.Router();

// Node 18+ has global fetch
const OW_KEY   = process.env.OPENWEATHER_API_KEY || '';
const NEWS_KEY = process.env.NEWS_API_KEY || '';
const YT_KEY   = process.env.YOUTUBE_API_KEY || '';

function bad(res, msg, code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}

// GET /api/public/weather?city=Miami[&units=imperial]
//    or /api/public/weather?lat=25.7617&lon=-80.1918[&units=imperial]
router.get('/weather', async (req, res) => {
  const { city, lat, lon, units = 'imperial' } = req.query;
  if (!OW_KEY) return bad(res, 'OPENWEATHER_API_KEY not configured on server');

  let url;
  if (lat && lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=${encodeURIComponent(units)}&appid=${OW_KEY}`;
  } else if (city) {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${encodeURIComponent(units)}&appid=${OW_KEY}`;
  } else {
    return bad(res, 'Provide ?city= or ?lat=&lon=');
  }

  try {
    const r = await fetch(url);
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return bad(res, `GET ${url} -> ${r.status} ${r.statusText} ${t}`);
    }
    const j = await r.json();
    const out = {
      ok: true,
      provider: 'openweather',
      city: j.name || city || null,
      coords: j.coord || null,
      temp: j?.main?.temp ?? null,
      feelsLike: j?.main?.feels_like ?? null,
      weather: j?.weather?.[0]?.description || null,
      wind: j.wind || null,
      raw: j,
    };
    res.json(out);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GET /api/public/news?q=nba&pageSize=10&language=en
router.get('/news', async (req, res) => {
  const { q = 'nba', pageSize = '10', language = 'en' } = req.query;
  if (!NEWS_KEY) return bad(res, 'NEWS_API_KEY not configured on server');

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&language=${encodeURIComponent(language)}&pageSize=${encodeURIComponent(pageSize)}`;
  try {
    const r = await fetch(url, { headers: { 'X-Api-Key': NEWS_KEY } });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return bad(res, `GET ${url} -> ${r.status} ${r.statusText} ${t}`);
    }
    const j = await r.json();
    const items = (j.articles || []).map((a) => ({
      title: a.title,
      source: a.source?.name,
      url: a.url,
      publishedAt: a.publishedAt,
      description: a.description,
    }));
    res.json({ ok: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GET /api/public/highlights?q=nba highlights&maxResults=6
router.get('/highlights', async (req, res) => {
  const { q = 'nba highlights', maxResults = '6' } = req.query;
  if (!YT_KEY) return bad(res, 'YOUTUBE_API_KEY not configured on server');

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=${encodeURIComponent(maxResults)}&q=${encodeURIComponent(q)}&key=${YT_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return bad(res, `GET ${url} -> ${r.status} ${r.statusText} ${t}`);
    }
    const j = await r.json();
    const items = (j.items || []).map((x) => ({
      id: x.id?.videoId,
      title: x.snippet?.title,
      channelTitle: x.snippet?.channelTitle,
      publishedAt: x.snippet?.publishedAt,
      thumb: x.snippet?.thumbnails?.medium?.url || x.snippet?.thumbnails?.default?.url || null,
      url: x.id?.videoId ? `https://www.youtube.com/watch?v=${x.id.videoId}` : null,
    }));
    res.json({ ok: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

module.exports = router;
