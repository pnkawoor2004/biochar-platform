# Build log

## Stage 0 (Nov 16, 23:50 CT)
- Read brief, project docs and v0.1 code. Branch `v1-overnight`. Wrote PLAN.md (7 decisions made without the owner).

## Stage 1 (Nov 17, 00:40 CT): dataset and configs
- `data/raw/*.ts` → `npm run data` → `data/dataset.json`, `data/demo-lots.json`, `data/SOURCES.md`.
- 82 supply organizations, 41 demand organizations and segments, 18 labs/registries/standards/software/competitors. 26 DEMO lots, 6 DEMO organizations.
- Shortfall vs brief: 82 producers, not 100+; logistics partners near Chicago not sourced (listed as gaps). Reason: the session can only open pages returned by web search, so company sites could not be read one by one. Most new producers are listing-level records. Logged, moved on.
- `config/`: assumptions (each with basis and source), CharLink Grade standard draft v0.1 (8 grades; each limit marked sourced or draft), 11 application profiles, demo property ranges.

## Stage 2 (Nov 17, 01:05 CT): engines and tests
- `lib/match` (hard filters, size path, weighted score with reasons, blend, closer source), `lib/logistics` (cube-out freight, FTL/LTL/parcel/van, landed-cost quote), `lib/orders` (state machine, escrow money split), `lib/credits`.
- 24 unit tests pass (`npm test`).

## Stages 3–4 (Nov 17, ~02:00 CT, work in progress): buyer flow, orders, documents
- Browser demo store with a seeded set of 6 scenarios (`lib/store`), mock email/payments, ORS routing with estimate fallback, Stripe test and Resend adapters (untested; no keys).
- Pages: `/request` (wizard), `/rfq` (ranked matches, blend, closer source, samples, messages), `/lot` (passport, QR), `/quote`, `/order` (state machine, escrow, shipment, compliance), `/doc` (8 printable documents), `/account`.
- `npm run build` passes. The run stopped here; the map page is a placeholder and stages 5–7 are not started.
