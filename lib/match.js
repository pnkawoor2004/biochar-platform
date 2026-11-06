import { applications } from "./data";
import { shipment } from "./logistics";

// Can this producer's sizes meet the application's size?
// Coarse can be crushed to medium or fine at the hub; fine can never become coarse.
const ORDER = { fine: 0, medium: 1, coarse: 2 };
export function sizePath(producer, need) {
  if (!producer.sizes.length) return "unknown"; // not published: screen and test at the hub
  if (producer.sizes.includes(need)) return "direct";
  const maxSize = Math.max(...producer.sizes.map((s) => ORDER[s]));
  return maxSize > ORDER[need] ? "hub" : "infeasible";
}

export const PATH_LABEL = {
  direct: "Ships direct: grade already sold",
  hub: "Via hub: crush and screen to grade",
  unknown: "Via hub: sizes not published, screen and test",
  infeasible: "Too fine for this use",
};

// dist: { [producerId]: { direct, toHub } } road miles; hubToBuyer: miles
export function rankProducers({ producers, appKey, tonnes, dist, hubToBuyer }) {
  const app = applications[appKey];
  return producers
    .map((p) => {
      const path = sizePath(p, app.size);
      const viaHub = path === "hub" || path === "unknown";
      const d = dist[p.id] || {};
      const miles = viaHub ? (d.toHub ?? 0) + hubToBuyer : d.direct ?? 0;
      const ship = shipment(miles, tonnes);
      const feedOk = app.feed.includes(p.feedClass);
      const scaleKnown = p.capacityTpy || p.deliveredT;
      const scaleOk = scaleKnown && (p.capacityTpy || p.deliveredT) >= tonnes;

      const score = Math.round(
        (feedOk ? 30 : 0) +
          ({ direct: 25, hub: 15, unknown: 12, infeasible: 0 }[path]) +
          Math.max(0, 30 * (1 - miles / 2000)) +
          (scaleOk ? 15 : scaleKnown ? 5 : 7)
      );
      return { producer: p, path, viaHub, miles, ...ship, perTonne: ship.freightUsd / tonnes, feedOk, scaleOk, score,
        feasible: feedOk && path !== "infeasible" };
    })
    .sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.score - a.score);
}

// Swap suggestion: an equally suitable producer with lower transport emissions than the current one.
export function closerAlternative(ranked, currentId) {
  const current = ranked.find((r) => r.producer.id === currentId);
  if (!current) return null;
  const tier = (r) => ({ direct: 3, hub: 2, unknown: 2, infeasible: 0 }[r.path]);
  const better = ranked
    .filter((r) => r.feasible && r.producer.id !== currentId && tier(r) >= tier(current) && r.co2Kg < current.co2Kg)
    .sort((a, b) => a.co2Kg - b.co2Kg)[0];
  if (!better) return { current, better: null };
  return {
    current,
    better,
    savedCo2Kg: current.co2Kg - better.co2Kg,
    savedUsd: current.freightUsd - better.freightUsd,
    savedMiles: current.truckMiles - better.truckMiles,
  };
}
