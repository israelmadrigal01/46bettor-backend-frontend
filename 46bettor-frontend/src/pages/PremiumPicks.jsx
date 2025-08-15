// src/pages/PremiumPicks.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiGet, API_BASE } from "../lib/api";

function impliedProbFromAmerican(odds) {
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return 0;
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}
function pct(n, digits = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.0%";
  const v = Math.round(x * 100 * Math.pow(10, digits)) / Math.pow(10, digits);
  return `${v.toFixed(digits)}%`;
}
function clsStatus(s) {
  const x = String(s || "open").toLowerCase();
  if (x === "won") return "bg-green-100 text-green-800 border-green-200";
  if (x === "lost") return "bg-red-100 text-red-800 border-red-200";
  if (x === "push" || x === "void") return "bg-gray-100 text-gray-700 border-gray-200";
  return "bg-yellow-50 text-yellow-800 border-yellow-200";
}

export default function PremiumPicks() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet("/api/premium/today");
      const list = Array.isArray(data?.picks) ? data.picks : [];
      setRows(list);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(id);
  }, []);

  const sports = useMemo(() => {
    const set = new Set(rows.map(r => r.sport || r.league).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(p => {
      if (sport !== "ALL" && p.sport !== sport && p.league !== sport) return false;
      if (status !== "ALL" && String(p.status || "open").toLowerCase() !== status.toLowerCase()) return false;
      if (q) {
        const s = `${p.homeTeam||""} ${p.awayTeam||""} ${p.notes||""} ${p.tags?.join(" ")||""}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, sport, status, q]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Premium Picks</h1>
        <div className="text-xs text-gray-500">API: <code>{API_BASE}</code></div>
      </div>

      {err && <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">{err}</div>}

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Search</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="team, note, tag…"
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Sport/League</label>
          <select value={sport} onChange={e => setSport(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {sports.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {["ALL","open","won","lost","push"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={load} className="px-3 py-2 text-sm rounded-lg border shadow-sm bg-white hover:bg-gray-50">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <a
            className="px-3 py-2 text-sm rounded-lg border shadow-sm bg-white hover:bg-gray-50"
            href="/api/metrics/export.csv"
            target="_blank" rel="noreferrer"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="rounded-2xl p-3 md:p-4 shadow-sm border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Sport</th>
              <th className="py-2 pr-3">Matchup</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Odds</th>
              <th className="py-2 pr-3">Stake (u)</th>
              <th className="py-2 pr-3">Implied</th>
              <th className="py-2 pr-3">Tags</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const ip = impliedProbFromAmerican(p.odds);
              const mkt = [p.market, p.selection, p.line != null ? `(${p.line})` : null].filter(Boolean).join(" ");
              const matchup = `${p.awayTeam || "?"} @ ${p.homeTeam || "?"}`;
              return (
                <tr key={p._id || i} className="border-t">
                  <td className="py-2 pr-3 whitespace-nowrap">{p.date || (p.createdAt || "").slice(0,10)}</td>
                  <td className="py-2 pr-3">{p.sport || p.league || "-"}</td>
                  <td className="py-2 pr-3">{matchup}</td>
                  <td className="py-2 pr-3">{mkt}</td>
                  <td className="py-2 pr-3">{p.odds > 0 ? `+${p.odds}` : p.odds}</td>
                  <td className="py-2 pr-3">{Number(p.stakeUnits ?? 1)}</td>
                  <td className="py-2 pr-3">{pct(ip)}</td>
                  <td className="py-2 pr-3">
                    {Array.isArray(p.tags) && p.tags.length
                      ? p.tags.map((t, j) => (
                          <span key={j} className="inline-block text-xs px-2 py-0.5 mr-1 mb-1 rounded-full border bg-gray-50">
                            {t}
                          </span>
                        ))
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${clsStatus(p.status)}`}>
                      {String(p.status || "open").toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td className="py-3 text-gray-500" colSpan={9}>No picks match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
