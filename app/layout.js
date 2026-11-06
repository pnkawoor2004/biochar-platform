import "leaflet/dist/leaflet.css";
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "CharLink | Biochar supply platform",
  description: "Map, match, finish, test and service biochar across the US. Team Biochar, NUvention: Energy.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">CharLink<span>by Team Biochar</span></Link>
          <nav>
            <Link href="/">Map</Link>
            <Link href="/match">Match a buyer</Link>
            <span className="soon" title="Coming next">Supply vs demand</span>
            <span className="soon" title="Coming next">Lot passport</span>
            <span className="soon" title="Coming next">Service</span>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          Prototype by Team Biochar, NUvention: Energy, Northwestern University. Data compiled from public sources
          and interviews, Nov 2026. Figures marked as estimates are for planning only.
        </footer>
      </body>
    </html>
  );
}
