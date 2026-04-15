# Japan FSA Financial Guidance MCP

> Structured access to Financial Services Agency of Japan (金融庁) supervisory guidelines, cyber security guidelines, AML/CFT guidelines, and inspection manuals — with bilingual (Japanese + English) full-text search.

[![npm](https://img.shields.io/npm/v/@ansvar/japan-fsa-guidance-mcp)](https://www.npmjs.com/package/@ansvar/japan-fsa-guidance-mcp)
[![License](https://img.shields.io/badge/license-BSL--1.1-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/japan-fsa-guidance-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/japan-fsa-guidance-mcp/actions/workflows/ci.yml)

Part of the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## Quick Start

### Remote (Hetzner)

Use the hosted endpoint — no installation needed:

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "japan-fsa-guidance": {
      "url": "https://mcp.ansvar.eu/jp/fsa-guidance/mcp"
    }
  }
}
```

**Cursor / VS Code** (`.cursor/mcp.json` or `.vscode/mcp.json`):
```json
{
  "servers": {
    "japan-fsa-guidance": {
      "url": "https://mcp.ansvar.eu/jp/fsa-guidance/mcp"
    }
  }
}
```

**Gateway (OAuth, multi-MCP):** `https://gateway.ansvar.eu`

### Local (npm)

Run entirely on your machine:

```bash
npx @ansvar/japan-fsa-guidance-mcp
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "japan-fsa-guidance": {
      "command": "npx",
      "args": ["-y", "@ansvar/japan-fsa-guidance-mcp"]
    }
  }
}
```

### Docker

```bash
docker pull ghcr.io/ansvar-systems/japan-fsa-guidance-mcp:latest
docker run -p 9203:9203 ghcr.io/ansvar-systems/japan-fsa-guidance-mcp:latest
# MCP endpoint: http://localhost:9203/mcp
# Health:       http://localhost:9203/health
```

The Docker image uses Streamable HTTP transport on port 9203 at `/mcp`.

## What's Included

| Source | Language | Portal | Items | Completeness |
|--------|----------|--------|-------|-------------|
| FSA Japan Laws & Guidelines catalog | ja | https://www.fsa.go.jp/common/law/ | 75 | Top-level catalogue (partial — section-level items stored at framework granularity) |
| FSA Japan Supervisory Guidelines & Inspection Manuals | en | https://www.fsa.go.jp/en/refer/guide/ | 14 | Subset of Japanese-only content; official English translations can lag JA releases by 1–6 months |

**Total: 118 indexed items (29 categories, 29 inspection records, 60 guideline documents) across 2 FSA portals.**

**Coverage domains:**

| Domain | Typical content |
|--------|-----------------|
| Comprehensive Supervisory Guidelines | Bank, insurance, and securities supervision frameworks |
| Cyber Security Guidelines 2024 | FSA cyber security framework for Japanese financial institutions |
| AML/CFT Guidelines | Anti-money laundering and counter-terrorism financing requirements |
| Inspection Manual | Credit risk, market risk, liquidity risk, operational risk, IT systems, customer protection |

Japanese is the primary authoritative language. English translations are official FSA translations but may lag behind Japanese versions.

## What's NOT Included

- Confidential FSA examination feedback or supervisory letters
- FSA enforcement actions, administrative sanctions, or business improvement orders
- Court decisions interpreting FSA regulations
- Bank of Japan payment regulations (different regulator)
- METI cybersecurity requirements for critical infrastructure (different regulator)
- Draft regulations and public consultation papers
- Regional FSA bureau guidance not centrally published
- Section-level inspection items (current ingest stores each framework as a single row — planned for 0.2.0)
- JA ↔ EN translation pairing (each URL is treated independently — planned for 0.2.0)

See [COVERAGE.md](COVERAGE.md) and [`data/coverage.json`](data/coverage.json) for full details.

## Installation

### npm (stdio transport)

```bash
npm install @ansvar/japan-fsa-guidance-mcp
```

### Docker (HTTP transport)

```bash
docker pull ghcr.io/ansvar-systems/japan-fsa-guidance-mcp:latest
docker run -p 9203:9203 ghcr.io/ansvar-systems/japan-fsa-guidance-mcp:latest
```

### Hosted

- Public MCP: https://mcp.ansvar.eu/jp/fsa-guidance/mcp
- Gateway (OAuth, multi-MCP): https://gateway.ansvar.eu

## Tools

All tools use the `jp_fsa_` prefix. Every response includes a `_meta` object with `disclaimer`, `data_age`, and `source_url`. Retrieval tools also return a `_citation` block with `canonical_ref`, `display_text`, and a machine-readable `lookup` instruction. Error responses include `_error_type` (`NO_MATCH` | `INVALID_INPUT`).

| Tool | Description |
|------|-------------|
| `jp_fsa_search_guidance` | Full-text search across FSA guidelines and inspection items (Japanese and English) |
| `jp_fsa_get_guideline` | Get a specific inspection item or guidance document by reference ID |
| `jp_fsa_search_inspections` | Search inspection manual items with optional category/domain filters (`fsa-sup-bank`, `fsa-sup-ins`, `fsa-sup-sec`, `fsa-cyber-2024`, `fsa-aml`) |
| `jp_fsa_list_categories` | List all FSA guidance categories with version and item counts |
| `jp_fsa_about` | Server metadata, version, and coverage summary |
| `jp_fsa_list_sources` | Data provenance: sources, retrieval method, licensing |
| `jp_fsa_check_data_freshness` | Per-source data age (Current / Due / OVERDUE) read at runtime from `data/coverage.json` |

See [TOOLS.md](TOOLS.md) for parameters, return formats, and examples.

## Example Queries

```
# Full-text search across all FSA guidance (Japanese query)
jp_fsa_search_guidance("サイバーセキュリティ")

# Same search, English query
jp_fsa_search_guidance("cyber security", limit=10)

# Inspection-manual items filtered by category
jp_fsa_search_inspections("risk management", category="fsa-sup-bank")

# Get a specific inspection item or guidance document by reference
jp_fsa_get_guideline("FSA-CYBER-2024-001")

# Check source freshness before trusting data for a compliance question
jp_fsa_check_data_freshness()
```

## Data Sources & Freshness

| Source | Language | Refresh | Last Verified | Verification |
|--------|----------|---------|---------------|--------------|
| FSA Japan Laws & Guidelines catalog (`fsa.go.jp/common/law/`) | ja | Monthly | See `data/coverage.json` | `page_scraped` |
| FSA Japan English guide portal (`fsa.go.jp/en/refer/guide/`) | en | Monthly | See `data/coverage.json` | `page_scraped` |

Check programmatically: call `jp_fsa_check_data_freshness`. Force a refresh manually:

```bash
gh workflow run ingest.yml \
  --repo Ansvar-Systems/japan-fsa-guidance-mcp \
  -f force=true
```

See [sources.yml](sources.yml) for full provenance details.

## Security

Every push is scanned by a multi-layer CI/CD pipeline:

| Workflow | Tool | Trigger |
|----------|------|---------|
| `ci.yml` | Build + TypeScript lint + Vitest + `npm audit` | Push/PR |
| `semgrep.yml` | Semgrep (security-audit, nodejs, typescript) | Push/PR + weekly |
| `trivy.yml` | Trivy filesystem scan (CRITICAL/HIGH) | Weekly + push to main |
| `scorecard.yml` | OpenSSF Scorecard | Weekly + push to main |
| `check-freshness.yml` | Source staleness alarm → auto-issue | Daily |
| `ingest.yml` | Automated monthly rebuild + commit | Monthly + manual |
| `ghcr-build.yml` | Multi-arch container image to GHCR | Push |

Vulnerability reports: see [SECURITY.md](SECURITY.md).

## Development

```bash
git clone https://github.com/Ansvar-Systems/japan-fsa-guidance-mcp.git
cd japan-fsa-guidance-mcp
npm install
npm run build        # compile TypeScript
npm test             # run Vitest
npm run dev          # HTTP dev server with hot reload (port 9203)
npm run seed         # generate sample database for local development
```

### Full ingestion (requires FSA portals to be accessible)

```bash
npm run ingest:full  # fetch → build:db → coverage:update
```

### Rebuild database from existing parsed data

```bash
npm run build:db
```

Branching: `feature/* → dev → main`. Direct pushes to `main` blocked by branch protection.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

## Authority

**Financial Services Agency of Japan (金融庁)**
https://www.fsa.go.jp/

The FSA is the Japanese government agency responsible for the supervision of banks, insurance companies, and securities firms, and for the promulgation of supervisory guidelines and inspection standards across the Japanese financial sector. Japanese is the authoritative regulatory language; English publications are official translations that may lag.

## License

BSL-1.1. See [LICENSE](LICENSE). Converts to Apache-2.0 on 2030-04-13.

## Disclaimer

This server provides informational reference data only. It does not constitute legal, regulatory, or professional advice. FSA guidelines are published in Japanese as the authoritative version; English translations may lag. Always verify against official FSA publications at https://www.fsa.go.jp/ before reliance for compliance, supervisory, or audit purposes.

See [DISCLAIMER.md](DISCLAIMER.md) for full terms.
