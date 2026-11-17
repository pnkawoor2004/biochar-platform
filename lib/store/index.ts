"use client";
// Client-side store. State lives in the browser (localStorage, with an in-memory fallback), seeded from data/ and the engines.
// This is the documented "demo mode": it runs with zero env vars on Vercel or as a static export. Swap this module for a database-backed
// one to go multi-user; the engines in lib/match, lib/logistics and lib/orders do not change.
import { useSyncExternalStore } from "react";
import type { Lot, Rfq, Quote, Order, Message, Notification, OutboxEmail, ServiceSite, Visit, SpentBatch, HubItem, FinishingJob, Offer, QuoteOption, Org } from "@/lib/domain/types";
import { DEFAULTS, type AssumptionMap } from "@/config/assumptions";
import { seedLots, allOrgs } from "@/lib/data";
import { buildSeed } from "./seed";

export type Role = "buyer" | "producer" | "ops";
export interface State {
  v: number; role: Role; lots: Lot[]; rfqs: Rfq[]; quotes: Quote[]; orders: Order[]; messages: Message[]; notifications: Notification[]; outbox: OutboxEmail[];
  offers: Offer[]; sites: ServiceSite[]; visits: Visit[]; spent: SpentBatch[]; hub: HubItem[]; jobs: FinishingJob[]; A: AssumptionMap; seq: number;
  producerOrgId: string; buyerName: string; extraOrgs: Org[]; verifyRequests: { lot_id: string; at: string; status: "requested" | "sample_received" | "verified" }[];
}
const KEY = "charlink-v1-state"; const VERSION = 3;
let state: State | null = null; const listeners = new Set<() => void>();
let serverSnapshot: State | null = null;

function fresh(): State {
  const base: State = { v: VERSION, role: "buyer", lots: structuredClone(seedLots), rfqs: [], quotes: [], orders: [], messages: [], notifications: [], outbox: [], offers: [], sites: [], visits: [], spent: [], hub: [], jobs: [], A: { ...DEFAULTS }, seq: 1000,
    producerOrgId: "demo-prairie", buyerName: "Clearwater Natural Pools (DEMO buyer)", extraOrgs: [], verifyRequests: [] };
  return buildSeed(base);
}
function load(): State {
  if (typeof window === "undefined") return (serverSnapshot ??= fresh());
  try { const raw = window.localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw) as State; if (s.v === VERSION) return s; } } catch { /* storage unavailable: stay in memory */ }
  return fresh();
}
function persist() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
export function getState(): State { return (state ??= load()); }
export function setState(fn: (s: State) => State) { state = fn(getState()); persist(); listeners.forEach((l) => l()); }
export function resetState() { try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } state = fresh(); persist(); listeners.forEach((l) => l()); }
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getServer = () => (serverSnapshot ??= fresh());
export function useStore(): State { return useSyncExternalStore(subscribe, getState, getServer); }
export const orgsOf = (s: State): Org[] => [...allOrgs, ...s.extraOrgs];
export const nextId = (s: State, prefix: string) => `${prefix}-${s.seq + 1}`;
export type { QuoteOption };
