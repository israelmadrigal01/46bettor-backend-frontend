import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export default function TrendsPage() {
  const [days, setDays] = useState(60);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/trends?days=${days}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setData(json.data);
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const daily = data?.series?.daily || [];
  const cum = useMemo(() => {
    let sum = 0;
    return daily.map(d => { sum += d.profit; return { ...d, cumProfit: sum }; });
  }, [daily]);

  const totals = data?.totals || {};
  const bySport = data?.splits?.bySport || [];
  const byMarket = data?.splits?.byMarket || [];
  const byBook = data?.splits?.byBook || [];

  function exportCSV() {
    if (!daily.length) return;
    const headers = ["date","stake","profit","roi","count","wins","losses","pushes","cumProfit"];
    const lines = cum.map(d => [
      d.date,
      d.stake,
      d.profit,
      d.roi != null ? (d.roi*100).toFixed(2)+"%" : "",
      d.count, d.wins, d.losses, d.pushes,
      d.cumProfit
    ]);
    const csv = [headers.join(","), ...lines.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `trends_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto", fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ fontSize: 28 }}>Trends</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={days} onChange={(e)=>setDays(Number(e.target.value))} style={input}>
            <option value={30}>Last 30d</option>
            <option value={60}>Last 60d</option>
            <option value={90}>Last 90d</option>
            <option value={180}>Last 180d</option>
          </select>
          <button onClick={exportCSV} style={btnGhost}>Export CSV</button>
          <button onClick={load} style={btnGhost}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
      </div>

      {err && <div style={{ marginBottom: 10, color: "#b91c1c" }}>❌ {err}</div>}

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <Stat label="Total Stake" value={`$${fmt2(totals.stake || 0)}`} />
        <Stat label="Profit" value={`$${fmt2(totals.profit || 0)}`} />
        <Stat label="ROI" value={totals.roi != null ? (totals.roi*100).toFixed(2) + "%" : "—"} />
        <Stat label="Win rate" value={totals.winrate != null ? (totals.winrate*100).toFixed(1) + "%" : "—"} />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <h2 style={h2}>Cumulative Profit</h2>
          <TinyLine data={cum} xKey="date" yKey="cumProfit" height={180} />
        </div>
        <div style={card}>
          <h2 style={h2}>Daily ROI %</h2>
          <TinyLine data={daily.map(d=>({ date:d.date, roiPct: d.roi != null ? d.roi*100 : null }))} xKey="date" yKey="roiPct" height={180} />
        </div>
      </div>

      {/* Splits */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <SplitTable title="By Sport" rows={bySport} />
        <SplitTable title="By Market" rows={byMarket} />
        <SplitTable title="By Book" rows={byBook} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SplitTable({ title, rows }) {
  return (
    <div style={card}>
      <h2 style={h2}>{title}</h2>
      <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={trHead}>
              <th style={th}>Key</th>
              <th style={th}>Stake</th>
              <th style={th}>Profit</th>
              <th style={th}>ROI%</th>
              <th style={th}>W-L-P</th>
            </tr>
          </thead>
          <tbody>
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#64748b" }}>No data.</td></tr>
            )}
            {rows?.map((r, i) => (
              <tr key={r.key || i} style={trBody}>
                <td style={td}>{r.key}</td>
                <td style={td}>${fmt2(r.stake)}</td>
                <td style={{ ...td, color: r.profit >= 0 ? "#065f46" : "#b91c1c" }}>${fmt2(r.profit)}</td>
                <td style={td}>{r.roi != null ? (r.roi*100).toFixed(2) + "%" : "—"}</td>
                <td style={td}>{r.wins ?? 0}-{r.losses ?? 0}-{r.pushes ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------- Tiny SVG line chart (no deps) -------- */
function TinyLine({ data, xKey, yKey, height = 160 }) {
  const pad = 20;
  const w = 700; // container will scroll if smaller
  const h = height;
  const pts = (data || []).filter(d => d[yKey] != null);
  if (!pts.length) return <div style={{ height: h, display: "grid", placeItems: "center", color: "#64748b" }}>No data</div>;

  const ys = pts.map(d => Number(d[yKey]));
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 0);
  const xrange = pts.length - 1 || 1;

  function x(i) { return pad + (i / xrange) * (w - pad * 2); }
  function y(v) {
    if (yMax === yMin) return h / 2;
    return pad + (1 - (v - yMin) / (yMax - yMin)) * (h - pad * 2);
  }

  const path = pts.map((d, i) => `${i ? "L" : "M"} ${x(i)} ${y(Number(d[yKey]))}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        {/* zero line */}
        {yMin < 0 && yMax > 0 && (
          <line x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} stroke="#e5e7eb" strokeWidth="1" />
        )}
        {/* frame */}
        <rect x="0" y="0" width={w} height={h} fill="white" stroke="#f1f5f9" />
        {/* path */}
        <path d={path} fill="none" stroke="#111827" strokeWidth="2" />
        {/* last value label */}
        <text x={w - pad} y={y(Number(pts[pts.length - 1][yKey])) - 6} textAnchor="end" fontSize="12" fill="#111827">
          {Number(pts[pts.length - 1][yKey]).toFixed(2)}
        </text>
      </svg>
    </div>
  );
}

/* styles & utils */
const card = { border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
const h2 = { fontSize: 18, marginBottom: 12 };
const trHead = { background: "#f8fafc", borderBottom: "1px solid #e5e7eb" };
const trBody = { borderBottom: "1px solid #f1f5f9" };
const th = { textAlign: "left", padding: 10, fontSize: 12, color: "#475569" };
const td = { padding: 10, verticalAlign: "top" };
const input = { padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none" };
const btnGhost = { padding: "10px 14px", background: "transparent", border: "1px solid #cbd5e1", borderRadius: 12, cursor: "pointer" };

function fmt2(x){ return (Math.round((Number(x||0)+Number.EPSILON)*100)/100).toFixed(2); }
