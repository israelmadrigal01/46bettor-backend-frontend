// src/pages/Scoreboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/api";

function Odds({ odds }) {
  if (odds == null) return <span className="text-gray-400">—</span>;
  return <span>{odds > 0 ? `+${odds}` : odds}</span>;
}

export default function Scoreboard() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("ALL");

  async function load() {
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/public/scoreboard`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setRows(Array.isArray(data?.picks) ? data.picks : []);
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const sports = useMemo(() => ["ALL", ...Array.from(new Set(rows.map(r => r.sport).filter(Boolean)))], [rows]);

  const filtered = useMemo(() => {
    return rows.filter(p => {
      if (sport !== "ALL" && p.sport !== sport) return false;
      if (q) {
        const s = `${p.homeTeam||""} ${p.awayTeam||""} ${p.market||""} ${p.selection||""} ${p.tags?.join(" ")||""}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, sport, q]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Scoreboard (Live Open Picks)</h1>
        <div className="text-xs text-gray-500">API: <code>{API_BASE}</code></div>
      </div>

      {err && <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">{err}</div>}

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Search</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="team, market, tag…" className="border rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Sport</label>
          <select value={sport} onChange={e=>setSport(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {sports.map(s => <option value={s} key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={load} className="ml-auto px-3 py-2 text-sm rounded-lg border shadow-sm bg-white hover:bg-gray-50">Refresh</button>
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
              <th className="py-2 pr-3">Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id || i} className="border-t">
                <td className="py-2 pr-3 whitespace-nowrap">{p.date || (p.createdAt || "").slice(0,10)}</td>
                <td className="py-2 pr-3">{p.sport || p.league || "-"}</td>
                <td className="py-2 pr-3">{(p.awayTeam||"?") + " @ " + (p.homeTeam||"?")}</td>
                <td className="py-2 pr-3">{[p.market, p.selection, p.line != null ? `(${p.line})` : null].filter(Boolean).join(" ")}</td>
                <td className="py-2 pr-3"><Odds odds={p.odds} /></td>
                <td className="py-2 pr-3">
                  {Array.isArray(p.tags) && p.tags.length
                    ? p.tags.map((t,j)=> <span key={j} className="inline-block text-xs px-2 py-0.5 mr-1 mb-1 rounded-full border bg-gray-50">{t}</span>)
                    : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="py-3 text-gray-500" colSpan={6}>No open picks.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
