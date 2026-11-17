import type { AssumptionMap } from "@/config/assumptions";
export interface Pt { lat: number; lng: number }
const toRad = (d: number) => (d * Math.PI) / 180;
export function straightMiles(a: Pt, b: Pt) {
  const R = 3958.8, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const estimatedRoadMiles = (a: Pt, b: Pt, A: AssumptionMap) => straightMiles(a, b) * A.roadFactor;
