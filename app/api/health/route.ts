import { NextResponse } from "next/server";
export async function GET() { return NextResponse.json({ ok: true, providers: { routing: process.env.ORS_API_KEY ? "openrouteservice" : "estimate", email: process.env.RESEND_API_KEY ? "resend (allowlist only)" : "mock outbox", payments: process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "stripe test" : "mock", store: "browser (demo mode)" } }); }
