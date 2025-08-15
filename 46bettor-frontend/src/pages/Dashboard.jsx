// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiGet, API_BASE } from "../lib/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

function Tile({ label, value, sub, danger, success }) {
  return (
    <div className="rounded-2xl p-4 shadow-sm border bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub != null && (
        <div className={`mt-1 text-xs ${success ? "text-green-600" : danger ? "text-red-600" : "text-gray-500"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function formatPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.0%";
  const oneDec = Math.round(x * 10) / 10;
  return `${oneDec.toFixed(1)}%`;
}
function formatUnits(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00u";
  return `${(Math.round(x * 100) / 100).toFixed(2)}u`;
}
function formatMoneyFromUnits(units, unitSize = 1) {
  const x = Number(units);
  const amt = (Number.isFinite(x) ? x : 0) * unitSize;
  const sign = amt < 0 ? "-" : "";
  const s = Math.abs(amt).toFixed(2);
  return `${sign}$${s}`;
}

export default function Dashboard() {
  const [tiles, setTiles] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setErr("");
        const [t, l] = await Promise.all([
          apiGet("/api/metrics/tiles"),
          apiGet("/api/metrics/ledger?from=2025-08-01&to=2025-08-31"),
        ]);
        if (!cancelled) {
          setTiles(t);
          setLedger(Array.isArray(l?.rows) ? l.rows : []);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      }
    }
    load();
    const id = setInterval(load, 10000); // refresh every 10s
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const chartData = useMemo(() => {
    return (ledger || []).map((r) => ({
      date: r.date,
      bankroll: Number(r.bankroll || 0),
      pnlUnits: Number(r.pnlUnits || 0),
    }));
  }, [ledger]);

  const bankroll = tiles?.bankroll || {};
  const today = tiles?.today || {};
  const last7d = tiles?.last7d || {};
  const last30d = tiles?.last30d || {};
  const unitSize = 1; // dollars per unit (adjust if needed)

  const bankrollStart = Number(bankroll.start);
  const showStartLine = Number.isFinite(bankrollStart);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <div className="text-xs text-gray-500">
          API: <code>{API_BASE}</code>
        </div>
      </div>

      {err && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {err}
        </div>
      )}

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Tile
          label="Bankroll (Current)"
          value={`${formatMoneyFromUnits(bankroll.netUnits, unitSize)} (${formatUnits(bankroll.netUnits)})`}
          sub={`Start $${Number.isFinite(bankrollStart) ? bankrollStart.toFixed(2) : "0.00"} • ROI ${formatPct(bankroll.roiPct)}`}
          success={Number(bankroll.netUnits) > 0}
          danger={Number(bankroll.netUnits) < 0}
        />
        <Tile
          label="Today"
          value={`${today.count ?? 0} picks • ${formatUnits(today.pnlUnits)}`}
          sub={`Open ${today.open ?? 0} • W ${today.won ?? 0} / L ${today.lost ?? 0} / P ${today.push ?? 0}`}
          success={Number(today.pnlUnits) > 0}
          danger={Number(today.pnlUnits) < 0}
        />
        <Tile
          label="Last 7 Days"
          value={`${formatUnits(last7d.netUnits)}`}
          sub={`ROI ${formatPct(last7d.roiPct)} • W ${last7d.record?.won ?? 0} / L ${last7d.record?.lost ?? 0} / P ${last7d.record?.push ?? 0}`}
          success={Number(last7d.netUnits) > 0}
          danger={Number(last7d.netUnits) < 0}
        />
        <Tile
          label="Last 30 Days"
          value={`${formatUnits(last30d.netUnits)}`}
          sub={`ROI ${formatPct(last30d.roiPct)} • W ${last30d.record?.won ?? 0} / L ${last30d.record?.lost ?? 0} / P ${last30d.record?.push ?? 0}`}
          success={Number(last30d.netUnits) > 0}
          danger={Number(last30d.netUnits) < 0}
        />
      </div>

      {/* Bankroll chart */}
      <div className="rounded-2xl p-4 shadow-sm border bg-white">
        <div className="mb-2 text-sm text-gray-600">Bankroll (Aug 2025)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              {showStartLine && <ReferenceLine y={bankrollStart} stroke="#999" strokeDasharray="3 3" />}
              <Area type="monotone" dataKey="bankroll" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top buckets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BucketCard title="Top Sports (30d)" rows={tiles?.top?.bySport} />
        <BucketCard title="Top Markets (30d)" rows={tiles?.top?.byMarket} />
        <BucketCard title="Top Tags (30d)" rows={tiles?.top?.byTags} />
      </div>
    </div>
  );
}

function BucketCard({ title, rows }) {
  return (
    <div className="rounded-2xl p-4 shadow-sm border bg-white">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3">Key</th>
              <th className="py-1 pr-3">W-L-P</th>
              <th className="py-1 pr-3">Net</th>
              <th className="py-1">ROI</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r, i) => (
              <tr key={i} className="border-t">
                <td className="py-1 pr-3">{r.key}</td>
                <td className="py-1 pr-3">W {r.won} / L {r.lost} / P {r.push}</td>
                <td className={`py-1 pr-3 ${Number(r.netUnits) > 0 ? "text-green-600" : Number(r.netUnits) < 0 ? "text-red-600" : ""}`}>
                  {Number(r.netUnits).toFixed(2)}u
                </td>
                <td className="py-1">{formatPct(r.roiPct)}</td>
              </tr>
            ))}
            {!rows?.length && (
              <tr><td className="py-2 text-gray-500" colSpan={4}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
