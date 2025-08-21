/* eslint-env browser */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Schedule() {
  const [sport, setSport] = useState('nba'); // we support NBA now
  const [date, setDate] = useState(todayISO());
  const [state, setState] = useState({ loading: false, error: null, items: [] });

  const load = async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const out = await api.schedule(sport, date);
      const items = Array.isArray(out?.items) ? out.items : [];
      setState({ loading: false, error: null, items });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : String(err), items: [] });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, date]);

  const firstGameText = useMemo(() => {
    if (!state.items.length) return '';
    const d = new Date(state.items[0].startsAt || date);
    return d.toLocaleString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.items, date]);

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
            <option value="nba">NBA (balldontlie)</option>
            {/* Future: <option value="soccer">Soccer</option> etc. */}
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
          onClick={load}
          className="rounded-2xl px-4 py-2 bg-black text-white"
        >
          Refresh
        </button>

        {/* Helper to jump to a known-good day during offseason */}
        <button
          onClick={() => setDate('2025-02-01')}
          className="rounded-2xl px-4 py-2 border"
          title="Known good NBA day"
        >
          Jump to Feb 1, 2025
        </button>
      </div>

      {state.loading && <div>Loading…</div>}
      {state.error && (
        <div className="text-red-600">
          Error: {state.error}
        </div>
      )}

      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="border rounded-xl p-4">
          No games for {sport.toUpperCase()} on {date}. Try changing the date (offseason?).
        </div>
      )}

      {!state.loading && !state.error && state.items.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            Games: <b>{state.items.length}</b>{' '}
            {firstGameText && <span>• First starts: {firstGameText}</span>}
          </div>

          <div className="border rounded-xl overflow-hidden">
            <div
              className="grid gap-2 font-semibold text-xs text-gray-600 border-b p-2"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
            >
              <div>Matchup</div>
              <div>Status</div>
              <div>Tip</div>
              <div>Score (A)</div>
              <div>Score (H)</div>
            </div>
            {state.items.map((g, idx) => {
              const tip = g.startsAt ? new Date(g.startsAt).toLocaleTimeString() : '-';
              const title = g.awayTeam && g.homeTeam ? `${g.awayTeam} @ ${g.homeTeam}` : g.id;
              return (
                <div
                  key={g.id || idx}
                  className="grid gap-2 p-2 border-b last:border-0"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
                >
                  <div className="font-medium">{title}</div>
                  <div>{g.status || '-'}</div>
                  <div>{tip}</div>
                  <div>{g.awayScore ?? '-'}</div>
                  <div>{g.homeScore ?? '-'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
