# CharLink dataset: sources and coverage

Generated 2026-11-17 by `scripts/build-data.ts` from `data/raw/`. Built independently; no data from the teammate's U.S. Biochar Atlas.

## Method
- Start: the 26 producers in CharLink v0.1 (team research, Oct–Nov 2026: CDR.fyi, company and press pages).
- Nov 16, 2026 web research: US Biochar Initiative supplier list and directory (by state and sector), American Biochar Institute directory, company bulk/product pages, state and university publications, trade news.
- Access limit: this session could open only pages returned by web search, not arbitrary company sites. So most new producers are **listing-level** records (name, location, what they sell). Only a few have product-page depth. The app shows which is which.
- Nothing is invented. A missing field means "not found published" and counts toward the producer's data-gap score.
- Locations: city-level unless marked. "state" precision means only the state is known (sometimes inferred from a phone area code, noted on the record); those pins are approximate.
- DEMO lots (26) and DEMO organizations (6) are fictional and badged in the app. Property values come from literature ranges in `config/property-ranges.ts`.

## Counts
- Supply organizations: **82** (target was 100+)
- Demand organizations and segments: **41** (target 40–60)
- Labs, registries, standards bodies, software, competitors: **18** (target 15–30). Logistics partners near Chicago are **not** sourced yet: see the gap list in `data/raw/demand.ts`.

### Supply by review depth
| Depth | Count |
|---|---|
| listing | 61 |
| project_research | 17 |
| product_page | 4 |

### Supply by state (first site)
| State | Count |
|---|---|
| CA | 8 |
| WA | 6 |
| TX | 6 |
| n/s | 5 |
| OR | 4 |
| PA | 4 |
| LA | 3 |
| AR | 3 |
| NY | 3 |
| MI | 3 |
| MA | 3 |
| GA | 2 |
| IA | 2 |
| MS | 2 |
| VA | 2 |
| ME | 2 |
| CO | 2 |
| MO | 2 |
| IN | 2 |
| WI | 2 |
| MN | 2 |
| NC | 2 |
| WY | 1 |
| NJ | 1 |
| UT | 1 |
| MT | 1 |
| NH | 1 |
| VT | 1 |
| ND | 1 |
| MD | 1 |
| KY | 1 |
| AZ | 1 |
| AL | 1 |
| TN | 1 |

### Supply by feedstock class
| Feedstock | Count |
|---|---|
| unknown | 35 |
| wood | 32 |
| ag | 7 |
| biosolids | 4 |
| manure | 2 |
| bone | 1 |
| mixed | 1 |

### Supply by status
| Status | Count |
|---|---|
| unknown | 39 |
| operating | 37 |
| planned | 5 |
| pilot | 1 |

### Supply by confidence
| Confidence | Count |
|---|---|
| medium | 52 |
| low | 27 |
| high | 3 |

### Demand by provenance
| Provenance | Count |
|---|---|
| published | 27 |
| estimate | 8 |
| interview | 6 |

## What producers publish (the gap CharLink closes)
Of 81 producers and suppliers:
- Particle size data found: **2**
- Any lab values found: **4**
- A public bulk price found: **2**
- A coarse (>2 mm) product known: **4**
- Any certification found: **7**
- Average data-gap score: **0.89** (share of 8 key fields not found)

Caveat: for listing-level records the product pages were not read, so "not found" partly reflects our access limit, not only what the producer publishes. The verification calls will settle it.

## Main sources
- usbi: https://biochar-us.org/node/18
- usbiDir: https://biochar-us.org/directory
- abi: https://biochar.org/industry-directory/
- team: project:claude/us-biochar-carbon-credit-landscape.md
- v01: repo:lib/data.js@v0.1
- buyers: project:claude/bulk-biochar-buyers-oct28.md
- contacts: project:claude/segment-contacts-applications.md
- Product pages read: wakefieldbiochar.com (bulk), environmental-expert.com (Black Owl stormwater mix), shop.urbanwormcompany.com (truckload price), biochar.org (Terra Char entry)
- Guidance used for grades: USBI stormwater talk (Gray, 2023), Chesapeake Bay Program draft memo, Nebraska Forest Service stormwater fact sheet, UIUC filter study
