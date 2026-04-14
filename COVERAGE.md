# Coverage — Japan FSA Financial Guidance MCP

> Last verified: 2026-04-14 | Database version: 0.1.0 | Ingested from live FSA portals

## What's Included

Data ingested directly from the Financial Services Agency of Japan portals (English and Japanese) on 2026-04-14. The Japanese portal (`/common/law/`) is the primary authoritative source; the English portal (`/en/refer/guide/`) exposes a subset of official FSA translations that can lag Japanese releases by 1-6 months.

| Entity       | Rows | Source(s) |
|--------------|------|-----------|
| Categories   | 29   | Derived from framework-type documents (supervisory guidelines, inspection manuals) |
| Inspections  | 29   | One top-level inspection item per framework document (section-level parsing is a future enhancement) |
| Guidelines   | 60   | Circulars, Q&As, AML/CFT guidance, cyber security guidance, and shorter framework documents |
| **Total**    | **118** |  |

Source document count: **89 unique documents** fetched (14 English + 75 Japanese).

## Language Coverage

Schema stores `title_ja` and `title_en` with `""` (empty string) meaning "translation not available in this language" — the `NOT NULL` constraint on both columns precludes `NULL`. Callers should treat `""` as missing.

| Entity      | Japanese-only | English-only | Both languages |
|-------------|---------------|--------------|----------------|
| Categories  | 22            | 7            | 0              |
| Guidelines  | 53            | 7            | 0              |
| **Total**   | **75**        | **14**       | **0**          |

"Both languages" is currently zero because the ingest pipeline treats each URL as a single doc without cross-linking JA↔EN translation pairs. Several Japanese catalog rows explicitly point at English PDFs (marked `（英語版）`) and are correctly classified as English-only entries. Bilingual linking of JA primary documents to their official English translations is a future enhancement.

## What's NOT Included

| Gap | Reason | Planned? |
|-----|--------|----------|
| Section-level inspection items | Ingest stores each framework doc as a single inspection row; parsing the numbered-section schema (`Ⅱ-1-1`, `別紙`) is a future enhancement | Yes |
| JA↔EN translation pairing | Ingest treats each URL as independent — the same doc in both languages appears as two rows, not one bilingual row | Yes |
| Confidential FSA examination feedback | Not publicly published | No |
| FSA enforcement orders and sanctions | Published individually under `/status/` — separate indexing needed | Yes v2 |
| Bank of Japan payment regulations | Different regulator | Separate MCP |
| METI cybersecurity (critical infrastructure) | Different regulator | Separate MCP |
| Public consultation papers | Too volatile; finalised guidance only | Partial |
| Regional FSA bureau guidance | Not consistently published centrally | No |

## Limitations

- FSA guidance is HTML-based with complex formatting; text extraction may miss tables and structured annexes.
- Some PDF docs with embedded image-only content extract to near-empty text.
- The EN portal's generic link text (e.g. "Outline(PDF:139KB)", "Briefing Materials") sometimes surfaces as the title; the HTML structure on `/en/refer/legislation/` does not always expose a descriptive heading for the inline-list format.
- The Comprehensive Inspection Manual is highly detailed; full control-level coverage requires section-level parsing.
- Japanese text search works best with exact regulatory terminology; romaji queries will produce lower recall.

## Data Freshness

| Source | Refresh Schedule | Last Refresh | Next Expected |
|--------|-----------------|--------------|---------------|
| Supervisory Guidelines catalog (JA) | Monthly | 2026-04-14 | 2026-05-14 |
| Legislation & Guidelines index (EN) | Monthly | 2026-04-14 | 2026-05-14 |
| AML/CFT & Cyber Security Guidelines | Monthly | 2026-04-14 | 2026-05-14 |

Programmatic freshness check: `npm run freshness:check`.
