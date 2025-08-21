// src/components/Tiles.jsx
/* eslint-env browser */
import { useEffect, useState } from 'react';
import { api } from '../api/client';

function Card({ title, children }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      {title && <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  );
}

export default function Tiles() {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await api.tiles();
        if (!cancelled) setState({ loading: false, data: t, error: '' });
      } catch (e) {
        if (!cancelled) setState({ loading: false, data: null, error: String(e.message || e) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <div>Loading tiles…</div>;
  if (state.error)   return <div style={{ color: '#b91c1c' }}>Tiles error: {state.error}</div>;

  const data = state.data;
  const entries = typeof data === 'object' && data ? Object.entries(data) : [['raw', data]];

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
      {entries.map(([k, v]) => (
        <Card key={k} title={k}>
          {typeof v === 'object'
            ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(v, null, 2)}</pre>
            : <div style={{ fontWeight: 800, fontSize: 20 }}>{String(v)}</div>}
        </Card>
      ))}
    </div>
  );
}
