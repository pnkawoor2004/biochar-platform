import type { Lot, Org } from "@/lib/domain/types";
import { HUB, type AssumptionMap } from "@/config/assumptions";
import { estimatedRoadMiles, type Pt } from "./geo";
import type { Distances } from "./quote";
export function lotOrigin(lot: Lot, orgs: Org[]): Pt | null {
  const s = orgs.find((o) => o.id === lot.org_id)?.sites[lot.site_index];
  return s && s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null;
}
// Estimated road miles (straight line × road factor). The routing provider replaces these with truck-route miles when a key is set.
export function estimateDistances(lots: Lot[], orgs: Org[], dest: Pt, A: AssumptionMap): Distances {
  const direct: Record<string, number> = {}, toHub: Record<string, number> = {};
  for (const l of lots) { const o = lotOrigin(l, orgs); if (!o) continue; direct[l.id] = estimatedRoadMiles(o, dest, A); toHub[l.id] = estimatedRoadMiles(o, HUB, A); }
  return { direct, toHub, hubToBuyer: estimatedRoadMiles(HUB, dest, A), live: false };
}
