"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore, setState, resetState, type Role } from "@/lib/store";

const SUB: Record<Role, [string, string][]> = {
  buyer: [["/request", "Request biochar"], ["/account", "My requests and orders"], ["/applications", "Applications"], ["/grades", "Grade standard"], ["/pricing", "Pricing"]],
  producer: [["/producer", "Producer portal"], ["/producer?tab=demand", "Demand board"], ["/producer?tab=lots", "My lots"], ["/grades", "Grade standard"], ["/pricing", "Pricing"]],
  ops: [["/ops", "Broker console"], ["/ops?tab=logistics", "Logistics and hub"], ["/service", "Service and take-back"], ["/ops/outbox", "Email outbox"], ["/impact", "Impact dashboard"]],
};
export default function Header() {
  const s = useStore(); const path = usePathname(); const unread = s.notifications.filter((n) => n.role === s.role && !n.read).length;
  return (<>
    <header className="top">
      <Link href="/about" className="brand">CharLink<span>qualified biochar sourcing</span></Link>
      <nav aria-label="Main">
        <Link href="/">Map</Link><Link href="/request">Request</Link><Link href="/applications">Applications</Link><Link href="/grades">Grades</Link><Link href="/match">Quick match</Link><Link href="/about">About</Link>
      </nav>
      <div className="row" style={{ gap: 12 }}>
        <div className="rolebar" role="group" aria-label="View as">
          {(["buyer", "producer", "ops"] as Role[]).map((r) => <button key={r} className={s.role === r ? "on" : ""} aria-pressed={s.role === r} onClick={() => setState((x) => ({ ...x, role: r }))}>{r === "ops" ? "CharLink Ops" : r[0].toUpperCase() + r.slice(1)}</button>)}
        </div>
        <Link href="/account?tab=notifications" className="bell" aria-label={`${unread} unread notifications`}>Alerts{unread > 0 && <b>{unread}</b>}</Link>
        <button className="btn small ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }} onClick={() => { if (window.confirm("Reset the demo to its starting state?")) resetState(); }}>Reset demo</button>
      </div>
    </header>
    <div className="subnav" aria-label="Role navigation"><span style={{ color: "#fff", opacity: 0.55 }}>Viewing as {s.role === "ops" ? "CharLink Ops" : s.role}:</span>{SUB[s.role].map(([h, l]) => <Link key={h} href={h} className={path === h.split("?")[0] ? "on" : ""}>{l}</Link>)}</div>
  </>);
}
