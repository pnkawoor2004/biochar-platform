"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { producers, buyers, hub, segmentColors } from "../lib/data";

const Map = dynamic(() => import("../components/Map"), { ssr: false, loading: () => <div className="map" style={{ height: 520 }} /> });

const FEEDS = { wood: "Wood", ag: "Crop residues", biosolids: "Biosolids" };

export default function Home() {
  const [feeds, setFeeds] = useState(Object.keys(FEEDS));
  const [showBuyers, setShowBuyers] = useState(true);
  const [picked, setPicked] = useState(null);

  const shownProducers = useMemo(() => producers.filter((p) => feeds.includes(p.feedClass)), [feeds]);
  const shownBuyers = useMemo(() => (showBuyers ? buyers : []), [showBuyers]);
  const toggle = (f) => setFeeds((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const knownCapacity = producers.reduce((s, p) => s + (p.capacityTpy || 0), 0);
  const unpublishedSizes = producers.filter((p) => !p.sizes.length).length;
  const coarseSellers = producers.filter((p) => p.sizes.includes("coarse")).length;

  return (
    <>
      <h1>US biochar supply map</h1>
      <p className="lead">
        Who makes biochar, where, from what, and who needs it. Click any point for details. Bigger producer dots mean
        more known volume.
      </p>

      <div className="stats">
        <div className="stat"><b>{producers.length}</b><span>Producers mapped</span></div>
        <div className="stat"><b>{buyers.length}</b><span>Buyers and target segments</span></div>
        <div className="stat"><b>{knownCapacity.toLocaleString()} t/yr</b><span>Published capacity (incomplete)</span></div>
        <div className="stat"><b className="warn">{unpublishedSizes} of {producers.length}</b><span>Don't publish particle sizes</span></div>
        <div className="stat"><b className="warn">{coarseSellers}</b><span>Sell coarse filtration grades</span></div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="filters" role="group" aria-label="Filter producers by feedstock">
            {Object.entries(FEEDS).map(([k, label]) => (
              <button key={k} className={`chip ${feeds.includes(k) ? "on" : ""}`} onClick={() => toggle(k)}>{label}</button>
            ))}
            <button className={`chip ${showBuyers ? "on" : ""}`} onClick={() => setShowBuyers(!showBuyers)}>Buyers</button>
          </div>
          <Map producers={shownProducers} buyers={shownBuyers} hub={hub} onPick={setPicked} />
          <div className="legend">
            <span><i className="dot" style={{ background: "#8b5a2b" }} />Wood producer</span>
            <span><i className="dot" style={{ background: "#c9a227" }} />Crop-residue producer</span>
            <span><i className="dot" style={{ background: "#7b5ea7" }} />Biosolids producer</span>
            {Object.entries(segmentColors).map(([k, c]) => (
              <span key={k}><i className="ring" style={{ borderColor: c }} />{k} buyer</span>
            ))}
          </div>
        </div>

        <div className="panel">
          {picked ? (
            <>
              <h2>{picked.item.name}</h2>
              <p className="note">{picked.item.city}</p>
              {picked.type === "producer" ? (
                <ul className="list">
                  <li><small>Feedstock</small>{picked.item.feedstock}</li>
                  <li><small>Capacity</small>{picked.item.capacityTpy ? `${picked.item.capacityTpy.toLocaleString()} t/yr` : "Not published"}</li>
                  <li><small>Credits delivered</small>{picked.item.deliveredT ? `${picked.item.deliveredT.toLocaleString()} t` : "Not published"}</li>
                  <li><small>Particle sizes sold</small>{picked.item.sizes.length ? picked.item.sizes.join(", ") : "Not published"}</li>
                  <li><small>Certifications</small>{picked.item.certs.join(", ") || "None listed"}</li>
                  <li><small>Sales channels</small>{picked.item.channels.join(", ") || "Unknown"}</li>
                  {picked.item.notes && <li><small>Notes</small>{picked.item.notes}</li>}
                </ul>
              ) : (
                <ul className="list">
                  <li><small>Segment</small>{picked.item.segment}</li>
                  <li><small>Status</small>{picked.item.status}</li>
                  <li><small>Size needed</small>{picked.item.size}</li>
                  <li><small>Volume</small>{picked.item.needTpy ? `${picked.item.needTpy} t/yr (estimate)` : "To learn"}</li>
                  <li><small>Notes</small>{picked.item.notes}</li>
                  <li><a href={`/match?buyer=${picked.item.id}`}>Find producers for this buyer →</a></li>
                </ul>
              )}
            </>
          ) : (
            <>
              <h2>Producers</h2>
              <ul className="list">
                {shownProducers.map((p) => (
                  <li key={p.id}>
                    <b>{p.name}</b>
                    <small>{p.city} · {p.feedstock}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
