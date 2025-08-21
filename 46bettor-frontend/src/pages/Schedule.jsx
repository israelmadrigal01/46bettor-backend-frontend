/* eslint-env browser */
import { useEffect, useMemo, useState } from "react";
import API from "../api/client";

const SPORTS = ["nba", "mlb", "nhl", "nfl", "soccer"];

export default function Schedule() {
  const [sport, setSport] = useState("nba");
  const [date, setDate]   = useState(""); // YYYY-MM-DD, empty = today
  const [comp, setComp]   = useState("PL"); // soccer competition
  const [state, setState] = useState({ loading: false });

  useEffect(() => {
    let cancel = false;
    async function run() {
      setState({ loading: true });
      try {
        let data;
        if (sport === "soccer") {
          data = await API.public.schedule.soccer(comp, date || "");
        } else {
          data = await API.public.schedule[sport](date || "");
        }
        if (!cancel) setState({ loading: false, data });
      } catch (err) {
        if (!cancel) setState({ loading: false, error: String(err.message || err) });
      }
    }
    run();
    return () => { cancel = true; };
  }, [sport, date, comp]);

  const items = useMemo(() => state?.data?.items || [], [state]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Schedule</h1>

      <div className="flex gap-2 flex-wrap items-center">
        <select className="border rounded-xl px-2 py-1" value={sport} onChange={(e)=>setSport(e.target.value)}>
          {SPORTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
        <input className="border rounded-xl px-2 py-1" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
        {sport === "soccer" && (
          <select className="border rounded-xl px-2 py-1" value={comp} onChange={(e)=>setComp(e.target.value)}>
            <option value="PL">Premier League</option>
            <option value="CL">Champions League</option>
            <option value="SA">Serie A</option>
            <option value="BL1">Bundesliga</option>
            <option value="PD">La Liga</option>
          </select>
        )}
      </div>

      {state.loading && <div>Loading…</div>}
      {state.error && <div className="text-red-600">Error: {state.error}</div>}

      {!state.loading && !state.error && items.length === 0 && (
        <div className="text-gray-500">No games for that day.</div>
      )}

      {items.length > 0 && (
        <div className="border rounded-xl divide-y">
          {items.map(g => (
            <div key={g.id} className="p-3 grid md:grid-cols-3 gap-2 items-center">
              <div className="font-medium">{g.awayTeam} @ {g.homeTeam}</div>
              <div className="text-sm text-gray-600">
                {new Date(g.startsAt || g.date || "").toLocaleString()}
              </div>
              <div className="text-sm">
                Status: {g.status || "-"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
