// 46bettor-frontend/src/pages/Scoreboard.jsx
import React, { useEffect, useState } from "react";
import { API } from "../api/client";

function yyyy_mm_dd(date = new Date()) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function GameRow({ g }) {
  const when = new Date(g.startsAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className="border rounded-xl p-4 flex items-center justify-between">
      <div className="text-sm opacity-70">{when}</div>
      <div className="font-medium">
        {g.awayTeam} @ {g.homeTeam}
      </div>
      <div className="text-right">
        {g.status === "Final" || g.homeScore || g.awayScore ? (
          <div className="font-semibold">
            {g.awayScore ?? "-"}–{g.homeScore ?? "-"}
          </div>
        ) : (
          <span className="opacity-70">{g.status || "Scheduled"}</span>
        )}
      </div>
    </div>
  );
}

export default function Scoreboard() {
  const [sport, setSport] = useState("NBA");
  const [date, setDate] = useState(yyyy_mm_dd());
  const [state, setState] = useState({ loading: false, error: "", items: [] });

  async function load() {
    setState((s) => ({ ...s, loading: true, error: "" }));
    const res = await API.schedule(sport, date); // legacy-friendly helper
    if (res?.ok) setState({ loading: false, error: "", items: res.items || [] });
    else setState({ loading: false, error: res?.error || "Failed to fetch", items: [] });
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sport, date]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Scoreboard</h1>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">Sport</label>
        <select
          className="border rounded-lg px-3 py-2"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          <option>NBA</option>
          <option>NFL</option>
          <option>MLB</option>
          <option>NHL</option>
        </select>

        <label className="text-sm ml-4">Date</label>
        <input
          type="date"
          className="border rounded-lg px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          className="border rounded-lg px-3 py-2"
          onClick={() => setDate(yyyy_mm_dd())}
        >
          Today
        </button>

        <button
          className="border rounded-lg px-3 py-2"
          title="Known-good NBA date with results"
          onClick={() => { setSport("NBA"); setDate("2025-02-01"); }}
        >
          Demo (NBA 2025-02-01)
        </button>
      </div>

      {state.loading && <div className="opacity-70">Loading…</div>}
      {!!state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3">
          Error: {state.error}
        </div>
      )}
      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="opacity-70">No games found for {sport} on {date}.</div>
      )}

      <div className="grid gap-3">
        {state.items.map((g) => (
          <GameRow key={`${g.provider}:${g.id}`} g={g} />
        ))}
      </div>
    </div>
  );
}
