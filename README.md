# Japan FSA Financial Guidance MCP

MCP server for querying Financial Services Agency of Japan (金融庁) supervisory guidelines, cyber security guidelines, AML/CFT guidelines, and inspection manuals. Part of the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## What's Included

- **Comprehensive Supervisory Guidelines** — Bank, insurance, and securities supervision guidelines (~350 items per category)
- **Cyber Security Guidelines 2024** — FSA cyber security framework for Japanese financial institutions (~85 items)
- **AML/CFT Guidelines** — Anti-money laundering and counter-terrorism financing requirements (~120 items)
- **Inspection Manual** — FSA comprehensive inspection standards covering credit risk, market risk, IT systems, and customer protection

Japanese is the primary authoritative language. English translations are official FSA translations but may lag behind Japanese versions.

For full coverage details, see [COVERAGE.md](COVERAGE.md). For tool specifications, see [TOOLS.md](TOOLS.md).

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

## Usage

### stdio (Claude Desktop, Cursor, etc.)

Add to your MCP client configuration:

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

### HTTP (Streamable HTTP)

```bash
docker run -p 9203:9203 ghcr.io/ansvar-systems/japan-fsa-guidance-mcp:latest
# Server available at http://localhost:9203/mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `jp_fsa_search_guidance` | Full-text search across FSA guidelines and inspection items (Japanese and English) |
| `jp_fsa_get_guideline` | Get a specific inspection item or guidance document by reference ID |
| `jp_fsa_search_inspections` | Search inspection manual items with optional category/domain filters |
| `jp_fsa_list_categories` | List all FSA guidance categories with version and item counts |
| `jp_fsa_about` | Server metadata, version, and coverage summary |
| `jp_fsa_list_sources` | Data provenance: sources, retrieval method, licensing |

See [TOOLS.md](TOOLS.md) for parameters, return formats, and examples.

## Data Sources

All data is sourced from official FSA Japan public publications:

- [FSA English Guidance Portal](https://www.fsa.go.jp/en/refer/guide/) — English-language guidance and supervisory materials
- [FSA Japanese Law & Guidelines](https://www.fsa.go.jp/common/law/) — Primary Japanese-language source

See [sources.yml](sources.yml) for full provenance details.

## Development

```bash
git clone https://github.com/Ansvar-Systems/japan-fsa-guidance-mcp.git
cd japan-fsa-guidance-mcp
npm install
npm run seed        # Create sample database
npm run build       # Compile TypeScript
npm test            # Run tests
npm run dev         # Start HTTP dev server with hot reload
```

## Disclaimer

This server provides informational reference data only. It does not constitute legal or regulatory advice. Always verify against official FSA Japan publications. Japanese is the authoritative language. See [DISCLAIMER.md](DISCLAIMER.md) for full terms.

## License

[BSL-1.1](LICENSE) — Ansvar Systems AB. Converts to Apache-2.0 on 2030-04-13.
