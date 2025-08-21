// src/components/RecentList.jsx
/* eslint-env browser */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';

function fmtOdds(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v); if (Number.isNaN(n)) return String(v);
  return n > 0 ? `+${n}` : `${n}`;
}

export default function RecentList() {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.recent();
        if (!cancelled) setState({ loading: false, items: r || [], error: '' });
      } catch (e) {
        if (!cancelled) setState({ loading: false, items: [], error: String(e.message || e) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sports = useMemo(() => {
    const s = new Set();
    for (const it of state.items) if (it?.sport) s.add(it.sport);
    return ['ALL', ...Array.from(s).sort()];
  }, [state.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = state.items;
    if (sport !== 'ALL') arr = arr.filter(it => (it?.sport || '').toLowerCase() === sport.toLowerCase());
    if (q) arr = arr.filter(it => JSON.stringify(it).toLowerCase().includes(q));
    return arr.slice(0, 100);
  }, [state.items, query, sport]);

  if (state.loading) return <div>Loading recent…</div>;
  if (state.error)   return <div style={{ color: '#b91c1c' }}>Recent error: {state.error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recent…" style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px' }}
        />
        <select
          value={sport} onChange={(e) => setSport(e.target.value)}
          style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px' }}
        >
          {sports.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ border: '1px dashed #d1d5db', borderRadius: 12, padding: 16 }}>No recent items.</div>
      ) : (
        <div role="table" style={{ width: '100%', borderTop: '1px solid #e5e7eb' }}>
          <div role="row" style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 90px', gap: 8,
            padding: '10px 0', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 700,
          }}>
            <div>Matchup</div><div>Market</div><div>Selection</div><div>Odds</div><div>Action</div>
          </div>

          {filtered.map((it, idx) => {
            const home = it.homeTeam || it.home || '';
            const away = it.awayTeam || it.away || '';
            const title = home && away ? `${away} @ ${home}` : it.title || it.matchup || 'Recent item';
            const market = it.market ?? it.type ?? '-';
            const selection = it.selection ?? it.pick ?? it.side ?? '-';
            const odds = fmtOdds(it.odds ?? it.price ?? it.moneyline);
            const id = it.id || it._id || String(idx);

            return (
              <div key={id} role="row" style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 90px', gap: 8,
                padding: '12px 0', borderBottom: '1px solid #e5e7eb', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{it.sport || it.league || ''}</div>
                </div>
                <div>{market}</div>
                <div>{selection}</div>
                <div>{odds}</div>
                <div>
                  {it.id
                    ? <Link to={`/p/${encodeURIComponent(it.id)}`} style={{ textDecoration: 'underline' }}>View</Link>
                    : <span style={{ color: '#9ca3af' }}>—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
