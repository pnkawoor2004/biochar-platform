import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULTS } from "@/config/assumptions";
import { appById, APPLICATIONS } from "@/config/applications";
import { evaluate, proposeBlend } from "@/lib/match";
import { estimateDistances } from "@/lib/logistics/distances";
import { seedLots, allOrgs } from "@/lib/data";
import type { Rfq } from "@/lib/domain/types";
// Stateless matching over the seeded lots: POST an RFQ-shaped body, get ranked matches with reasons and landed-cost options.
const Body = z.object({ application: z.enum(APPLICATIONS.map((a) => a.id) as [string, ...string[]]), tonnes: z.number().positive().max(5000), dest: z.object({ label: z.string().default("Destination"), lat: z.number(), lng: z.number() }),
  packaging: z.enum(["bulk_ftl", "supersack", "bag", "cartridge"]).default("supersack"), grade: z.string().optional(), sample_first: z.boolean().default(false), model: z.enum(["agent", "principal"]).default("principal") });
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json()); if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  const b = p.data; const rfq = { id: "api", created: new Date().toISOString(), buyer_name: "API", application: b.application, answers: b.grade ? { grade: b.grade } : {}, qty: b.tonnes, qty_unit: "t", tonnes: b.tonnes, m3: (b.tonnes * 1000) / DEFAULTS.defaultBulkDensity, dest: b.dest, packaging: b.packaging, sample_first: b.sample_first, status: "submitted" } as Rfq;
  const ctx = { rfq, app: appById(b.application), lots: seedLots, orgs: allOrgs, dist: estimateDistances(seedLots, allOrgs, b.dest, DEFAULTS), A: DEFAULTS, model: b.model };
  const matches = evaluate(ctx); const blend = proposeBlend(matches, ctx);
  return NextResponse.json({ demo: true, note: "Lots and prices are DEMO data. Road miles are estimated.", matches: matches.map((m) => ({ lot_id: m.lot.id, producer: m.org?.name, feasible: m.feasible, score: m.score, path: m.path, hard_fails: m.hardFails, missing: m.missing, breakdown: m.breakdown, option: m.option })), blend: blend && { lots: blend.parts.map((x) => ({ lot_id: x.lot.id, tonnes: x.outTonnes })), meets_grade: blend.meets, option: blend.option } });
}
