import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

const marketsBySport = {
  MLB: ["moneyline", "spread", "total"],
  NFL: ["moneyline", "spread", "total"],
  NBA: ["moneyline", "spread", "total"],
  WNBA: ["moneyline", "spread", "total"],
  NCAAF: ["moneyline", "spread", "total"],
  NCAAB: ["moneyline", "spread", "total"],
  Soccer: ["moneyline", "total", "spread"],
  NHL: ["moneyline", "spread", "total"],
  Tennis: ["moneyline", "spread", "total"],
  Golf: ["moneyline", "total"],
  UFC: ["moneyline", "total"],
  Cricket: ["moneyline", "total"],
  NASCAR: ["moneyline"]
};

const defaultLines = {
  MLB: { spread: 1.5, total: 8.5 },
  NFL: { spread: 3.5, total: 44.5 },
  NBA: { spread: 2.5, total: 220.5 },
  WNBA: { spread: 2.5, total: 162.5 },
  NCAAF: { spread: 6.5, total: 55.5 },
  NCAAB: { spread: 4.5, total: 145.5 },
  Soccer: { spread: 0.5, total: 2.5 },
  NHL: { spread: 1.5, total: 6.5 },
  Tennis: { spread: 2.5, total: 22.5 },
  Golf: { total: 69.5 },
  UFC: { total: 2.5 },
  Cricket: { total: 160.5 }
};

const sports = Object.keys(marketsBySport);
const statuses = ["pending", "won", "lost", "push", "void"];
const LS_SETTINGS_KEY = "46b.settings";

