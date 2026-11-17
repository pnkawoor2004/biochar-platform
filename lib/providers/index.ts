// Provider interfaces. Each has a mock default that needs no keys, and a real adapter switched on by env vars (see .env.example).
// The real adapters are thin and UNTESTED tonight: no keys were available and no sign-ups were allowed.
import type { Lot, Org, OutboxEmail, Payment } from "@/lib/domain/types";
import type { AssumptionMap } from "@/config/assumptions";
import { HUB } from "@/config/assumptions";
import { estimateDistances, lotOrigin } from "@/lib/logistics/distances";
import type { Distances } from "@/lib/logistics/quote";
import type { Pt } from "@/lib/logistics/geo";

// ---- Email: Mock writes to the Outbox page. Live sending needs RESEND_API_KEY on the server and NEXT_PUBLIC_EMAIL_LIVE=1.
export interface EmailProvider { name: string; send(e: Omit<OutboxEmail, "id" | "provider">): Omit<OutboxEmail, "id"> }
export function emailProvider(): EmailProvider {
  const live = typeof window !== "undefined" && process.env.NEXT_PUBLIC_EMAIL_LIVE === "1";
  return { name: live ? "resend" : "mock-outbox", send(e) {
    if (live) fetch("/api/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e) }).catch(() => {});
    return { ...e, provider: live ? "resend" : "mock-outbox" };
  } };
}
// ---- Payments: Mock settles instantly. Stripe test mode is offered on the order page when NEXT_PUBLIC_STRIPE=1 and STRIPE_SECRET_KEY=sk_test_….
export interface PaymentsProvider { name: string; charge(p: Pick<Payment, "id" | "kind" | "usd" | "method" | "at">): Payment }
export function paymentsProvider(): PaymentsProvider { return { name: "mock", charge: (p) => ({ ...p, status: "succeeded", provider: "mock (no real money)" }) }; }
export const stripeEnabled = () => process.env.NEXT_PUBLIC_STRIPE === "1";

// ---- Routing: OpenRouteService truck routing through /api/matrix when ORS_API_KEY is set; otherwise straight line × road factor.
export async function getDistances(lots: Lot[], orgs: Org[], dest: Pt, A: AssumptionMap): Promise<Distances> {
  const est = estimateDistances(lots, orgs, dest, A);
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_STATIC === "1") return est;
  try {
    const sources = lots.map((l) => ({ id: l.id, ...(lotOrigin(l, orgs) ?? { lat: NaN, lng: NaN }) })).filter((x) => !isNaN(x.lat));
    const call = async (destination: Pt, src: typeof sources) => { const r = await fetch("/api/matrix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sources: src, destination }) }); return r.json(); };
    const [a, b] = await Promise.all([call(dest, [...sources, { id: "__hub", lat: HUB.lat, lng: HUB.lng }]), call(HUB, sources)]);
    if (!a.live || !b.live) return est;
    const direct = Object.fromEntries(a.results.map((x: any) => [x.id, x.miles])); const hubToBuyer = direct.__hub; delete direct.__hub;
    return { direct, toHub: Object.fromEntries(b.results.map((x: any) => [x.id, x.miles])), hubToBuyer, live: true };
  } catch { return est; }
}
// ---- Geocoding: a built-in place list (no key). ORS geocoding can be added behind /api/geocode.
export const PLACES: { label: string; lat: number; lng: number }[] = [
  ["Chicago, IL", 41.88, -87.63], ["West Chicago, IL", 41.88, -88.2], ["Aurora, IL", 41.76, -88.32], ["Joliet, IL", 41.53, -88.08], ["Cicero, IL", 41.845, -87.76], ["Rockford, IL", 42.27, -89.09], ["Naperville, IL", 41.75, -88.15], ["Elgin, IL", 42.04, -88.28], ["Peoria, IL", 40.69, -89.59], ["Springfield, IL", 39.78, -89.65],
  ["Milwaukee, WI", 43.04, -87.91], ["Madison, WI", 43.07, -89.4], ["Green Bay, WI", 44.51, -88.01], ["Gary, IN", 41.59, -87.35], ["Indianapolis, IN", 39.77, -86.16], ["South Bend, IN", 41.68, -86.25], ["Detroit, MI", 42.33, -83.05], ["Grand Rapids, MI", 42.96, -85.67],
  ["Minneapolis, MN", 44.98, -93.27], ["Duluth, MN", 46.79, -92.1], ["Des Moines, IA", 41.59, -93.62], ["St. Louis, MO", 38.63, -90.2], ["Kansas City, MO", 39.1, -94.58], ["Columbus, OH", 39.96, -83.0], ["Cleveland, OH", 41.5, -81.69], ["Cincinnati, OH", 39.1, -84.51], ["Louisville, KY", 38.25, -85.76],
  ["Pittsburgh, PA", 40.44, -79.99], ["Philadelphia, PA", 39.95, -75.17], ["New York, NY", 40.71, -74.01], ["Boston, MA", 42.36, -71.06], ["Baltimore, MD", 39.29, -76.61], ["Washington, DC", 38.91, -77.04], ["Atlanta, GA", 33.75, -84.39], ["Charlotte, NC", 35.23, -80.84], ["Nashville, TN", 36.16, -86.78], ["Memphis, TN", 35.15, -90.05],
  ["Dallas, TX", 32.78, -96.8], ["Houston, TX", 29.76, -95.37], ["Denver, CO", 39.74, -104.99], ["Salt Lake City, UT", 40.76, -111.89], ["Phoenix, AZ", 33.45, -112.07], ["Seattle, WA", 47.61, -122.33], ["Portland, OR", 45.52, -122.68], ["San Francisco, CA", 37.77, -122.42], ["Los Angeles, CA", 34.05, -118.24], ["Sacramento, CA", 38.58, -121.49],
].map(([label, lat, lng]) => ({ label: label as string, lat: lat as number, lng: lng as number }));
// ---- Storage: COA files are read in the browser and their text is parsed; nothing is uploaded in demo mode.
export const storageProvider = () => ({ name: "browser-only (demo)" });
