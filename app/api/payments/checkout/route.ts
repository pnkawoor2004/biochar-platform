import { NextResponse } from "next/server";
import { z } from "zod";
// Stripe Checkout in TEST MODE only. Refuses any key that is not sk_test_. UNTESTED (no key tonight). Payouts to producers would use Stripe Connect.
const Body = z.object({ order_id: z.string(), kind: z.enum(["deposit", "balance"]), usd: z.number().positive().max(1_000_000), origin: z.string().url() });
export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY; const p = Body.safeParse(await req.json()); if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  if (!key) return NextResponse.json({ mock: true, reason: "STRIPE_SECRET_KEY not set; the app uses the mock payments provider" });
  if (!key.startsWith("sk_test_")) return NextResponse.json({ error: "Only Stripe test keys are accepted in this build" }, { status: 400 });
  const b = p.data; const form = new URLSearchParams({ mode: "payment", success_url: `${b.origin}/order?id=${b.order_id}&paid=${b.kind}`, cancel_url: `${b.origin}/order?id=${b.order_id}`, "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][unit_amount]": String(Math.round(b.usd * 100)), "line_items[0][price_data][product_data][name]": `CharLink ${b.kind} for ${b.order_id} (TEST)` });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const j = await r.json(); return NextResponse.json(r.ok ? { url: j.url } : { error: j.error?.message ?? "Stripe error" }, { status: r.ok ? 200 : 502 });
}
