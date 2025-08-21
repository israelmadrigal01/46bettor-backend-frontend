// src/pages/Dashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

/** === Minimal API client === */
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const API = {
  health: () => getJSON("/api/public/health"),
  tiles: () => getJSON("/api/public/tiles"),
  recent: async () => {
    const d = await getJSON("/api/public/recent");
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.picks)) return d.picks;
    if (d && Array.isArray(d.items)) return d.items;
    if (d && Array.isArray(d.data)) return d.data;
    return [];
  },
  pickById: (id) => getJSON(`/api/public/picks/${encodeURIComponent(id)}`),
};

async function getJSON(path, { signal } = {}) {
  if (!API_BASE) throw new Error("VITE_API_BASE is not set. Check your .env files.");
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

/** === Utils === */
const fmt = {
  odds(v) {
    if (v === null || v === undefined || v === "") return "-";
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n > 0 ? `+${n}` : `${n}`;
  },
  dateish(v) {
    if (!v) return "";
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleString();
    return String(v);
  },
};

function useAbortable() {
  const ctrlRef = useRef(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);
  return () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    return ctrl.signal;
  };
}

/** === Tiny UI atoms === */
function Button({ children, onClick, disabled, title, variant = "solid" }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    fontSize: 14,
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid",
    userSelect: "none",
  };
  const styles =
    variant === "ghost"
      ? { ...base, borderColor: "#e5e7eb", background: "#fff" }
      : { ...base, borderColor: "#10b981", background: "#10b981", color: "#fff" };
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={styles}>
      {children}
    </button>
  );
}

function StatCard({ title, children, footer, minWidth = 220 }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        minWidth,
      }}
    >
      {title && <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>}
      <div>{children}</div>
      {footer && <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>{footer}</div>}
    </div>
  );
}

function Dot({ ok, size = 10 }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 999,
        background: ok ? "#10b981" : "#ef4444",
        marginRight: 8,
      }}
    />
  );
}

/** === HealthPill === */
function HealthPill({ data, error }) {
  if (error) return <span><Dot ok={false} /> API error</span>;
  if (!data) return <span>Checking API…</span>;
  const ok = !!data.ok;
  return (
    <span title={data.ts || ""} style={{ display: "inline-flex", alignItems: "center" }}>
      <Dot ok={ok} />
      API {ok ? "healthy" : "down"}
    </span>
  );
}

/** === TilesGrid === */
function TilesGrid({ data }) {
  if (!data) return <div>Loading tiles…</div>;

  const renderKV = (obj) => {
    const entries = Object.entries(obj);
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {entries.map(([k, v]) => (
          <StatCard key={k} title={k}>
            {typeof v === "object" ? (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
                {JSON.stringify(v, null, 2)}
              </pre>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700 }}>{String(v)}</div>
            )}
          </StatCard>
        ))}
      </div>
    );
  };

  if (Array.isArray(data)) {
    return renderKV(
      data.reduce((acc, item, idx) => {
        acc[item?.title || item?.name || `Tile ${idx + 1}`] = item?.value ?? item;
        return acc;
      }, {})
    );
  }

  if (typeof data === "object") return renderKV(data);

  return (
    <StatCard title="Tiles (raw)">
      <pre style={{ margin: 0 }}>{JSON.stringify(data, null, 2)}</pre>
    </StatCard>
  );
}

/** === Recent table w/ filter, sort, and “Open” link === */
function RecentTable({ items, onSelect }) {
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("ALL");
  const [sortBy, setSortBy] = useState("settledAt_desc");

  const sports = useMemo(() => {
    const s = new Set();
    for (const it of items) if (it?.sport) s.add(it.sport);
    return ["ALL", ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items;
    if (sport !== "ALL") {
      arr = arr.filter((it) => (it?.sport || "").toLowerCase() === sport.toLowerCase());
    }
    if (q) {
      arr = arr.filter((it) => JSON.stringify(it).toLowerCase().includes(q));
    }
    const getDate = (it) =>
      new Date(it?.settledAt || it?.createdAt || it?.date || it?.ts || 0).getTime() || 0;

    if (sortBy === "settledAt_desc") arr = [...arr].sort((a, b) => getDate(b) - getDate(a));
    if (sortBy === "settledAt_asc") arr = [...arr].sort((a, b) => getDate(a) - getDate(b));
    if (sortBy === "odds_desc") arr = [...arr].sort((a, b) => (b?.odds ?? 0) - (a?.odds ?? 0));
    if (sortBy === "odds_asc") arr = [...arr].sort((a, b) => (a?.odds ?? 0) - (b?.odds ?? 0));
    return arr;
  }, [items, query, sport, sortBy]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recent…"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "8px 10px",
            minWidth: 220,
          }}
        />
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px" }}
        >
          {sports.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px" }}
        >
          <option value="settledAt_desc">Newest</option>
          <option value="settledAt_asc">Oldest</option>
          <option value="odds_desc">Odds: High → Low</option>
          <option value="odds_asc">Odds: Low → High</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: 16 }}>
          No recent items to show.
        </div>
      ) : (
        <div role="table" style={{ width: "100%", borderTop: "1px solid #e5e7eb" }}>
          <div
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
              gap: 8,
              fontSize: 12,
              color: "#6b7280",
              padding: "10px 0",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 600,
            }}
          >
            <div>Matchup</div>
            <div>Market</div>
            <div>Selection</div>
            <div>Odds</div>
            <div>Action</div>
          </div>

          {filtered.map((it, idx) => {
            const home = it.homeTeam || it.home || it.teamHome || "";
            const away = it.awayTeam || it.away || it.teamAway || "";
            const title = home && away ? `${away} @ ${home}` : it.title || it.matchup || "Recent item";
            const market = it.market ?? it.type ?? "-";
            const selection = it.selection ?? it.pick ?? it.side ?? "-";
            const odds = fmt.odds(it.odds ?? it.price ?? it.moneyline);
            const meta = [it.sport, it.league].filter(Boolean).join(" · ");
            const when = it.settledAt || it.createdAt || it.date || it.ts;

            return (
              <div
                key={`${it.id || idx}`}
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
                  gap: 8,
                  padding: "12px 0",
                  borderBottom: "1px solid #e5e7eb",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{meta}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmt.dateish(when)}</div>
                </div>
                <div>{market}</div>
                <div>{selection}</div>
                <div>{odds}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {it.id && (
                    <Link
                      to={`/p/${encodeURIComponent(it.id)}`}
                      title="Open details page"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontSize: 14,
                        textDecoration: "none",
                      }}
                    >
                      Open
                    </Link>
                  )}
                  <Button variant="ghost" onClick={() => onSelect?.(it)} title="Quick view">
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** === Drawer === */
function Drawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          height: "100%",
          background: "#fff",
          boxShadow: "-6px 0 24px rgba(0,0,0,0.15)",
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          <Button variant="ghost" onClick={onClose} title="Close">Close</Button>
        </div>
        <div style={{ overflow: "auto", height: "calc(100% - 48px)" }}>{children}</div>
      </div>
    </div>
  );
}

