// src/components/HealthPill.jsx
/* eslint-env browser */
import { useEffect, useState } from 'react';
import { api } from '../api/client';

function Dot({ ok }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10, height: 10, borderRadius: 999,
        background: ok ? '#10b981' : '#ef4444', marginRight: 8,
      }}
    />
  );
}

export default function HealthPill() {
  const [state, setState] = useState({ loading: true, ok: false, ts: '' });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const h = await api.health();
        if (!cancelled) setState({ loading: false, ok: !!h.ok, ts: h.ts || '' });
      } catch {
        if (!cancelled) setState({ loading: false, ok: false, ts: '' });
      }
    };
    run();
    const id = setInterval(run, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (state.loading) return <span>Checking API…</span>;
  return (
    <span title={state.ts} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Dot ok={state.ok} /> API {state.ok ? 'healthy' : 'down'}
    </span>
  );
}
