import "leaflet/dist/leaflet.css";
import "./globals.css";
import type { ReactNode } from "react";
import Header from "@/components/Header";

export const metadata = { title: "CharLink | Qualified biochar sourcing", description: "Verified grades, lot passports, landed-cost quotes and logistics for U.S. biochar buyers. Team Biochar, NUvention: Energy." };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body>
      <Header />
      <main>{children}</main>
      <footer>
        Prototype by Team Biochar, NUvention: Energy, Northwestern University. Organizations come from public sources and team interviews (Nov 2026), each with a source.
        Lots, prices, lab values, buyers and transactions marked DEMO are fictional. Payments are simulated; no real money moves. Estimates are for planning only.
      </footer>
    </body></html>
  );
}
