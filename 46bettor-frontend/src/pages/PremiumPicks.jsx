/* eslint-env browser */
import { useEffect, useMemo, useState } from 'react';
import ShareButton from '../components/ShareButton.jsx';

const getApiBase = () =>
  localStorage.getItem('apiBase') ||
  import.meta.env.VITE_API_BASE ||
  'https://api.46bettor.com';

const getAdminKey = () => localStorage.getItem('adminKey') || '';

function normalizeFromProtected(docs = []) {
  // /api/premium/today (protected) returns _id and other fields
  return docs.map((p) => ({
    id: p._id || p.id,
    date: p.date,
    sport: p.sport,
    league: p.league,
    eventId: p.eventId,
    homeTeam: p.homeTeam,
    awayTeam: p.awayTeam,
    market: p.market,
    selection: p.selection,
    line: p.line,
    odds: p.odds,
    status: p.status,
    finalScore: p.finalScore,
    tags: p.tags || [],
    settledAt: p.settledAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

function normalizeFromPublic(arr = []) {
  // /api/public/scoreboard returns id already
  return arr.map((p) => ({ ...p }));
}

export default function PremiumPicks() {
  const [picks, setPicks] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const apiBase = useMemo(getApiBase, []);
  const adminKey = useMemo(getAdminKey, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr('');
      try {
        if (adminKey) {
          // Try protected first
          const r = await fetch(`${apiBase}/api/premium/today`, {
            headers: { 'x-admin-key': adminKey },
          });
          if (r.ok) {
            const j = await r.json();
            setPicks(normalizeFromProtected(j?.picks || []));
            setLoading(false);
            return;
          }
        }
        // Fallback to public
        const r2 = await fetch(`${apiBase}/api/public/scoreboard`);
        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
        const j2 = await r2.json();
        setPicks(normalizeFromPublic(j2?.picks || []));
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiBase, adminKey]);

  if (loading) return <div className="p-6">Loading picks…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  if (!picks.length) {
    return <div className="p-6 text-gray-600">No picks right now.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-bold mb-2">Premium Picks</h1>
      <div className="grid gap-3">
        {picks.map((p) => {
          const shareUrl = `https://app.46bettor.com/p/${p.id}`;
          return (
            <div key={p.id} className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500 font-mono">{p.id}</div>
                <div className="font-semibold">
                  {p.date} — {p.sport}{p.league ? ` (${p.league})` : ""}
                </div>
                <div className="text-gray-700">
                  {p.homeTeam ?? 'Home'} vs {p.awayTeam ?? 'Away'}
                </div>
                <div className="text-gray-700">
                  {p.market?.toUpperCase()} • <b>{p.selection}</b>
                  {p.line != null ? <> • Line: <span className="font-mono">{p.line}</span></> : null}
                  • Odds: <span className="font-mono">{p.odds}</span>
                </div>
                {Array.isArray(p.tags) && p.tags.length > 0 && (
                  <div className="text-sm text-gray-600">Tags: {p.tags.join(", ")}</div>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  className="rounded-xl px-3 py-1.5 border hover:bg-gray-50"
                  href={`/p/${p.id}`}
                  title="Open details"
                >
                  Details
                </a>
                <ShareButton url={shareUrl} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
