// 46bettor-frontend/src/pages/Schedule.jsx
import React, { useEffect, useState } from "react";
import { API } from "../api/client";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Schedule() {
  const [sport, setSport] = useState("NBA");
  const [date, setDate] = useState(todayStr());
  const [state, setState] = useState({ loading: false, error: "", items: [] });

  async function load() {
    setState({ loading: true, error: "", items: [] });
    const res = await API.schedule(sport, date);
    if (res?.ok) setState({ loading: false, error: "", items: res.items || [] });
    else setState({ loading: false, error: res?.error || "Failed to fetch", items: [] });
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sport, date]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Schedule</h1>

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
          onClick={() => setDate(todayStr())}
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

      <ul className="space-y-2">
        {state.items.map((g) => {
          const when = new Date(g.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          return (
            <li key={`${g.provider}:${g.id}`} className="border rounded-xl p-4 flex items-center justify-between">
              <div className="opacity-70 text-sm">{when}</div>
              <div className="font-medium">{g.awayTeam} @ {g.homeTeam}</div>
              <div className="opacity-70 text-sm">{g.status || "Scheduled"}</div>
            </li>
          );
        })}
      </ul>

      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="opacity-70">No games found for {sport} on {date}.</div>
      )}
    </div>
  );
}
