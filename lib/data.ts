// Typed access to the versioned dataset built by scripts/build-data.ts.
import dataset from "@/data/dataset.json";
import lotsJson from "@/data/demo-lots.json";
import type { Org, Lot } from "@/lib/domain/types";
export const stats = dataset.stats;
export const producers = dataset.producers as unknown as Org[];
export const buyers = dataset.buyers as unknown as Org[];
export const partners = dataset.partners as unknown as Org[];
export const demoOrgs = dataset.demoOrgs as unknown as Org[];
export const partnerGaps = dataset.partnerGaps;
export const allOrgs: Org[] = [...producers, ...buyers, ...partners, ...demoOrgs];
export const seedLots = lotsJson as unknown as Lot[];
export const orgById = (id?: string) => allOrgs.find((o) => o.id === id);
