/* eslint-env browser */
import { useEffect, useState } from 'react';
import { api } from '../api/client';

function mask(k) {
  if (!k) return 'not set';
  return '••••••••••••' + k.slice(-6);
}

export default function PremiumPicks() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('adminKey') || '');
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!adminKey) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const d = await api.premium();
        const items = d?.picks || d?.items || d || [];
        setPicks(Array.isArray(items) ? items : []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [adminKey]);

  const handleSet = () => {
    const el = document.getElementById('adminKeyInput');
    const v = (el?.value || '').trim();
    localStorage.setItem('adminKey', v);
    setAdminKey(v);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Premium Picks</h1>

      {/* Header controls mimic the rest of the app */}
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <div className="mb-1 font-medium">API:</div>
          <input
            className="border rounded-xl px-3 py-2 w-80"
            defaultValue={localStorage.getItem('apiBase') || ''}
            placeholder="https://api.46bettor.com"
            onBlur={(e) => localStorage.setItem('apiBase', e.target.value.trim())}
          />
          <div className="text-xs text-gray-500">
            Current: { (localStorage.getItem('apiBase') || 'https://api.46bettor.com') }
          </div>
        </label>

        <label className="text-sm">
          <div className="mb-1 font-medium">Admin Key:</div>
          <input
            id="adminKeyInput"
            className="border rounded-xl px-3 py-2 w-[32rem]"
            defaultValue={adminKey}
            placeholder="paste your 64-char admin key"
          />
          <div className="text-xs text-gray-500">Current: {mask(adminKey)}</div>
        </label>

        <button onClick={handleSet} className="rounded-2xl px-4 py-2 bg-black text-white">
          Set
        </button>
      </div>

      {!adminKey && (
        <div className="border rounded-xl p-4 bg-yellow-50">
          Paste your ADMIN_KEY and click <b>Set</b> to view premium content.
        </div>
      )}

      {adminKey && (
        <>
          {loading && <div>Loading premium feed…</div>}
          {err && <div className="text-red-600">Error: {err}</div>}
          {!loading && !err && picks.length === 0 && (
            <div className="border rounded-xl p-4">No premium picks yet.</div>
          )}
          {!loading && !err && picks.length > 0 && (
            <div className="space-y-2">
              {picks.map((p, i) => (
                <div key={p._id || p.id || i} className="border rounded-xl p-3">
                  <div className="text-sm text-gray-600">
                    {p.sport || p.league} • {p.market?.toUpperCase?.() || p.market}
                  </div>
                  <div className="text-lg font-semibold">
                    {p.matchup || `${p.awayTeam || p.away} @ ${p.homeTeam || p.home}`}
                  </div>
                  <div className="text-sm">
                    Selection: <b>{p.selection || p.side}</b> • Odds: <b>{p.odds || p.price}</b>
                  </div>
                  {p.notes && <div className="text-sm mt-1 text-gray-700">{p.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
