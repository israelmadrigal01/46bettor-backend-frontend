// src/pages/PickDetail.jsx
/* eslint-env browser */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function PickDetail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api.pickById(id);
        const pick = d?.pick || d?.data || d;
        if (!cancelled) setState({ loading: false, data: pick || null, error: '' });
      } catch (e) {
        if (!cancelled) setState({ loading: false, data: null, error: String(e.message || e) });
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/" style={{ textDecoration: 'underline' }}>← Back</Link>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 12px' }}>Pick {id}</h1>

      {state.loading ? (
        <div>Loading…</div>
      ) : state.error ? (
        <div style={{ color: '#b91c1c' }}>{state.error}</div>
      ) : !state.data ? (
        <div>Not found.</div>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
          {JSON.stringify(state.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
