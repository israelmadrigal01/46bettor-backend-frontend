/* eslint-env browser */
/* global import.meta */
import { useEffect, useState } from "react";

const SPORTS = [
  { key: "nba", label: "NBA" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
  { key: "nfl", label: "NFL" },
  { key: "soccer", label: "Soccer" },
];

const SOCCER_COMPS = [
  { code: "PL", name: "Premier League" },
  { code: "PD", name: "LaLiga" },
  { code: "BL1", name: "Bundesliga" },
  { code: "SA", name: "Serie A" },
  { code: "FL1", name: "Ligue 1" },
  { code: "CL", name: "Champions League" },
];

// Resolve API base from localStorage first, then from Vite .env
function getApiBase() {
  const ls = (localStorage.getItem("apiBase") || "").trim().replace(/\/+$/, "");
  const env =
    (import.meta && import.meta.env && import.meta.env.VITE_API_BASE
      ? String(import.meta.env.VITE_API_BASE)
      : ""
    ).trim().replace(/\/+$/, "");
  return ls || env || "";
}

export default function Schedule() {
  const [apiBase, setApiBase] = useState(getApiBase());
  const [sport, setSport] = useState("nba");
  const [comp, setComp] = useState("PL"); // only used for soccer
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  // Keep apiBase in sync if user hits "Set" in the header controls
  useEffect(() => {
    const onStorage = () => setApiBase(getApiBase());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function load() {
    const base = getApiBase();
    setApiBase(base);

    if (!base) {
      setLoading(false);
      setError(
        "API base is not set. In the header, set API to http://127.0.0.1:5050 for dev (or https://api.46bettor.com)."
      );
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setItems([]);
      const extra = sport === "soccer" ? `&comp=${encodeURIComponent(comp)}` : "";
      const url = `${base}/api/public/schedule/${sport}?date=${encodeURIComponent(date)}${extra}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `${res.status} ${res.statusText}`);
      }
      setItems(Array.isArray(json.items) ? json.items : []);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setError(String(e.message || e));
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, comp, date]); // apiBase changes via storage listener -> load() re-reads it

  const stepDate = (days) => {
    const d = new Date(date + "T00:00:00");
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + days);
      setDate(d.toISOString().slice(0, 10));
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 12px" }}>Schedules</h1>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSport(s.key)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 999,
                padding: "6px 12px",
                background: sport === s.key ? "#111" : "#fff",
                color: sport === s.key ? "#fff" : "#111",
                cursor: "pointer",
              }}
              title={`Show ${s.label}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {sport === "soccer" && (
          <select
            value={comp}
            onChange={(e) => setComp(e.target.value)}
            style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 10px" }}
            title="Soccer competition"
          >
            {SOCCER_COMPS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => stepDate(-1)}
            style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
            title="Previous day"
          >
            ← Prev
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 10px" }}
            title="Pick a date"
          />
          <button
            onClick={() => stepDate(1)}
            style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
            title="Next day"
          >
            Next →
          </button>
        </div>

        <button
          onClick={load}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
          title="Refresh from server"
        >
          Refresh
        </button>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          API: <code>{apiBase || "(unset)"}</code>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>
          {(() => {
            try {
              return new Date(date + "T00:00:00").toLocaleDateString();
            } catch {
              return date;
            }
          })()}
        </div>
        {sport === "soccer" && <div style={{ fontSize: 12, color: "#6b7280" }}>Competition: {comp}</div>}
      </div>

      {/* Body */}
      {error ? (
        <div style={{ color: "#b91c1c", border: "1px solid #fecaca", background: "#fef2f2", padding: 12, borderRadius: 12 }}>
          {error}
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            Tip: MLB/NHL/NFL require <code>MYSPORTSFEEDS_API_KEY</code>. Soccer requires{" "}
            <code>FOOTBALL_DATA_API_KEY</code>. Set them in your backend <code>.env</code> and restart.
          </div>
        </div>
      ) : loading ? (
        <div>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: 16 }}>
          No games found for this date.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {items.map((g, i) => (
            <div key={g.id || i} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div style={{ fontWeight: 800 }}>{(g.awayTeam || "-")} @ {(g.homeTeam || "-")}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {g.sport}
                {g.league ? ` · ${g.league}` : ""} {g.provider ? ` · ${g.provider}` : ""}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {g.startsAt ? new Date(g.startsAt).toLocaleString() : "—"}
              </div>

              <div style={{ marginTop: 8 }}>
                {g.homeScore != null || g.awayScore != null ? (
                  <div style={{ fontWeight: 700 }}>
                    {g.awayScore ?? "-"} - {g.homeScore ?? "-"}
                  </div>
                ) : (
                  <span>Status: {g.status || "-"}</span>
                )}
              </div>

              {g.venue && <div style={{ fontSize: 12, color: "#6b7280" }}>Venue: {g.venue}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
