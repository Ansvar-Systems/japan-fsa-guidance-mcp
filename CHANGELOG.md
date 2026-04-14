# Changelog

All notable changes to the Japan FSA Financial Guidance MCP are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `jp_fsa_check_data_freshness` mandatory meta-tool reporting per-source data age.
- `_error_type` (`NO_MATCH` / `INVALID_INPUT`) on every error response, with `_meta` attached.
- Enriched `_citation` block on `jp_fsa_get_guideline` with `aliases`, `source_url`, and re-callable `lookup` arguments.
- Smoke test suite (`tests/db.test.ts`) — 9 tests covering row counts, FTS5 search in Japanese and English, and not-found handling.
- `data/coverage.json` schema extended to non-law golden standard: `scope_statement`, `scope_exclusions`, per-source `expected_items` / `measurement_unit` / `verification_method` / `last_verified`, top-level `gaps[]`, `tools[]`, `summary{}`.
- `bilingual_pair_matching: false` flag in coverage.json making explicit that JA + EN bilingual counts are independent rows, not paired translations.
- `.dockerignore` to slim docker build context.
- Governance docs: `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CODEOWNERS`, `REGISTRY.md`.

### Changed
- `_meta.data_age` now reads `database_built` / `generatedAt` from `data/coverage.json` at startup instead of a hardcoded literal.
- Both stdio (`src/index.ts`) and HTTP (`src/http-server.ts`) entry points now share `src/response-meta.ts` and `src/freshness.ts` so payloads are byte-identical across transports.
- `.gitignore` ignores `data/*.db-shm` and `data/*.db-wal` sidecars produced by WAL journal mode.

## [0.1.0] - 2026-04-14

### Added
- Initial release. Multi-stage Dockerfile, GHCR build, sources.yml, and bilingual (EN + JA) ingest from `fsa.go.jp`.
- Six tools: `jp_fsa_search_guidance`, `jp_fsa_get_guideline`, `jp_fsa_search_inspections`, `jp_fsa_list_categories`, `jp_fsa_about`, `jp_fsa_list_sources`.
- 118 rows ingested (29 categories + 29 inspections + 60 guidelines) across English and Japanese FSA portals.
