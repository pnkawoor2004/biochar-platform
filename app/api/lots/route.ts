import { NextResponse } from "next/server";
import { seedLots } from "@/lib/data";
export async function GET() { return NextResponse.json({ demo: true, note: "All lots are DEMO data.", count: seedLots.length, rows: seedLots }); }
