# Contributing

Thank you for your interest in the Japan FSA Financial Guidance MCP. This server is part of the [Ansvar MCP Network](https://ansvar.ai/mcp).

## Branching

This repo follows the standard Ansvar MCP branching pattern:

```
feature-branch -> PR to dev -> verify on dev -> PR to main -> deploy
```

- Never push directly to `main` or `dev`.
- All changes go through pull request review.
- The `main` branch triggers npm publish, GHCR image build, and Watchtower auto-update on the Hetzner fleet.

## Local development

```bash
git clone https://github.com/Ansvar-Systems/japan-fsa-guidance-mcp.git
cd japan-fsa-guidance-mcp
npm install
npm run build
npm test
npm run dev    # HTTP transport on port 9203
```

## Verification gates

Before opening a PR to `main`, every change must pass:

1. `npm run build` (TypeScript compile)
2. `npm run lint` (`tsc --noEmit`)
3. `npm test` (vitest smoke tests)
4. `npm run freshness:check` (data is current)

See [docs/mcp-pre-deploy-verification.md](https://github.com/Ansvar-Systems/Ansvar-Architecture-Documentation/blob/main/docs/mcp-pre-deploy-verification.md) in the architecture docs repo for the full pre-deploy protocol.

## Adding new sources

Edit `sources.yml`, then update the corresponding source block in `scripts/update-coverage.ts` so coverage tracking stays accurate. After ingest, regenerate the coverage manifest:

```bash
npm run ingest:full
```

## Reporting issues

Use [GitHub Issues](https://github.com/Ansvar-Systems/japan-fsa-guidance-mcp/issues) for bugs, data-quality reports, or feature requests.

For security vulnerabilities, see [SECURITY.md](SECURITY.md) — do not open a public issue.

## Code style

- TypeScript strict mode (`tsconfig.json` enables `strict: true`).
- 2-space indentation.
- `npm run lint` (`tsc --noEmit`) must exit 0.
- No banned anti-slop terms in user-facing text — see [ADR-009](https://github.com/Ansvar-Systems/Ansvar-Architecture-Documentation/blob/main/docs/adr/ADR-009-anti-slop-standard.md).

## Code of conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
