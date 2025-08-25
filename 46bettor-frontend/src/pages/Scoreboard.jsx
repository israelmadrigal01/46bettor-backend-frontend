// 46bettor-frontend/src/pages/Scoreboard.jsx — FULL FILE
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

// simple YYYY-MM-DD helper (from Date or string)
function toYMD(v) {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v;
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ""; }
}

const SPORTS = [
  { key: "nba", label: "NBA" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
  { key: "nfl", label: "NFL" },
];

export default function Scoreboard() {
  const [sport, setSport] = useState("nba");
  const [date, setDate] = useState(() => toYMD(new Date())); // today
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const selected = useMemo(
    () => SPORTS.find((s) => s.key === sport) || SPORTS[0],
    [sport]
  );

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await api.schedule(sport, { date });
      const rows = Array.isArray(res?.items) ? res.items : [];
      setItems(rows);
      if (!rows.length && res?.ok) {
        setErr("No games found for this date.");
      }
    } catch (e) {
      const msg = String(e?.message || e);
      // show a nicer message for ratelimits
      if (msg.includes("429") || /Too Many Requests/i.test(msg)) {
        setErr("Rate limited by upstream provider (balldontlie). Try again in a minute.");
      } else {
        setErr(msg);
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* load on mount */ }, []); // eslint-disable-line

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Scoreboard</h1>

      <div className="flex flex-wrap gap-3 items-center mb-4">
        <label className="text-sm">Sport</label>
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="border rounded px-2 py-1"
        >
          {SPORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <label className="text-sm ml-4">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />

        <button
          className="ml-2 rounded px-3 py-1 border hover:bg-gray-50"
          onClick={() => setDate(toYMD(new Date()))}
        >
          Today
        </button>

        <button
          className="ml-2 rounded px-3 py-1 bg-black text-white hover:opacity-90"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4">
          Error: {err}
        </div>
      ) : null}

      <div className="grid gap-3">
        {(Array.isArray(items) ? items : []).map((g, i) => (
          <div key={`${g.id || i}`} className="border rounded p-3">
            <div className="text-sm opacity-70 mb-1">
              {g.provider || selected.label} • {toYMD(g.startsAt || date)}
              {g.status ? ` • ${g.status}` : ""}
            </div>
            <div className="flex justify-between items-center">
              <div className="font-medium">
                {g.awayTeam} @ {g.homeTeam}
              </div>
              <div className="text-sm">
                {typeof g.awayScore === "number" && typeof g.homeScore === "number"
                  ? `${g.awayScore} - ${g.homeScore}`
                  : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && !err && (!items || !items.length) ? (
        <div className="text-sm opacity-70 mt-4">Nothing to show.</div>
      ) : null}
    </div>
  );
}
