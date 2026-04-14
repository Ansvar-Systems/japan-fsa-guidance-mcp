# Registry Listing — Japan FSA Financial Guidance MCP

Canonical metadata for npm, the Official MCP Registry, Smithery, Glama, and mcp.run listings. Keep these strings in sync when publishing.

## Identifiers

| Field | Value |
|-------|-------|
| npm package | `@ansvar/japan-fsa-guidance-mcp` |
| MCP Registry name | `jp.ansvar/japan-fsa-guidance-mcp` |
| Repository | `https://github.com/Ansvar-Systems/japan-fsa-guidance-mcp` |
| Container image | `ghcr.io/ansvar-systems/japan-fsa-guidance-mcp:latest` |
| Public endpoint | `https://mcp.ansvar.eu/japan-fsa-guidance` |
| License | BSL-1.1 (converts to Apache-2.0 on 2030-04-13) |
| Author | Ansvar Systems AB <hello@ansvar.ai> |
| Homepage | https://ansvar.ai/mcp |

## Short description (one line)

Query Financial Services Agency of Japan (金融庁) supervisory guidelines, cyber security guidelines, AML/CFT guidelines, and inspection manuals.

## Medium description (Smithery, Glama, mcp.run)

The Japan FSA Financial Guidance MCP exposes a structured, full-text search index over the Financial Services Agency of Japan's supervisory guidelines, inspection manuals, AML/CFT requirements, and the 2024 cyber security guidelines for financial institutions. 118 indexed items across 29 framework categories with bilingual (Japanese + English) support.

Built by Ansvar Systems (ansvar.eu) — part of the Ansvar MCP Network providing structured access to global legislation, compliance frameworks, and cybersecurity standards.

This is a reference tool, not professional advice. Verify critical data against authoritative sources at https://www.fsa.go.jp/.

## Tags

`mcp`, `model-context-protocol`, `japan`, `fsa`, `financial-regulation`, `aml`, `cyber-security`, `compliance`, `bank-supervision`, `insurance-supervision`, `securities-supervision`, `ansvar`

## Category

`compliance` (regulation)

## Tools (7)

| Tool | Category |
|------|----------|
| `jp_fsa_search_guidance` | search |
| `jp_fsa_get_guideline` | lookup |
| `jp_fsa_search_inspections` | search |
| `jp_fsa_list_categories` | lookup |
| `jp_fsa_about` | meta |
| `jp_fsa_list_sources` | meta |
| `jp_fsa_check_data_freshness` | meta |

Full schemas: [TOOLS.md](TOOLS.md).

## Coverage summary

| Source | Items | Refresh |
|--------|-------|---------|
| FSA Japan English portal | 14 | Monthly |
| FSA Japan Japanese portal | 75 | Monthly |
| **Total indexed items** | **118** (29 categories + 29 inspections + 60 guidelines) | |

Full coverage report: [COVERAGE.md](COVERAGE.md).
