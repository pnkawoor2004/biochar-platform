// Freight and emissions assumptions. Rough figures for planning; refine with carrier quotes.
export const ASSUMPTIONS = {
  kgCo2PerTruckMile: 1.57, // ~10.2 kg CO2 per gallon diesel at ~6.5 mpg, loaded tractor-trailer
  usdPerTruckMile: 3.0,     // typical full-truckload rate range $2.50–3.50
  tonnesPerTruck: 20,       // biochar fills a 53' trailer by volume (~100 m3 at ~0.2–0.25 t/m3)
  roadFactor: 1.25,         // straight-line to road distance, used only when live routing is unavailable
};

const toRad = (d) => (d * Math.PI) / 180;

export function straightMiles(a, b) {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimatedRoadMiles(a, b) {
  return straightMiles(a, b) * ASSUMPTIONS.roadFactor;
}

// Cost and CO2 for moving a quantity over a road distance (one way, full trucks).
export function shipment(miles, tonnes) {
  const trucks = Math.max(1, Math.ceil(tonnes / ASSUMPTIONS.tonnesPerTruck));
  const truckMiles = trucks * miles;
  return {
    trucks,
    truckMiles,
    freightUsd: truckMiles * ASSUMPTIONS.usdPerTruckMile,
    co2Kg: truckMiles * ASSUMPTIONS.kgCo2PerTruckMile,
  };
}
