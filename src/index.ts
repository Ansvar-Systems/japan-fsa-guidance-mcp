#!/usr/bin/env node

/**
 * Japan FSA Financial Guidance MCP — stdio entry point.
 *
 * Provides MCP tools for querying Financial Services Agency of Japan (金融庁)
 * supervisory guidelines, cyber security guidelines, AML/CFT guidelines,
 * and inspection manuals.
 *
 * Tool prefix: jp_fsa_
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  searchGuidance,
  searchInspections,
  getInspection,
  getGuideline,
  listCategories,
  getStats,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pkgVersion = "0.1.0";
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  ) as { version: string };
  pkgVersion = pkg.version;
} catch {
  // fallback
}

let sourcesYml = "";
try {
  sourcesYml = readFileSync(join(__dirname, "..", "sources.yml"), "utf8");
} catch {
  // fallback
}

const SERVER_NAME = "japan-fsa-guidance-mcp";

const DISCLAIMER =
  "This data is provided for informational reference only. It does not constitute legal or professional advice. " +
  "Always verify against official FSA Japan publications at https://www.fsa.go.jp/. " +
  "Japanese is the primary authoritative language; English translations are official FSA translations but may lag behind Japanese versions.";

const SOURCE_URL = "https://www.fsa.go.jp/en/refer/guide/";

// --- Tool definitions ---------------------------------------------------------

const TOOLS = [
  {
    name: "jp_fsa_search_guidance",
    description:
      "Full-text search across FSA Japan supervisory guidelines, inspection items, and guidance documents. " +
      "Covers the Comprehensive Guidelines for Supervision of Major Banks, Cyber Security Guidelines 2024, " +
      "AML/CFT Guidelines, and Comprehensive Inspection Manual for Japanese financial institutions. " +
      "Supports queries in both Japanese and English. Returns matching items with reference, title, domain, and summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query in Japanese or English (e.g., 'サイバーセキュリティ', 'cyber security', 'AML/CFT', 'bank supervision')",
        },
        domain: {
          type: "string",
          description:
            "Filter by domain or category (e.g., 'Supervisory Guidelines', 'Cyber Security', 'AML/CFT', 'Risk Management'). Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 10, max 50.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "jp_fsa_get_guideline",
    description:
      "Get a specific FSA Japan guidance document or inspection item by its reference identifier. " +
      "For inspection items use the item reference (e.g., 'FSA-CYBER-2024-001', 'FSA-SUP-BANK-1.1'). " +
      "For guidance documents use the document reference number (e.g., 'FSA-GD-2024-AML-001').",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "Inspection item reference or guidance document reference number",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "jp_fsa_search_inspections",
    description:
      "Search FSA Japan inspection manual items specifically. Covers all inspection standards across the " +
      "Comprehensive Inspection Manual domains: bank management, credit risk, market risk, liquidity risk, " +
      "operational risk, IT systems, AML/CFT, and customer protection. " +
      "Returns inspection items with their standard level and implementation requirements.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query in Japanese or English (e.g., 'リスク管理', 'risk management', " +
            "'マネーロンダリング', 'outsourcing')",
        },
        category: {
          type: "string",
          enum: ["fsa-sup-bank", "fsa-sup-ins", "fsa-sup-sec", "fsa-cyber-2024", "fsa-aml"],
          description:
            "Filter by category ID. fsa-sup-bank=Bank Supervision, fsa-sup-ins=Insurance Supervision, " +
            "fsa-sup-sec=Securities Supervision, fsa-cyber-2024=Cyber Security Guidelines 2024, " +
            "fsa-aml=AML/CFT Guidelines. Optional.",
        },
        domain: {
          type: "string",
          description:
            "Filter by inspection domain (e.g., 'Credit Risk Management', 'IT Systems', 'AML/CFT'). Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 10, max 50.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "jp_fsa_list_categories",
    description:
      "List all FSA Japan guidance categories covered by this server, including version, " +
      "effective date, item count, and coverage domain. " +
      "Use this to understand what regulatory material is available before searching.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "jp_fsa_about",
    description:
      "Return metadata about this MCP server: version, data sources, coverage summary, " +
      "and list of available tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "jp_fsa_list_sources",
    description:
      "Return data provenance information: which FSA Japan sources are indexed, " +
      "how data is retrieved, update frequency, and licensing terms.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// --- Zod schemas --------------------------------------------------------------

const SearchGuidanceArgs = z.object({
  query: z.string().min(1),
  domain: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const GetGuidelineArgs = z.object({
  document_id: z.string().min(1),
});

const SearchInspectionsArgs = z.object({
  query: z.string().min(1),
  category: z.enum(["fsa-sup-bank", "fsa-sup-ins", "fsa-sup-sec", "fsa-cyber-2024", "fsa-aml"]).optional(),
  domain: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});

// --- Helpers ------------------------------------------------------------------

function textContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorContent(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

function buildMeta(sourceUrl?: string): Record<string, unknown> {
  return {
    disclaimer: DISCLAIMER,
    data_age: "See coverage.json; refresh frequency: monthly",
    source_url: sourceUrl ?? SOURCE_URL,
  };
}

// --- Server -------------------------------------------------------------------

const server = new Server(
  { name: SERVER_NAME, version: pkgVersion },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "jp_fsa_search_guidance": {
        const parsed = SearchGuidanceArgs.parse(args);
        const results = searchGuidance({
          query: parsed.query,
          domain: parsed.domain,
          limit: parsed.limit ?? 10,
        });
        return textContent({
          results,
          count: results.length,
          _meta: buildMeta(),
        });
      }

      case "jp_fsa_get_guideline": {
        const parsed = GetGuidelineArgs.parse(args);
        const docId = parsed.document_id;

        // Try inspection item first
        const inspection = getInspection(docId);
        if (inspection) {
          return textContent({
            ...inspection,
            _citation: {
              canonical_ref: inspection.item_ref,
              display_text: `FSA Japan — ${inspection.title_en} (${inspection.item_ref})`,
            },
            _meta: buildMeta(),
          });
        }

        // Try guidance document
        const guideline = getGuideline(docId);
        if (guideline) {
          return textContent({
            ...guideline,
            _citation: {
              canonical_ref: guideline.reference,
              display_text: `FSA Japan — ${guideline.title_en} (${guideline.reference})`,
            },
            _meta: buildMeta(guideline.source_url ?? SOURCE_URL),
          });
        }

        return errorContent(
          `No inspection item or guidance document found with reference: ${docId}. ` +
            "Use jp_fsa_search_guidance to find available references.",
        );
      }

      case "jp_fsa_search_inspections": {
        const parsed = SearchInspectionsArgs.parse(args);
        const results = searchInspections({
          query: parsed.query,
          category: parsed.category,
          domain: parsed.domain,
          limit: parsed.limit ?? 10,
        });
        return textContent({
          results,
          count: results.length,
          _meta: buildMeta(),
        });
      }

      case "jp_fsa_list_categories": {
        const categories = listCategories();
        return textContent({
          categories,
          count: categories.length,
          _meta: buildMeta(),
        });
      }

      case "jp_fsa_about": {
        const stats = getStats();
        return textContent({
          name: SERVER_NAME,
          version: pkgVersion,
          description:
            "Financial Services Agency of Japan (金融庁) Financial Guidance MCP server. " +
            "Provides structured access to FSA Japan supervisory guidelines, cyber security guidelines, " +
            "AML/CFT guidelines, and inspection manuals for banks, insurance companies, and securities firms.",
          data_source: "Financial Services Agency of Japan (金融庁)",
          source_url: SOURCE_URL,
          coverage: {
            categories: `${stats.categories} FSA guidance categories`,
            inspections: `${stats.inspections} inspection manual items`,
            guidelines: `${stats.guidelines} guidance documents`,
            jurisdictions: ["JP"],
            sectors: ["Banking", "Insurance", "Securities", "Fintech"],
            languages: ["ja", "en"],
          },
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
          _meta: buildMeta(),
        });
      }

      case "jp_fsa_list_sources": {
        return textContent({
          sources_yml: sourcesYml,
          note: "Data is sourced from official FSA Japan public publications. Japanese is the primary authoritative language. See sources.yml for full provenance.",
          _meta: buildMeta(),
        });
      }

      default:
        return errorContent(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return errorContent(
      `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});

// --- Start --------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_NAME} v${pkgVersion} running on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
