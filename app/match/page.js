"use client";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { producers, buyers, hub, applications } from "../../lib/data";
import { rankProducers, closerAlternative, PATH_LABEL } from "../../lib/match";
import { ASSUMPTIONS } from "../../lib/logistics";

const Map = dynamic(() => import("../../components/Map"), { ssr: false, loading: () => <div className="map" style={{ height: 460 }} /> });

const fmt = (n, d = 0) => (n == null ? "–" : n.toLocaleString(undefined, { maximumFractionDigits: d }));

async function matrix(sources, destination) {
  const res = await fetch("/api/matrix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sources, destination }) });
  return res.json();
}

function MatchInner() {
  const params = useSearchParams();
  const [buyerId, setBuyerId] = useState(params.get("buyer") || "chicago-metals");
  const buyer = buyers.find((b) => b.id === buyerId) || buyers[0];
  const [appKey, setAppKey] = useState(applications[buyer.segment] ? buyer.segment : "stormwater");
  const [tonnes, setTonnes] = useState(20);
  const [currentId, setCurrentId] = useState("");
  const [ranked, setRanked] = useState(null);
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    if (applications[buyer.segment]) setAppKey(buyer.segment);
  }, [buyer.segment]);

  const run = useCallback(async () => {
    setBusy(true); setSel(null); setRoutes([]);
    const src = producers.map(({ id, lat, lng }) => ({ id, lat, lng }));
    const [toBuyer, toHub, hubLeg] = await Promise.all([
      matrix(src, buyer), matrix(src, hub), matrix([{ id: "hub", lat: hub.lat, lng: hub.lng }], buyer),
    ]);
    const dist = {};
    toBuyer.results.forEach((r) => { dist[r.id] = { ...(dist[r.id] || {}), direct: r.miles }; });
    toHub.results.forEach((r) => { dist[r.id] = { ...(dist[r.id] || {}), toHub: r.miles }; });
    setLive({ ok: toBuyer.live && toHub.live && hubLeg.live, reason: toBuyer.reason || toHub.reason || hubLeg.reason });
    setRanked(rankProducers({ producers, appKey, tonnes: Number(tonnes) || 1, dist, hubToBuyer: hubLeg.results[0].miles }));
    setBusy(false);
  }, [buyer, appKey, tonnes]);

  const showRoute = async (r) => {
    setSel(r.producer.id);
    const pts = r.viaHub ? [r.producer, hub, buyer] : [r.producer, buyer];
    const res = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: pts.map(({ lat, lng }) => ({ lat, lng })) }) });
    const data = await res.json();
    setRoutes([{ coords: data.coords, color: r.viaHub ? "#b5562a" : "#2a6b46", dash: data.live ? undefined : "6 6" }]);
  };

  const swap = ranked && currentId ? closerAlternative(ranked, currentId) : null;
  const best = ranked?.find((r) => r.feasible);
  const app = applications[appKey];

  return (
    <>
      <h1>Match a buyer to producers</h1>
      <p className="lead">
        Enter what the buyer needs. Producers are ranked on feedstock fit, particle size, real truck road distance,
        and scale. When no one sells the right size, the char is routed through our finishing hub to be screened and tested.
      </p>

      <div className="panel">
        <div className="form">
          <div>
            <label htmlFor="buyer">Buyer</label>
            <select id="buyer" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="app">Application</label>
            <select id="app" value={appKey} onChange={(e) => setAppKey(e.target.value)}>
              {Object.entries(applications).map(([k, a]) => <option key={k} value={k}>{a.label} ({a.size})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="t">Quantity (tonnes)</label>
            <input id="t" type="number" min="1" value={tonnes} onChange={(e) => setTonnes(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cur">Current supplier (optional)</label>
            <select id="cur" value={currentId} onChange={(e) => setCurrentId(e.target.value)}>
              <option value="">None</option>
              {producers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><button className="primary" onClick={run} disabled={busy}>{busy ? "Routing…" : "Find matches"}</button></div>
        </div>
        {live && (
          <p className="note">
            {live.ok ? "Distances are live truck road miles (OpenRouteService, heavy-goods-vehicle profile)."
              : <span className="warn">{live.reason}</span>}{" "}
            Freight at ${ASSUMPTIONS.usdPerTruckMile}/truck-mile, {ASSUMPTIONS.kgCo2PerTruckMile} kg CO₂/truck-mile, {ASSUMPTIONS.tonnesPerTruck} t per truck.
          </p>
        )}
      </div>

      {swap?.better && (
        <div className="callout">
          <b>Same char, closer source.</b> Buying from <b>{swap.better.producer.name}</b> instead of {swap.current.producer.name}{" "}
          saves about <b>{fmt(swap.savedCo2Kg / 1000, 1)} t CO₂</b>, <b>${fmt(swap.savedUsd)}</b> in freight and{" "}
          {fmt(swap.savedMiles)} truck miles on this order, with an equal or better grade fit.
        </div>
      )}
      {swap && !swap.better && (
        <div className="callout">Your current supplier, {swap.current.producer.name}, is already the lowest-emission suitable source.</div>
      )}

      {ranked && (
        <div className="grid" style={{ marginTop: 16 }}>
          <div className="panel">
            <h2>Ranked producers for {buyer.name}</h2>
            <p className="note">
              Need: {app.label}, {app.size} grade, {tonnes} t. {best && <>Best fit: <b>{best.producer.name}</b>.</>} Click a row to see its truck route.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producer</th><th>Path</th><th className="num">Score</th><th className="num">Road mi</th>
                    <th className="num">Freight</th><th className="num">$/t</th><th className="num">CO₂ (t)</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
                    <tr key={r.producer.id} onClick={() => showRoute(r)}
                      className={`${sel === r.producer.id ? "pick" : ""} ${r.feasible ? "" : "dim"}`}>
                      <td><b>{r.producer.name}</b><br /><span className="note">{r.producer.city} · {r.producer.feedstock}</span></td>
                      <td><span className={`pill ${r.path}`}>{PATH_LABEL[r.path]}</span>{!r.feedOk && <><br /><span className="note warn">Feedstock not suited</span></>}</td>
                      <td className="num">{r.score}</td>
                      <td className="num">{fmt(r.miles)}</td>
                      <td className="num">${fmt(r.freightUsd)}</td>
                      <td className="num">${fmt(r.perTonne)}</td>
                      <td className="num">{fmt(r.co2Kg / 1000, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>Route</h2>
            <Map producers={sel ? producers.filter((p) => p.id === sel) : []} buyers={[buyer]} hub={hub} routes={routes} height={460} />
            <p className="note">
              Green: ships direct. Orange: through the finishing hub. Dashed: straight line shown because live routing was unavailable.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function MatchPage() {
  return <Suspense fallback={null}><MatchInner /></Suspense>;
}
