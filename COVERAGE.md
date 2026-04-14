# Coverage — Japan FSA Financial Guidance MCP

> Last verified: 2026-04-13 | Database version: 0.1.0

## What's Included

| Source | Items | Version | Completeness | Refresh |
|--------|-------|---------|-------------|---------|
| Major Banks Supervisory Guidelines | ~350 items | 2024 | Partial (key sections) | Monthly |
| Cyber Security Guidelines | ~85 items | 2024 (Oct) | Full | Monthly |
| AML/CFT Guidelines | ~120 items | 2024 (rev.) | Full | Monthly |
| Insurance Supervisory Guidelines | ~280 items | 2024 | Partial (key sections) | Monthly |
| Securities Supervisory Guidelines | ~220 items | 2024 | Partial (key sections) | Monthly |

**Total:** 6 tools, ~1,055 guidance items across 5 categories, ~100-200 source documents

**Languages:** Japanese (primary authoritative) and English (official FSA translations)

## What's NOT Included

| Gap | Reason | Planned? |
|-----|--------|----------|
| Confidential FSA examination feedback | Not publicly published | No |
| FSA enforcement orders and sanctions | Published individually; separate indexing needed | Yes v2 |
| Bank of Japan payment regulations | Different regulator | Separate MCP |
| METI cybersecurity (critical infrastructure) | Different regulator | Separate MCP |
| Public consultation papers | Too volatile; included only when finalised | Partial |
| Regional FSA bureau guidance | Not consistently published centrally | No |

## Language Coverage

- **Japanese:** Full coverage of all indexed documents (primary source)
- **English:** FSA official English translations where available — typically main supervisory guidelines and major policy documents. English translations may lag Japanese versions by 1-6 months.

## Limitations

- FSA guidance is HTML-based with complex formatting; text extraction may miss tables and structured annexes
- Some guideline versions may lag official FSA releases by up to one month
- The Comprehensive Inspection Manual is highly detailed; full coverage requires multiple ingestion passes
- Japanese text search works best with exact regulatory terminology; romaji queries may produce lower recall

## Data Freshness

| Source | Refresh Schedule | Last Refresh | Next Expected |
|--------|-----------------|-------------|---------------|
| Supervisory Guidelines | Monthly | 2026-04-13 | 2026-05-13 |
| Cyber Security Guidelines | Monthly | 2026-04-13 | 2026-05-13 |
| AML/CFT Guidelines | Monthly | 2026-04-13 | 2026-05-13 |

To check freshness programmatically, call the `jp_fsa_about` tool.
