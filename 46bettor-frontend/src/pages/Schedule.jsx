/* eslint-env browser */
import { useEffect, useState } from 'react';
import { api } from '../api/client';

const SPORTS = [
  { key: 'nba', label: 'NBA' },
  { key: 'nfl', label: 'NFL' },
  { key: 'mlb', label: 'MLB' },
  { key: 'nhl', label: 'NHL' },
  { key: 'soccer', label: 'Soccer (PL)' },
];

function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Schedule() {
  const [sport, setSport] = useState('nba');
  const [date, setDate] = useState(ymd(new Date()));
  const [state, setState] = useState({ loading: false, items: [], err: '' });

  useEffect(() => {
    let dead = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, err: '' }));
      try {
        const res = await api.schedule(sport, date);
        if (dead) return;
        const items = res?.items || res?.games || res || [];
        setState({ loading: false, items: Array.isArray(items) ? items : [], err: '' });
      } catch (e) {
        if (dead) return;
        setState({ loading: false, items: [], err: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { dead = true; };
  }, [sport, date]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Schedule</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <div className="mb-1 font-medium">Sport</div>
          <select
            className="border rounded-xl px-3 py-2"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            {SPORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 font-medium">Date</div>
          <input
            type="date"
            className="border rounded-xl px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <button
          className="rounded-2xl px-4 py-2 bg-black text-white"
          onClick={() => setDate(ymd(new Date()))}
        >
          Today
        </button>
      </div>

      {state.loading && <div>Loading…</div>}
      {state.err && (
        <div className="border rounded-xl p-3 bg-red-50 text-red-700">Error: {state.err}</div>
      )}

      {!state.loading && !state.err && (
        state.items.length === 0 ? (
          <div className="border rounded-xl p-4">No games scheduled.</div>
        ) : (
          <table className="w-full border rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Matchup</th>
                <th className="p-2">Status / Score</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((g, i) => (
                <tr key={g.id || i} className="border-t">
                  <td className="p-2 text-sm text-gray-600">
                    {g.startsAt ? new Date(g.startsAt).toLocaleString() : '—'}
                  </td>
                  <td className="p-2">
                    {(g.awayTeam || g.away) ?? 'Away'} @ {(g.homeTeam || g.home) ?? 'Home'}
                  </td>
                  <td className="p-2 text-sm">
                    {g.status || 'Scheduled'}
                    {(typeof g.awayScore === 'number' || typeof g.homeScore === 'number') &&
                      ` — ${g.awayScore ?? '-'}–${g.homeScore ?? '-'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