export default function AddPickPage() {
  const [picks, setPicks] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ sport: "", riskLevel: "", status: "" });
  const [editId, setEditId] = useState(null);

  // bulk grade
  const [selected, setSelected] = useState({});
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState({});

  // CSV import
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvRows, setCsvRows] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  // Settings (localStorage)
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { bankroll: 1000, unitPct: 1, kellyFrac: 0.5 };
    } catch {
      return { bankroll: 1000, unitPct: 1, kellyFrac: 0.5 };
    }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const [form, setForm] = useState({
    sport: "MLB",
    league: "MLB",
    homeTeam: "",
    awayTeam: "",
    market: "moneyline",
    selection: "",
    line: "",
    odds: "",
    stake: "",
    book: "",
    startTime: "",
    myProbPct: "" // your estimate (%) to fuel Kelly
  });

  const api = (path, opts) =>
    fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts && opts.headers) }
    });

  // ---- Derived numbers (implied prob, toWin, EV, suggestions) ----
  const lineRequired = form.market === "spread" || form.market === "total";
  const oddsNum = asNum(form.odds);
  const stakeNum = asNum(form.stake);
  const impliedProb =
    oddsNum == null ? null : oddsNum > 0 ? 100 / (oddsNum + 100) : -oddsNum / (-oddsNum + 100);
  const toWin =
    oddsNum == null || stakeNum == null
      ? null
      : oddsNum > 0
      ? (stakeNum * oddsNum) / 100
      : (stakeNum * 100) / Math.abs(oddsNum);
  const dec = oddsNum == null ? null : americanToDecimal(oddsNum);
  const pUser = form.myProbPct !== "" ? clamp01(Number(form.myProbPct) / 100) : null;
  const b = dec != null ? dec - 1 : null;
  const kellyRaw = pUser != null && b != null ? (b * pUser - (1 - pUser)) / b : null; // (bp - q)/b
  const kelly = kellyRaw != null ? Math.max(0, kellyRaw) : null; // no negatives
  const kellyStake = kelly != null ? round2(settings.bankroll * (settings.kellyFrac || 0.5) * kelly) : null;
  const unitStake = round2(settings.bankroll * (settings.unitPct || 1) / 100);
  const evCurrent =
    stakeNum != null && oddsNum != null
      ? (pUser ?? impliedProb) * (oddsNum > 0 ? (stakeNum * oddsNum) / 100 : (stakeNum * 100) / Math.abs(oddsNum)) -
        (1 - (pUser ?? impliedProb)) * stakeNum
      : null;

  // ---- Load picks ----
  async function loadPicks() {
    const qs = new URLSearchParams();
    if (filters.sport) qs.set("sport", filters.sport);
    if (filters.riskLevel) qs.set("riskLevel", filters.riskLevel);
    if (filters.status) qs.set("status", filters.status);
    qs.set("limit", "200");
    const res = await api(`/api/picks?${qs.toString()}`, { method: "GET" });
    const json = await res.json();
    if (json.ok) setPicks(json.data || []);
  }
  useEffect(() => { loadPicks(); /* eslint-disable-next-line */ }, [filters.sport, filters.riskLevel, filters.status]);

  // ---- Form handlers ----
  function onSportChange(e) {
    const sport = e.target.value;
    const markets = marketsBySport[sport] || ["moneyline", "spread", "total"];
    const nextMarket = markets.includes(form.market) ? form.market : markets[0];
    const d = defaultLines[sport] || {};
    setForm((f) => ({
      ...f,
      sport,
      league: sport,
      market: nextMarket,
      line: nextMarket === "spread" ? d.spread || "" : nextMarket === "total" ? d.total || "" : ""
    }));
  }
  function onMarketChange(e) {
    const market = e.target.value;
    const d = defaultLines[form.sport] || {};
    setForm((f) => ({
      ...f,
      market,
      line: market === "spread" ? d.spread || "" : market === "total" ? d.total || "" : ""
    }));
  }
  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  // ---- Submit (add or edit) ----
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        sport: form.sport,
        league: form.league || form.sport,
        homeTeam: form.homeTeam,
        awayTeam: form.awayTeam,
        market: form.market,
        selection: form.selection,
        line: lineRequired ? asNum(form.line) : undefined,
        odds: asNum(form.odds),
        stake: asNum(form.stake) ?? undefined,
        book: form.book || undefined,
        startTime: form.startTime ? new Date(form.startTime).toISOString() : undefined
      };

      let res, json;
      if (editId) {
        res = await api(`/api/picks/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
        json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to update pick");
        setMessage("✅ Pick updated");
      } else {
        res = await api("/api/picks/add", { method: "POST", body: JSON.stringify(payload) });
        json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to add pick");
        setMessage("✅ Pick saved");
      }

      resetForm();
      await loadPicks();
    } catch (err) {
      setMessage("❌ " + err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  // ---- Status, delete, edit, duplicate ----
  async function updateStatus(id, status) {
    const res = await api(`/api/picks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    const json = await res.json();
    if (json.ok) loadPicks();
  }
  async function del(id) {
    if (!window.confirm("Delete this pick?")) return;
    const res = await api(`/api/picks/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) loadPicks();
  }
  function edit(p) {
    setEditId(p._id);
    setForm({
      sport: p.sport || "MLB",
      league: p.league || p.sport || "MLB",
      homeTeam: p.homeTeam || "",
      awayTeam: p.awayTeam || "",
      market: p.market || "moneyline",
      selection: p.selection || "",
      line: p.line ?? "",
      odds: p.odds ?? "",
      stake: p.stake ?? "",
      book: p.book || "",
      startTime: p.startTime ? toLocalInput(p.startTime) : "",
      myProbPct: ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function duplicate(p) {
    setEditId(null);
    setForm({
      sport: p.sport || "MLB",
      league: p.league || p.sport || "MLB",
      homeTeam: p.homeTeam || "",
      awayTeam: p.awayTeam || "",
      market: p.market || "moneyline",
      selection: p.selection || "",
      line: p.line ?? "",
      odds: p.odds ?? "",
      stake: p.stake ?? "",
      book: p.book || "",
      startTime: p.startTime ? toLocalInput(p.startTime) : "",
      myProbPct: ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetForm() {
    setEditId(null);
    setForm({
      sport: "MLB",
      league: "MLB",
      homeTeam: "",
      awayTeam: "",
      market: "moneyline",
      selection: "",
      line: "",
      odds: "",
      stake: "",
      book: "",
      startTime: "",
      myProbPct: ""
    });
  }

  // ---- Single Grade (prompt) ----
  async function gradePick(p) {
    const hs = window.prompt(`Final HOME score for ${p.homeTeam}?`, "");
    if (hs === null) return;
    const as = window.prompt(`Final AWAY score for ${p.awayTeam}?`, "");
    if (as === null) return;
    const homeScore = Number(hs);
    const awayScore = Number(as);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      alert("Scores must be numbers.");
      return;
    }
    const res = await fetch(`${API_BASE}/api/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickId: p._id, homeScore, awayScore })
    });
    const json = await res.json();
    if (!json.ok) { alert(json.error || "Failed to grade"); return; }
    await loadPicks();
  }

  // ---- Bulk grade ----
  function toggleSelected(id) { setSelected((s) => { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = true; return n; }); }
  function openBulk() {
    const ids = Object.keys(selected);
    if (!ids.length) return;
    const map = {};
    for (const id of ids) map[id] = { homeScore: "", awayScore: "" };
    setBulk(map);
    setShowBulk(true);
  }
  function setBulkScore(id, key, val) { setBulk((b) => ({ ...b, [id]: { ...b[id], [key]: val } })); }
  async function submitBulk() {
    const items = Object.entries(bulk).map(([id, sc]) => ({ pickId: id, homeScore: Number(sc.homeScore), awayScore: Number(sc.awayScore) }));
    if (items.some(it => !Number.isFinite(it.homeScore) || !Number.isFinite(it.awayScore))) { alert("All scores must be numbers."); return; }
    const res = await fetch(`${API_BASE}/api/grade/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
    const json = await res.json();
    if (!json.ok) { alert(json.error || "Bulk grade failed"); return; }
    setShowBulk(false); setSelected({}); setBulk({}); await loadPicks();
  }

  // ---- CSV Import ----
  function openImport() { setCsvText(""); setCsvRows([]); setCsvErrors([]); setShowImport(true); }
  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  }
  function parseCsvNow() {
    try { const parsed = parseCSV(csvText); setCsvRows(parsed.rows); setCsvErrors(parsed.errors || []); }
    catch (e) { setCsvErrors([String(e.message || e)]); setCsvRows([]); }
  }
  async function importCsv() {
    if (!csvRows.length) { alert("No rows to import"); return; }
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/picks/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: csvRows }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Bulk import failed");
      alert(`✅ Added ${json.added}${json.failed ? `, failed ${json.failed}` : ""}`);
      setShowImport(false); setCsvText(""); setCsvRows([]); setCsvErrors([]);
      await loadPicks();
    } catch (e) { alert("❌ " + (e.message || e)); }
    finally { setImporting(false); }
  }

  // ---- Export CSV (current filtered picks) ----
  function exportCSV() {
    const rows = picks.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if (!rows.length) return;
    const headers = [
      "createdAt","sport","league","homeTeam","awayTeam","market","selection","line",
      "odds","stake","toWin","impliedProb","riskLevel","status","book","startTime","_id"
    ];
    const data = rows.map(p => [
      p.createdAt || "",
      p.sport || "",
      p.league || "",
      p.homeTeam || "",
      p.awayTeam || "",
      p.market || "",
      p.selection || "",
      p.line ?? "",
      p.odds ?? "",
      p.stake ?? "",
      p.toWin ?? "",
      p.impliedProb != null ? (p.impliedProb * 100).toFixed(2) + "%" : "",
      p.riskLevel || "",
      p.status || "",
      p.book || "",
      p.startTime || "",
      p._id || ""
    ]);
    const csv = [headers.join(","), ...data.map(r => r.map(escapeCSV).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `picks_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>46bettor — Add Pick & Manage</h1>
      <div style={{ marginBottom: 16, color: "#475569" }}>
        API: <code>{API_BASE}</code>
      </div>

      {/* SETTINGS */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h2 style={h2Style}>Settings</h2>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div>
            <label style={label}>Bankroll ($)</label>
            <input
              type="number"
              value={settings.bankroll}
              onChange={(e)=>setSettings(s=>({...s, bankroll: Math.max(0, Number(e.target.value)||0)}))}
              style={input}
            />
          </div>
          <div>
            <label style={label}>Unit Size (% of bankroll)</label>
            <input
              type="number"
              value={settings.unitPct}
              onChange={(e)=>setSettings(s=>({...s, unitPct: Math.max(0, Number(e.target.value)||0)}))}
              style={input}
            />
          </div>
          <div>
            <label style={label}>Kelly Fraction (0–1)</label>
            <input
              type="number" step="0.05" min="0" max="1"
              value={settings.kellyFrac}
              onChange={(e)=>setSettings(s=>({...s, kellyFrac: clamp01(Number(e.target.value)||0)}))}
              style={input}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
        {/* FORM */}
        <form onSubmit={submit} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 style={h2Style}>{editId ? "Edit Pick" : "Add Pick"}</h2>
            {editId && <button type="button" onClick={resetForm} style={btnGhost}>Cancel Edit</button>}
          </div>

          <div style={grid3}>
            <div>
              <label style={label}>Sport</label>
              <select name="sport" value={form.sport} onChange={onSportChange} style={input}>
                {sports.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>League</label>
              <input name="league" value={form.league} onChange={onChange} placeholder={form.sport} style={input} />
            </div>
            <div>
              <label style={label}>Start Time (local)</label>
              <input name="startTime" type="datetime-local" value={form.startTime} onChange={onChange} style={input} />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <label style={label}>Home Team</label>
              <input name="homeTeam" value={form.homeTeam} onChange={onChange} placeholder="Dodgers" style={input} required />
            </div>
            <div>
              <label style={label}>Away Team</label>
              <input name="awayTeam" value={form.awayTeam} onChange={onChange} placeholder="Giants" style={input} required />
            </div>
          </div>

          <div style={grid3}>
            <div>
              <label style={label}>Market</label>
              <select name="market" value={form.market} onChange={onMarketChange} style={input}>
                {(marketsBySport[form.sport] || ["moneyline","spread","total"]).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Selection</label>
              <input name="selection" value={form.selection} onChange={onChange} placeholder="Dodgers / Over / +1.5" style={input} required />
            </div>
            <div>
              <label style={label}>Line {lineRequired ? "(req)" : "(optional)"}</label>
              <input
                name="line"
                value={form.line}
                onChange={onChange}
                style={input}
                type="number"
                step="0.5"
                placeholder={
                  lineRequired
                    ? (form.market === "spread"
                        ? (defaultLines[form.sport]?.spread ?? "")
                        : (defaultLines[form.sport]?.total ?? ""))
                    : ""
                }
                required={lineRequired}
              />
            </div>
          </div>

          <div style={{ ...grid3, alignItems: "end" }}>
            <div>
              <label style={label}>Odds (American)</label>
              <input name="odds" value={form.odds} onChange={onChange} placeholder="-135 or 150" style={input} type="number" required />
            </div>
            <div>
              <label style={label}>Stake</label>
              <input name="stake" value={form.stake} onChange={onChange} placeholder="50" style={input} type="number" />
            </div>
            <div>
              <label style={label}>Book</label>
              <input name="book" value={form.book} onChange={onChange} placeholder="DraftKings" style={input} />
            </div>
          </div>

          <div style={{ ...grid3, alignItems: "end" }}>
            <div>
              <label style={label}>My Win Prob (%)</label>
              <input name="myProbPct" value={form.myProbPct} onChange={onChange} placeholder="e.g. 58" style={input} type="number" />
            </div>
            <div>
              <label style={label}>Suggestions</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" style={btnTiny} onClick={() => setForm(f => ({ ...f, stake: unitStake }))}>
                  1U ${unitStake.toFixed(2)}
                </button>
                <button type="button" style={btnTiny} disabled={kellyStake == null} onClick={() => setForm(f => ({ ...f, stake: kellyStake }))}>
                  Kelly ${kellyStake != null ? kellyStake.toFixed(2) : "—"}
                </button>
              </div>
            </div>
            <div>
              <label style={label}>EV (current stake)</label>
              <div style={{ padding: "10px 12px" }}>
                {evCurrent == null ? "—" : (evCurrent >= 0 ? "+" : "") + "$" + Math.abs(evCurrent).toFixed(2)}
              </div>
            </div>
          </div>

          <div style={calcBar}>
            <span>Implied Prob:</span>
            <strong>{impliedProb == null ? "—" : (impliedProb * 100).toFixed(1) + "%"}</strong>
            <span style={{ marginLeft: 12 }}>To Win:</span>
            <strong>{toWin == null ? "—" : "$" + (Math.round(toWin * 100) / 100).toFixed(2)}</strong>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? (editId ? "Updating..." : "Saving...") : (editId ? "Update Pick" : "Save Pick")}
            </button>
            <button type="button" onClick={resetForm} style={btnGhost}>Reset</button>
          </div>

          {message && <div style={{ marginTop: 10 }}>{message}</div>}
        </form>

        {/* TABLE + actions */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h2 style={h2Style}>Picks</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={openImport} style={btnGhost}>Import CSV</button>
              <button onClick={exportCSV} style={btnGhost}>Export CSV</button>
              <button disabled={!selectedCount} onClick={openBulk} style={btnGhost}>
                Grade Selected {selectedCount ? `(${selectedCount})` : ""}
              </button>
              <button onClick={loadPicks} style={btnGhost}>Refresh</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select value={filters.sport} onChange={(e) => setFilters((f) => ({ ...f, sport: e.target.value }))} style={input}>
              <option value="">All Sports</option>
              {sports.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.riskLevel} onChange={(e) => setFilters((f) => ({ ...f, riskLevel: e.target.value }))} style={input}>
              <option value="">All Risk</option>
              <option>Safe Bet</option>
              <option>Value Pick</option>
              <option>High Risk, High Reward</option>
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={input}>
              <option value="">All Status</option>
              {statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={trHead}>
                  <th style={th}></th>
                  <th style={th}>Time</th>
                  <th style={th}>Sport</th>
                  <th style={th}>Matchup</th>
                  <th style={th}>Market</th>
                  <th style={th}>Selection</th>
                  <th style={th}>Line</th>
                  <th style={th}>Odds</th>
                  <th style={th}>Stake</th>
                  <th style={th}>Risk</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {picks.length === 0 && (
                  <tr><td colSpan={12} style={{ ...td, textAlign: "center", color: "#64748b" }}>No picks yet.</td></tr>
                )}
                {picks.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map((p) => (
                  <tr key={p._id} style={trBody}>
                    <td style={td}>
                      {p.status === "pending" ? (
                        <input type="checkbox" checked={!!selected[p._id]} onChange={() => toggleSelected(p._id)} />
                      ) : null}
                    </td>
                    <td style={td}>{p.startTime ? new Date(p.startTime).toLocaleString() : new Date(p.createdAt).toLocaleString()}</td>
                    <td style={td}>{p.sport}</td>
                    <td style={td}>{p.awayTeam} @ {p.homeTeam}{p.book ? ` — ${p.book}` : ""}</td>
                    <td style={td}>{p.market}</td>
                    <td style={td}>{p.selection}</td>
                    <td style={td}>{p.line ?? "—"}</td>
                    <td style={td}>{p.odds}</td>
                    <td style={td}>{p.stake ?? 0}</td>
                    <td style={td}>{p.riskLevel || "—"}</td>
                    <td style={td}>{p.status}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => edit(p)} style={btnTiny}>Edit</button>
                        <button onClick={() => duplicate(p)} style={btnTiny}>Duplicate</button>
                        {statuses.map((s) => (
                          <button key={s} onClick={() => updateStatus(p._id, s)} style={btnTiny}>{s}</button>
                        ))}
                        <button onClick={() => gradePick(p)} style={btnTiny}>Grade</button>
                        <button onClick={() => del(p._id)} style={btnDangerTiny}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk grade drawer */}
          {showBulk && (
            <div style={drawer}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Grade Selected ({selectedCount})</h3>
                <button onClick={() => setShowBulk(false)} style={btnGhost}>Close</button>
              </div>
              <div style={{ marginTop: 10, maxHeight: 300, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={trHead}>
                      <th style={th}>Matchup</th>
                      <th style={th}>Market</th>
                      <th style={th}>Selection</th>
                      <th style={th}>Home</th>
                      <th style={th}>Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(selected).map((id) => {
                      const p = picks.find(x => x._id === id);
                      if (!p) return null;
                      return (
                        <tr key={id} style={trBody}>
                          <td style={td}>{p.awayTeam} @ {p.homeTeam}</td>
                          <td style={td}>{p.market}</td>
                          <td style={td}>{p.selection}{p.line != null ? ` (${p.line})` : ""}</td>
                          <td style={td}><input type="number" value={bulk[id]?.homeScore ?? ""} onChange={(e)=>setBulkScore(id,'homeScore',e.target.value)} style={{ ...input, width: 90 }} /></td>
                          <td style={td}><input type="number" value={bulk[id]?.awayScore ?? ""} onChange={(e)=>setBulkScore(id,'awayScore',e.target.value)} style={{ ...input, width: 90 }} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={submitBulk} style={btnPrimary}>Grade {selectedCount} Picks</button>
                <button onClick={()=>{ setShowBulk(false); }} style={btnGhost}>Cancel</button>
              </div>
            </div>
          )}

          {/* CSV Import drawer */}
          {showImport && (
            <div style={drawer}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Import CSV</h3>
                <button onClick={() => setShowImport(false)} style={btnGhost}>Close</button>
              </div>

              <div style={{ marginTop: 8, color: "#475569", fontSize: 13 }}>
                Required columns: <code>sport, homeTeam, awayTeam, market, selection, odds</code>. Optional: <code>league, line, stake, book, startTime</code>.
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <input type="file" accept=".csv" onChange={onFile} />
                <button onClick={parseCsvNow} style={btnGhost}>Parse</button>
                <button disabled={!csvRows.length || importing} onClick={importCsv} style={btnPrimary}>
                  {importing ? "Importing..." : `Import ${csvRows.length} rows`}
                </button>
              </div>

              <textarea
                value={csvText}
                onChange={(e)=>setCsvText(e.target.value)}
                placeholder={`sport,league,homeTeam,awayTeam,market,selection,line,odds,stake,book,startTime
MLB,MLB,Dodgers,Giants,moneyline,Dodgers,, -135,50,DraftKings,2025-08-12T19:05
MLB,MLB,Dodgers,Giants,total,Over,8.5,-110,25,FanDuel,2025-08-12T19:05`}
                style={{ width: "100%", minHeight: 140, marginTop: 10, border: "1px solid #cbd5e1", borderRadius: 12, padding: 10, fontFamily: "monospace" }}
              />

              {csvErrors.length > 0 && (
                <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>
                  {csvErrors.map((e,i)=><div key={i}>❌ {e}</div>)}
                </div>
              )}

              {csvRows.length > 0 && (
                <div style={{ marginTop: 10, maxHeight: 300, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={trHead}>
                      {Object.keys(csvRows[0]).map(h => <th key={h} style={th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {csvRows.slice(0,50).map((r, idx) => (
                        <tr key={idx} style={trBody}>
                          {Object.keys(csvRows[0]).map(h => <td key={h} style={td}>{String(r[h] ?? "")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: 8, color: "#64748b", fontSize: 12 }}>
                    Showing first {Math.min(50, csvRows.length)} of {csvRows.length}.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- CSV parser (no deps) ---------- */
function parseCSV(text) {
  const rows = [];
  const errors = [];
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return { rows: [], errors: [] };

  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; } else { q = false; }
      } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else if (c === "\n") { out.push(cur); rows.push(out.slice()); out.length = 0; cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  rows.push(out.slice());

  const headers = (rows.shift() || []).map(h => h.trim());
  if (!headers.length) throw new Error("Missing header row");

  const objects = rows
    .filter(r => r.some(x => String(x).trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((h, c) => { obj[h] = (r[c] ?? "").trim(); });
      if (obj.startTime && obj.startTime.length === 16 && obj.startTime.includes("T")) {
        obj.startTime = new Date(obj.startTime).toISOString();
      }
      if (obj.line !== undefined && obj.line !== "") obj.line = Number(obj.line);
      if (obj.odds !== undefined && obj.odds !== "") obj.odds = Number(obj.odds);
      if (obj.stake !== undefined && obj.stake !== "") obj.stake = Number(obj.stake);
      return obj;
    });

  const req = ["sport","homeTeam","awayTeam","market","selection","odds"];
  const missing = req.filter(h => !headers.includes(h));
  if (missing.length) errors.push(`Missing required columns: ${missing.join(", ")}`);

  return { rows: objects, errors };
}

/* ---------- utils & styles ---------- */
function asNum(v) { if (v === "" || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function toLocalInput(iso) { const d = new Date(iso); const off = d.getTimezoneOffset(); const local = new Date(d.getTime() - off * 60000); return local.toISOString().slice(0,16); }
function americanToDecimal(a) { if (!Number.isFinite(a)) return null; return a > 0 ? 1 + a/100 : 1 + 100/Math.abs(a); }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function round2(x){ return Math.round((Number(x||0)+Number.EPSILON)*100)/100; }
function escapeCSV(s) { if (s == null) return ""; const t = String(s).replaceAll('"','""'); return /[",\n]/.test(t) ? `"${t}"` : t; }

const cardStyle = { border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
const h2Style = { fontSize: 18, marginBottom: 12 };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 };
const label = { display: "block", fontSize: 12, color: "#475569", marginBottom: 4 };
const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none" };
const trHead = { background: "#f8fafc", borderBottom: "1px solid #e5e7eb" };
const trBody = { borderBottom: "1px solid #f1f5f9" };
const th = { textAlign: "left", padding: 10, fontSize: 12, color: "#475569" };
const td = { padding: 10, verticalAlign: "top" };
const btnPrimary = { padding: "10px 14px", background: "#111827", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 600 };
const btnGhost = { padding: "10px 14px", background: "transparent", border: "1px solid #cbd5e1", borderRadius: 12, cursor: "pointer" };
const btnTiny = { padding: "6px 8px", fontSize: 12, borderRadius: 10, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" };
const btnDangerTiny = { ...btnTiny, borderColor: "#fecaca", color: "#dc2626" };
const drawer = { marginTop: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fbfdff" };
