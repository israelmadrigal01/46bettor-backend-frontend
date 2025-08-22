/* eslint-env browser */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const SPORTS = [
  { key: 'nba', label: 'NBA' },
  { key: 'nfl', label: 'NFL' },
  { key: 'mlb', label: 'MLB' },
  { key: 'nhl', label: 'NHL' },
  { key: 'soccer', label: 'Soccer (PL)' },
];

function fmtDateInput(d) {
  // YYYY-MM-DD in local time
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

export default function Scoreboard() {
  const [sport, setSport] = useState('nba');
  const [date, setDate] = useState(fmtDateInput(new Date()));
  const [state, setState] = useState({ loading: false, items: [], err: '' });

  const title = useMemo(() => {
    const found = SPORTS.find((s) => s.key === sport);
    return `${found?.label || sport} — ${date}`;
  }, [sport, date]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, err: '' }));
      try {
        // today’s NBA may return 0 in off-season; date helps test known-good
        const res = await api.schedule(sport, date);
        if (aborted) return;
        const items = res?.items || res?.games || res || [];
        setState({ loading: false, items: Array.isArray(items) ? items : [], err: '' });
      } catch (e) {
        if (aborted) return;
        setState({ loading: false, items: [], err: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { aborted = true; };
  }, [sport, date]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Scoreboard</h1>

      {/* Controls */}
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
          onClick={() => setDate(fmtDateInput(new Date()))}
          title="Jump to today"
        >
          Today
        </button>
      </div>

      {/* States */}
      {state.loading && <div>Loading…</div>}
      {state.err && (
        <div className="border rounded-xl p-3 bg-red-50 text-red-700">
          Error: {state.err}
        </div>
      )}

      {!state.loading && !state.err && (
        <>
          <div className="text-sm text-gray-600">{title}</div>
          {state.items.length === 0 ? (
            <div className="border rounded-xl p-4">No games found for that selection.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {state.items.map((g, idx) => (
                <div key={g.id || idx} className="border rounded-xl p-3">
                  <div className="text-xs text-gray-500">{g.sport || sport}</div>
                  <div className="font-semibold">
                    {(g.awayTeam || g.away) ?? 'Away'} @ {(g.homeTeam || g.home) ?? 'Home'}
                  </div>
                  <div className="text-sm">
                    {g.status || 'Scheduled'}
                    {typeof g.homeScore === 'number' || typeof g.awayScore === 'number' ? (
                      <span className="ml-2">
                        {g.awayScore ?? '-'}–{g.homeScore ?? '-'}
                      </span>
                    ) : null}
                  </div>
                  {g.startsAt && (
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(g.startsAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
