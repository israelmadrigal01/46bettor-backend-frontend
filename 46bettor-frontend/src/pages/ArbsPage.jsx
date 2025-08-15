import { useMemo, useState } from "react";

export default function ArbsPage() {
  const [aOdds, setAOdds] = useState("");
  const [bOdds, setBOdds] = useState("");
  const [totalStake, setTotalStake] = useState(100);

  // Hedge panel (you already have a position)
  const [hedgeStakeA, setHedgeStakeA] = useState("");
  const [hedgeOddsA, setHedgeOddsA] = useState("");
  const [hedgeOddsB, setHedgeOddsB] = useState("");

  // No-vig panel
  const [nvOdds1, setNvOdds1] = useState("");
  const [nvOdds2, setNvOdds2] = useState("");

  // ------- Arbitrage calc -------
  const decA = americanToDecimal(numOrNull(aOdds));
  const decB = americanToDecimal(numOrNull(bOdds));
  const arb = useMemo(() => {
    if (!decA || !decB) return null;
    const r = 1 / decA + 1 / decB; // market margin (2-way)
    const isArb = r < 1;
    const total = Math.max(0, Number(totalStake) || 0);
    const payout = total / r; // equalized payout
    const stakeA = total * (1 / decA) / r;
    const stakeB = total - stakeA; // or total * (1/decB)/r
    const profit = payout - total;
    const roi = total > 0 ? profit / total : 0;
    return { isArb, r, stakeA, stakeB, payout, profit, roi };
  }, [decA, decB, totalStake]);

  // ------- Hedge calc -------
  const h_sA = Number(hedgeStakeA) || 0;
  const h_decA = americanToDecimal(numOrNull(hedgeOddsA));
  const h_decB = americanToDecimal(numOrNull(hedgeOddsB));
  const hedge = useMemo(() => {
    if (!h_sA || !h_decA || !h_decB) return null;
    const sB = (h_sA * h_decA) / h_decB; // equalize payouts
    const total = h_sA + sB;

    const payoutA = h_sA * h_decA;
    const profitA = payoutA - total;

    const payoutB = sB * h_decB;
    const profitB = payoutB - total;

    return { sB, total, profitA, profitB };
  }, [h_sA, h_decA, h_decB]);

  // ------- No-Vig converter -------
  const nvDec1 = americanToDecimal(numOrNull(nvOdds1));
  const nvDec2 = americanToDecimal(numOrNull(nvOdds2));
  const novig = useMemo(() => {
    if (!nvDec1 || !nvDec2) return null;
    const p1 = 1 / nvDec1;
    const p2 = 1 / nvDec2;
    const sum = p1 + p2;
    if (sum <= 0) return null;
    const fair1 = p1 / sum;
    const fair2 = p2 / sum;
    return {
      p1: fair1,
      p2: fair2,
      dec1: 1 / fair1,
      dec2: 1 / fair2,
      am1: decimalToAmerican(1 / fair1),
      am2: decimalToAmerican(1 / fair2),
      holdPct: (sum - 1) * 100,
    };
  }, [nvDec1, nvDec2]);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Arbitrage • Hedge • No-Vig</h1>

      {/* Arbitrage */}
      <section style={card}>
        <h2 style={h2}>Two-Way Arbitrage Calculator</h2>
        <div style={row}>
          <Field label="Outcome A odds (American)">
            <input type="number" value={aOdds} onChange={e=>setAOdds(e.target.value)} placeholder="-120 or 150" style={input}/>
          </Field>
          <Field label="Outcome B odds (American)">
            <input type="number" value={bOdds} onChange={e=>setBOdds(e.target.value)} placeholder="+110 or -105" style={input}/>
          </Field>
          <Field label="Total Stake ($)">
            <input type="number" value={totalStake} onChange={e=>setTotalStake(e.target.value)} style={input}/>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 8 }}>
          <Stat label="A (decimal)" value={fmtDec(decA)} />
          <Stat label="B (decimal)" value={fmtDec(decB)} />
          <Stat label="Margin (sum 1/dec)" value={arb ? arb.r.toFixed(4) : "—"} sub={arb ? (arb.isArb ? "Arb exists ✅" : "No arb") : ""} />
        </div>

        {arb && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...callout, borderColor: arb.isArb ? "#10b981" : "#e5e7eb", background: arb.isArb ? "#ecfdf5" : "#f8fafc" }}>
              {arb.isArb ? "Positive arbitrage found. Equalized stakes below." : "No risk-free arb with these odds."}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <Stat label="Stake A" value={`$${fmt2(arb.stakeA)}`} sub={`@ ${fmtDec(decA)} (A wins payout $${fmt2(arb.stakeA*decA)})`} />
              <Stat label="Stake B" value={`$${fmt2(arb.stakeB)}`} sub={`@ ${fmtDec(decB)} (B wins payout $${fmt2(arb.stakeB*decB)})`} />
              <Stat label="Guaranteed Profit" value={`$${fmt2(arb.profit)}`} />
              <Stat label="ROI" value={(arb.roi*100).toFixed(2) + "%"} />
            </div>
          </div>
        )}
      </section>

      {/* Hedge */}
      <section style={card}>
        <h2 style={h2}>Hedge Calculator (equalize outcomes)</h2>
        <div style={row}>
          <Field label="Existing Stake on A ($)">
            <input type="number" value={hedgeStakeA} onChange={e=>setHedgeStakeA(e.target.value)} placeholder="e.g., 100" style={input}/>
          </Field>
          <Field label="Existing Odds A (American)">
            <input type="number" value={hedgeOddsA} onChange={e=>setHedgeOddsA(e.target.value)} placeholder="-120" style={input}/>
          </Field>
          <Field label="Hedge Odds B (American)">
            <input type="number" value={hedgeOddsB} onChange={e=>setHedgeOddsB(e.target.value)} placeholder="+110" style={input}/>
          </Field>
        </div>

        {hedge ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 12 }}>
            <Stat label="Place on B" value={`$${fmt2(hedge.sB)}`} />
            <Stat label="Total Outlay" value={`$${fmt2(hedge.total)}`} />
            <Stat label="Profit if A wins" value={`${hedge.profitA >= 0 ? "+" : ""}$${fmt2(hedge.profitA)}`} />
            <Stat label="Profit if B wins" value={`${hedge.profitB >= 0 ? "+" : ""}$${fmt2(hedge.profitB)}`} />
          </div>
        ) : (
          <div style={{ color: "#64748b", marginTop: 8 }}>Enter all three: stake A, odds A, odds B.</div>
        )}
      </section>

      {/* No-Vig */}
      <section style={card}>
        <h2 style={h2}>No-Vig (Fair) Odds — Two-Way</h2>
        <div style={row}>
          <Field label="Book Odds 1 (American)">
            <input type="number" value={nvOdds1} onChange={e=>setNvOdds1(e.target.value)} placeholder="-115" style={input}/>
          </Field>
          <Field label="Book Odds 2 (American)">
            <input type="number" value={nvOdds2} onChange={e=>setNvOdds2(e.target.value)} placeholder="-105" style={input}/>
          </Field>
        </div>

        {novig ? (
          <>
            <div style={{ marginTop: 8, color: "#475569" }}>Book hold ≈ <strong>{novig.holdPct.toFixed(2)}%</strong></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div style={subcard}>
                <div style={rowSm}><span>Fair Prob 1:</span><strong>{(novig.p1*100).toFixed(2)}%</strong></div>
                <div style={rowSm}><span>Fair Decimal 1:</span><strong>{novig.dec1.toFixed(3)}</strong></div>
                <div style={rowSm}><span>Fair American 1:</span><strong>{fmtAm(novig.am1)}</strong></div>
              </div>
              <div style={subcard}>
                <div style={rowSm}><span>Fair Prob 2:</span><strong>{(novig.p2*100).toFixed(2)}%</strong></div>
                <div style={rowSm}><span>Fair Decimal 2:</span><strong>{novig.dec2.toFixed(3)}</strong></div>
                <div style={rowSm}><span>Fair American 2:</span><strong>{fmtAm(novig.am2)}</strong></div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: "#64748b", marginTop: 8 }}>Enter both odds to see fair (no-vig) prices.</div>
        )}
      </section>

      {/* Reference helper */}
      <section style={{ ...card, background: "#fbfdff" }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Quick reference</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", lineHeight: 1.6 }}>
          <li><strong>Arb condition:</strong> <code>1/decA + 1/decB &lt; 1</code>. ROI = <code>1 / (sum) - 1</code>.</li>
          <li><strong>Hedge equalizer:</strong> stakeB = (stakeA × decA) / decB.</li>
          <li><strong>American → Decimal:</strong> +150 → 2.50; −120 → 1.8333.</li>
          <li><strong>Implied prob (American):</strong> +O ⇒ 100/(O+100); −O ⇒ O/(O+100) with O=|odds|.</li>
        </ul>
      </section>
    </div>
  );
}

/* ---------- UI bits ---------- */
function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
      {children}
    </label>
  );
}
function Stat({ label, value, sub }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ---------- helpers ---------- */
function numOrNull(v){ if(v===null||v===undefined||v==="") return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function americanToDecimal(a){
  if(a==null) return null;
  if(a === 0) return null;
  if(a > 0) return 1 + a/100;
  return 1 + 100/Math.abs(a);
}
function decimalToAmerican(d){
  if(!Number.isFinite(d) || d <= 1) return null;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}
function fmtAm(a){ return a == null ? "—" : (a>0 ? `+${a}` : `${a}`); }
function fmtDec(d){ return d ? d.toFixed(4) : "—"; }
function fmt2(x){ return (Math.round((Number(x||0)+Number.EPSILON)*100)/100).toFixed(2); }

/* ---------- styles ---------- */
const card = { border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", marginBottom: 16 };
const subcard = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" };
const statCard = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" };
const h2 = { fontSize: 18, marginBottom: 12 };
const row = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 };
const rowSm = { display: "flex", justifyContent: "space-between", marginTop: 6, gap: 10 };
const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none" };
const callout = { border: "1px solid", borderRadius: 12, padding: 10, color: "#064e3b" };
