// src/pages/PremiumPicks.jsx
import { useEffect, useMemo, useState } from 'react';
import { API } from '../api/client';

function Card({ title, children, footer }) {
  return (
    <div className="border rounded-2xl p-4 bg-white shadow-sm">
      {title && <div className="font-semibold mb-2">{title}</div>}
      <div>{children}</div>
      {footer && <div className="mt-2 text-xs text-gray-500">{footer}</div>}
    </div>
  );
}

function fmtMoneyUnits(u) {
  if (u == null) return '—';
  const n = Number(u);
  if (Number.isNaN(n)) return String(u);
  // “units” not dollars — keep 2 decimals and show sign
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}u`;
}

function fmtPct(p) {
  if (p == null) return '—';
  const n = Number(p);
  if (Number.isNaN(n)) return String(p);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function useAbortable() {
  const [ctrl, setCtrl] = useState(null);
  useEffect(() => () => ctrl?.abort(), [ctrl]);
  return () => {
    ctrl?.abort();
    const c = new AbortController();
    setCtrl(c);
    return c.signal;
  };
}

export default function PremiumPicks() {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [error, setError] = useState('');
  const [tiles, setTiles] = useState(null);
  const [ledger, setLedger] = useState([]);

  const newSignal = useAbortable();
  const apiBase = API.util.getApiBase();
  const adminKeyTail = (API.util.getAdminKey() || '').slice(-6);

  const refresh = async () => {
    setLoading(true);
    setError('');
    setAuthError('');
    try {
      const signal = newSignal();

      // We’ll call metrics.tiles + metrics.ledger.
      // If summary ever fails in prod, tiles already contains the same blocks
      // we want to render (bankroll, 7d/30d splits).
      const [t, lg] = await Promise.all([
        API.metrics.tiles({ signal }).catch((e) => {
          // If metrics.tiles is blocked/404 in prod, gracefully fallback to public tiles
          if (e?.status === 401) setAuthError('Unauthorized (bad or missing admin key).');
          return API.public.tiles();
        }),
        API.metrics.ledger('2025-01-01', '2025-12-31').catch((e) => {
          if (e?.status === 401) setAuthError('Unauthorized (bad or missing admin key).');
          // Fallback to recent so the page still shows something
          return API.public.recent().then((d) => {
            // normalize
            const arr = Array.isArray(d) ? d
              : Array.isArray(d?.picks) ? d.picks
              : Array.isArray(d?.items) ? d.items
              : Array.isArray(d?.data) ? d.data
              : [];
            return { ok: true, items: arr };
          });
        }),
      ]);

      setTiles(t);
      // normalize ledger shape
      const items = Array.isArray(lg?.items) ? lg.items
        : Array.isArray(lg?.picks) ? lg.picks
        : Array.isArray(lg?.data) ? lg.data
        : Array.isArray(lg) ? lg
        : [];
      setLedger(items);
    } catch (e) {
      setError(e?.message || 'Failed to load premium data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bankroll = tiles?.bankroll || null;
  const last7d   = tiles?.last7d || null;
  const last30d  = tiles?.last30d || null;

  const ledgerRows = useMemo(() => {
    return ledger.map((it, i) => {
      const home = it.homeTeam || it.home || it.teamHome || '';
      const away = it.awayTeam || it.away || it.teamAway || '';
      const title = home && away ? `${away} @ ${home}` : it.title || it.matchup || 'Pick';
      const when = it.settledAt || it.createdAt || it.date || it.ts || '';
      const market = it.market ?? it.type ?? '-';
      const selection = it.selection ?? it.pick ?? it.side ?? '-';
      const odds = it.odds ?? it.price ?? it.moneyline ?? '';
      const status = it.status || it.result || it.outcome || 'Open';
      return { key: it.id || i, title, when, market, selection, odds, status, raw: it };
    });
  }, [ledger]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Premium Picks</h1>
      <p className="text-gray-600">
        This section loads from protected endpoints using your <code>x-admin-key</code>.
      </p>

      <div className="p-3 rounded-xl bg-gray-50 text-sm">
        <div><b>API:</b> {apiBase}</div>
        <div><b>Admin Key:</b> {adminKeyTail ? `********${adminKeyTail}` : 'not set'}</div>
      </div>

      {authError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {authError}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-2xl px-4 py-2 bg-black text-white disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Bankroll">
          {bankroll ? (
            <div className="space-y-1">
              <div><b>Start:</b> {bankroll.start}</div>
              <div><b>Current:</b> {bankroll.current}</div>
              <div><b>Net:</b> {fmtMoneyUnits(bankroll.netUnits)}</div>
              <div><b>ROI:</b> {fmtPct(bankroll.roiPct)}</div>
            </div>
          ) : '—'}
        </Card>
        <Card title="Last 7 Days">
          {last7d ? (
            <div className="space-y-1">
              <div><b>Record:</b> W {last7d.record?.won || 0} / L {last7d.record?.lost || 0} / P {last7d.record?.push || 0} / O {last7d.record?.open || 0}</div>
              <div><b>Net:</b> {fmtMoneyUnits(last7d.netUnits)}</div>
              <div><b>ROI:</b> {fmtPct(last7d.roiPct)}</div>
            </div>
          ) : '—'}
        </Card>
        <Card title="Last 30 Days">
          {last30d ? (
            <div className="space-y-1">
              <div><b>Record:</b> W {last30d.record?.won || 0} / L {last30d.record?.lost || 0} / P {last30d.record?.push || 0} / O {last30d.record?.open || 0}</div>
              <div><b>Net:</b> {fmtMoneyUnits(last30d.netUnits)}</div>
              <div><b>ROI:</b> {fmtPct(last30d.roiPct)}</div>
            </div>
          ) : '—'}
        </Card>
      </div>

      {/* Ledger */}
      <Card title="Ledger">
        {ledgerRows.length === 0 ? (
          <div className="text-sm text-gray-500">No rows to display.</div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-6 gap-2 text-xs text-gray-500 font-semibold border-b py-2">
              <div className="col-span-2">Matchup</div>
              <div>When</div>
              <div>Market</div>
              <div>Selection</div>
              <div>Odds</div>
            </div>
            {ledgerRows.map((r) => (
              <div key={r.key} className="grid grid-cols-6 gap-2 py-2 border-b">
                <div className="col-span-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-gray-500">{r.status}</div>
                </div>
                <div className="text-sm">{r.when ? new Date(r.when).toLocaleString() : '—'}</div>
                <div className="text-sm">{r.market}</div>
                <div className="text-sm">{r.selection}</div>
                <div className="text-sm">{r.odds ?? '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <details className="text-sm">
        <summary className="cursor-pointer select-none">Raw tiles JSON (debug)</summary>
        <pre className="text-xs bg-gray-50 p-3 rounded-xl overflow-auto">
{JSON.stringify(tiles, null, 2)}
        </pre>
      </details>
    </div>
  );
}