/** === Page === */
export default function Dashboard() {
  const newSignal = useAbortable();

  const [health, setHealth] = useState({ loading: true });
  const [tiles, setTiles] = useState({ loading: true });
  const [recent, setRecent] = useState({ loading: true });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState({ loading: false, data: null, error: null });

  const refresh = async () => {
    const signal = newSignal();
    setHealth((s) => ({ ...s, loading: true, error: null }));
    setTiles((s) => ({ ...s, loading: true, error: null }));
    setRecent((s) => ({ ...s, loading: true, error: null }));
    try {
      const [h, t, r] = await Promise.all([API.health({ signal }), API.tiles({ signal }), API.recent({ signal })]);
      setHealth({ loading: false, data: h });
      setTiles({ loading: false, data: t });
      setRecent({ loading: false, data: r });
      setLastUpdated(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHealth((s) => ({ ...s, loading: false, error: msg }));
      setTiles((s) => ({ ...s, loading: false, error: msg }));
      setRecent((s) => ({ ...s, loading: false, error: msg }));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail({ loading: false, data: null, error: null });
      return;
    }
    let cancelled = false;
    const load = async () => {
      setDetail({ loading: true, data: null, error: null });
      try {
        if (selected.id) {
          const data = await API.pickById(selected.id);
          if (!cancelled) setDetail({ loading: false, data, error: null });
        } else {
          if (!cancelled) setDetail({ loading: false, data: selected, error: null });
        }
      } catch {
        if (!cancelled) setDetail({ loading: false, data: selected, error: null });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selected]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>46bettor</h1>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            API: <code>{API_BASE || "(unset)"}</code>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <HealthPill data={health.data} error={health.error} />
          <Button onClick={refresh} title="Refresh data">Refresh</Button>
        </div>
      </header>

      {/* Status Row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard title="Health">
          {health.error ? (
            <div style={{ color: "#b91c1c" }}>{health.error}</div>
          ) : health.loading ? (
            "Loading…"
          ) : (
            <div>
              <div><b>Status:</b> {health.data?.ok ? "OK" : "Down"}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{health.data?.service || ""}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{fmt.dateish(health.data?.ts)}</div>
            </div>
          )}
        </StatCard>

        <StatCard title="Last Updated">
          {lastUpdated ? fmt.dateish(lastUpdated) : "—"}
        </StatCard>
      </div>

      {/* Tiles */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px" }}>Tiles</h2>
        {tiles.error ? (
          <div style={{ color: "#b91c1c" }}>Tiles error: {tiles.error}</div>
        ) : tiles.loading ? (
          <div>Loading tiles…</div>
        ) : (
          <TilesGrid data={tiles.data} />
        )}
      </section>

      {/* Recent */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px" }}>Recent</h2>
        {recent.error ? (
          <div style={{ color: "#b91c1c" }}>Recent error: {recent.error}</div>
        ) : recent.loading ? (
          <div>Loading recent…</div>
        ) : (
          <RecentTable items={recent.data || []} onSelect={setSelected} />
        )}
      </section>

      {/* Drawer for pick details */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Pick ${selected.id || ""}` : "Pick"}
      >
        {detail.loading ? (
          <div>Loading details…</div>
        ) : (
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
            {JSON.stringify(detail.data || selected, null, 2)}
          </pre>
        )}
      </Drawer>
    </div>
  );
}
