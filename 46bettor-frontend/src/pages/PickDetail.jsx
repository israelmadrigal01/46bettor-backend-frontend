/* eslint-env browser */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const apiBase = () =>
  localStorage.getItem('apiBase') ||
  import.meta.env.VITE_API_BASE ||
  'https://api.46bettor.com';

export default function PickDetail() {
  const { id } = useParams();
  const [pick, setPick] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const go = async () => {
      setErr("");
      try {
        // Try dedicated endpoint first
        const r = await fetch(`${apiBase()}/api/public/picks/${id}`);
        if (r.ok) {
          const j = await r.json();
          if (j?.ok && j?.pick) { setPick(j.pick); return; }
        }
        // Fallback: search recent
        const rr = await fetch(`${apiBase()}/api/public/recent?limit=50`);
        const jj = await rr.json();
        const found = jj?.picks?.find(p => p.id === id);
        if (found) setPick(found);
        else setErr("Pick not found");
      } catch (e) {
        setErr(String(e));
      }
    };
    go();
  }, [id]);

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!pick) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Pick Details</h1>
      <div className="rounded-2xl border p-4 space-y-2">
        <div className="text-sm text-gray-500">ID: {pick.id}</div>
        <div className="font-medium">
          {pick.date} — {pick.sport}{pick.league ? ` (${pick.league})` : ""}
        </div>
        <div className="text-gray-700">
          {pick.homeTeam ?? 'Home'} vs {pick.awayTeam ?? 'Away'}
        </div>
        <div className="text-gray-700">
          Market: <span className="font-mono">{pick.market}</span> • Selection: <b>{pick.selection}</b>
          {pick.line != null ? <> • Line: <span className="font-mono">{pick.line}</span></> : null}
          • Odds: <span className="font-mono">{pick.odds}</span>
        </div>
        {pick.status && (
          <div>
            Status: <b>{pick.status}</b>{pick.finalScore ? ` — ${pick.finalScore}` : ""}
          </div>
        )}
        {Array.isArray(pick.tags) && pick.tags.length > 0 && (
          <div className="text-sm text-gray-600">Tags: {pick.tags.join(", ")}</div>
        )}
        {pick.settledAt && (
          <div className="text-sm text-gray-500">
            Settled: {new Date(pick.settledAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
