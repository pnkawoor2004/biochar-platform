import { NextResponse } from "next/server";
import { z } from "zod";
// Real email through Resend. Off unless RESEND_API_KEY and EMAIL_FROM are set AND the client sets NEXT_PUBLIC_EMAIL_LIVE=1.
// Safety: only sends to addresses listed in EMAIL_ALLOWLIST (comma-separated), so demo addresses never receive mail. UNTESTED (no key tonight).
const Body = z.object({ to: z.string().email(), subject: z.string().max(200), body: z.string().max(5000) });
export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM; const allow = (process.env.EMAIL_ALLOWLIST ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const p = Body.safeParse(await req.json()); if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  if (!key || !from) return NextResponse.json({ sent: false, mock: true, reason: "RESEND_API_KEY / EMAIL_FROM not set" });
  if (!allow.includes(p.data.to)) return NextResponse.json({ sent: false, reason: "Recipient not in EMAIL_ALLOWLIST" });
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: p.data.to, subject: p.data.subject, text: p.data.body }) });
  return NextResponse.json({ sent: r.ok, status: r.status });
}
