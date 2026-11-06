# Biochar Platform

Team Biochar (NUvention: Energy, Northwestern). A US biochar supply map, buyer matching, real truck routing, testing and service platform.

## What's here

- **Map** (`/`): US producers by feedstock and buyers by segment, with known capacity and the data gaps.
- **Match a buyer** (`/match`): ranks producers for a buyer's need on feedstock fit, particle size, real truck road miles, scale, freight cost and CO2. Routes through the Chicago finishing hub when no producer sells the right size. Suggests a closer equivalent source when a current supplier is chosen.

## Deploy

Vercel: import this repo, add environment variable `ORS_API_KEY` (OpenRouteService key), deploy. Without the key, the app still runs and shows estimated road miles.

Data lives in `lib/data.js`. Freight and emissions assumptions are in `lib/logistics.js`.
