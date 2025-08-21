/* eslint-env browser */
import { useEffect, useState } from "react";
import API from "../api/client";

export default function Scoreboard() {
  const [nba, setNBA] = useState({ loading: true });
  const [odds, setOdds] = useState({ loading: true });

  useEffect(() => {
    let cancel = false;

    async function load() {
      try {
        const [sched, o] = await Promise.all([
          API.public.schedule.nba("2025-02-01"), // pick a historical date with games
          API.public.odds.nba()
        ]);
        if (!cancel) {
          setNBA({ loading: false, data: sched });
          setOdds({ loading: false, data: o });
        }
      } catch (err) {
        if (!cancel) {
          setNBA((s)=>({ ...s, loading:false, error: String(err.message || err)}));
          setOdds((s)=>({ ...s, loading:false, error: String(err.message || err)}));
        }
      }
    }
    load();
    return () => { cancel = true; };
  }, []);

  const games = nba.data?.items || [];
  const lines = odds.data?.items || [];

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Scoreboard</h1>

      <section>
        <h2 className="font-semibold mb-2">NBA Schedule (sample date)</h2>
        {nba.loading ? "Loading…" : nba.error ? <div className="text-red-600">{nba.error}</div> : (
          games.length ? (
            <div className="border rounded-xl divide-y">
              {games.slice(0,10).map(g => (
                <div key={g.id} className="p-3 grid md:grid-cols-3 gap-2">
                  <div className="font-medium">{g.awayTeam} @ {g.homeTeam}</div>
                  <div className="text-sm text-gray-600">{new Date(g.startsAt || g.date || "").toLocaleString()}</div>
                  <div className="text-sm">Status: {g.status || "-"}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-gray-500">No games found.</div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">NBA Odds (best moneyline)</h2>
        {odds.loading ? "Loading…" : odds.error ? <div className="text-red-600">{odds.error}</div> : (
          lines.length ? (
            <div className="border rounded-xl divide-y">
              {lines.slice(0,10).map(g => (
                <div key={g.id} className="p-3 grid md:grid-cols-4 gap-2 items-center">
                  <div className="font-medium">{g.awayTeam} @ {g.homeTeam}</div>
                  <div className="text-sm text-gray-600">{new Date(g.startsAt).toLocaleString()}</div>
                  <div>Home ML: {g.bestHomeML ?? "-"}</div>
                  <div>Away ML: {g.bestAwayML ?? "-"}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-gray-500">No odds available.</div>
        )}
      </section>
    </div>
  );
}
