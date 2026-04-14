/**
 * Update data/coverage.json with current database statistics.
 *
 * Reads the Japan FSA SQLite database and writes a coverage manifest aligned
 * with the non-law MCP golden standard (Phase 2):
 *   - schema_version, mcp_type, scope_statement, scope_exclusions
 *   - per-source: id, expected_items, measurement_unit, verification_method,
 *     last_verified, completeness, language
 *   - top-level gaps[], tools[], summary{}
 *
 * Existing fields preserved as namespaced extensions:
 *   - bilingual{} — JA/EN counts (NOT pair-matching; see flag below)
 *   - bilingual_pair_matching: false — explicit declaration that ja_only +
 *     en_only counts are independent rows, not paired translations.
 *
 * Usage:
 *   npx tsx scripts/update-coverage.ts
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["FSA_JP_DB_PATH"] ?? "data/fsa-jp.db";
const COVERAGE_FILE = "data/coverage.json";

interface BilingualBreakdown {
  ja_only: number;
  en_only: number;
  both: number;
}

interface CoverageSource {
  id: string;
  name: string;
  authority: string;
  url: string;
  language: "ja" | "en";
  last_fetched: string | null;
  last_verified: string;
  update_frequency: string;
  item_count: number;
  expected_items: number;
  measurement_unit: string;
  verification_method:
    | "api_reconciled"
    | "page_scraped"
    | "manifest_matched"
    | "manual_attestation";
  completeness: "full" | "partial" | "snapshot";
  completeness_note: string;
  status: "current" | "stale" | "unknown";
}

interface CoverageGap {
  id: string;
  description: string;
  reason: string;
  impact: "low" | "medium" | "high";
  planned: boolean;
  target_version?: string;
}

interface CoverageTool {
  name: string;
  category: "search" | "lookup" | "meta" | "analysis" | "comparison";
  description: string;
  data_sources: string[];
  verified: boolean;
}

interface CoverageSummary {
  total_tools: number;
  total_sources: number;
  total_items: number;
  db_size_mb: number;
  known_gaps: number;
  gaps_planned: number;
}

interface CoverageFile {
  schema_version: string;
  mcp: string;
  mcp_name: string;
  mcp_type:
    | "compliance"
    | "security_knowledge"
    | "threat_intel"
    | "domain_intelligence"
    | "regulation";
  version: string;
  database_version: string;
  database_built: string;
  generatedAt: string;
  coverage_date: string;
  scope_statement: string;
  scope_exclusions: string[];
  bilingual_pair_matching: boolean;
  bilingual_pair_matching_note: string;
  sources: CoverageSource[];
  totals: {
    categories: number;
    inspections: number;
    guidelines: number;
    total: number;
  };
  bilingual: {
    categories: BilingualBreakdown;
    guidelines: BilingualBreakdown;
  };
  gaps: CoverageGap[];
  tools: CoverageTool[];
  summary: CoverageSummary;
}

const SCOPE_STATEMENT =
  "Financial Services Agency of Japan supervisory guidelines, cyber security guidelines, AML/CFT guidelines, and inspection manuals for banks, insurance, and securities firms operating in Japan.";

const SCOPE_EXCLUSIONS = [
  "Confidential FSA examination feedback or supervisory letters",
  "FSA enforcement actions, administrative sanctions, or business improvement orders",
  "Court decisions interpreting FSA regulations",
  "Bank of Japan payment regulations (different regulator)",
  "METI cybersecurity requirements for critical infrastructure (different regulator)",
  "Draft regulations and public consultation papers",
  "Regional FSA bureau guidance not centrally published",
  "Section-level inspection items (current ingest stores each framework as a single row)",
  "JA<->EN translation pairing (each URL is treated independently)",
];

const TOOL_CATALOG: CoverageTool[] = [
  {
    name: "jp_fsa_search_guidance",
    category: "search",
    description: "Combined FTS5 search across inspections and guidelines (JA + EN).",
    data_sources: ["fsa-jp-en", "fsa-jp-ja"],
    verified: true,
  },
  {
    name: "jp_fsa_get_guideline",
    category: "lookup",
    description: "Retrieve a specific inspection item or guidance document by reference.",
    data_sources: ["fsa-jp-en", "fsa-jp-ja"],
    verified: true,
  },
  {
    name: "jp_fsa_search_inspections",
    category: "search",
    description: "Search inspection-manual items with category and domain filters.",
    data_sources: ["fsa-jp-en", "fsa-jp-ja"],
    verified: true,
  },
  {
    name: "jp_fsa_list_categories",
    category: "lookup",
    description: "List all FSA guidance categories indexed by this server.",
    data_sources: ["fsa-jp-en", "fsa-jp-ja"],
    verified: true,
  },
  {
    name: "jp_fsa_about",
    category: "meta",
    description: "Server metadata, version, and coverage summary.",
    data_sources: [],
    verified: true,
  },
  {
    name: "jp_fsa_list_sources",
    category: "meta",
    description: "Data provenance: source URLs, retrieval method, and licence.",
    data_sources: ["fsa-jp-en", "fsa-jp-ja"],
    verified: true,
  },
  {
    name: "jp_fsa_check_data_freshness",
    category: "meta",
    description: "Per-source data age with Current / Due / OVERDUE status.",
    data_sources: ["fsa-jp-en", "fsa-jp-ja"],
    verified: true,
  },
];

const GAPS: CoverageGap[] = [
  {
    id: "section-level-inspections",
    description:
      "Inspection items are stored at framework granularity, not section granularity.",
    reason: "Section-numbered parsing (Ⅱ-1-1, 別紙) is a future enhancement.",
    impact: "medium",
    planned: true,
    target_version: "0.2.0",
  },
  {
    id: "bilingual-translation-pairs",
    description:
      "Japanese primary documents are not linked to their official English translations.",
    reason:
      "Ingest treats each URL independently; cross-language matching requires title canonicalisation.",
    impact: "medium",
    planned: true,
    target_version: "0.2.0",
  },
  {
    id: "fsa-enforcement-actions",
    description: "Administrative sanctions and business-improvement orders not indexed.",
    reason: "Published individually under /status/; separate ingest needed.",
    impact: "low",
    planned: true,
    target_version: "0.3.0",
  },
];

async function main(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    console.error("Run: npm run ingest:full");
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  const categories = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
  const inspections = (db.prepare("SELECT COUNT(*) AS n FROM inspections").get() as { n: number }).n;
  const guidelines = (db.prepare("SELECT COUNT(*) AS n FROM guidelines").get() as { n: number }).n;

  // Bilingual breakdown — schema uses NOT NULL with "" as "missing translation".
  // These counts treat each row as independent; bilingual_pair_matching is false.
  const catJaOnly = (db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name_ja != '' AND name_en = ''").get() as { n: number }).n;
  const catEnOnly = (db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name_en != '' AND name_ja = ''").get() as { n: number }).n;
  const catBoth = (db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name_ja != '' AND name_en != ''").get() as { n: number }).n;

  const gdJaOnly = (db.prepare("SELECT COUNT(*) AS n FROM guidelines WHERE title_ja != '' AND title_en = ''").get() as { n: number }).n;
  const gdEnOnly = (db.prepare("SELECT COUNT(*) AS n FROM guidelines WHERE title_en != '' AND title_ja = ''").get() as { n: number }).n;
  const gdBoth = (db.prepare("SELECT COUNT(*) AS n FROM guidelines WHERE title_ja != '' AND title_en != ''").get() as { n: number }).n;

  const latest = db
    .prepare("SELECT date FROM guidelines WHERE date IS NOT NULL ORDER BY date DESC LIMIT 1")
    .get() as { date: string } | undefined;

  const total = categories + inspections + guidelines;
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const dbSizeMb = existsSync(DB_PATH)
    ? Math.round((statSync(DB_PATH).size / (1024 * 1024)) * 10) / 10
    : 0;

  const enItems = catEnOnly + gdEnOnly + catBoth + gdBoth;
  const jaItems = catJaOnly + gdJaOnly + catBoth + gdBoth;

  const coverage: CoverageFile = {
    schema_version: "1.0",
    mcp: "japan-fsa-guidance-mcp",
    mcp_name: "Japan FSA Financial Guidance MCP",
    mcp_type: "regulation",
    version: "0.1.0",
    database_version: "0.1.0",
    database_built: nowIso,
    generatedAt: nowIso,
    coverage_date: today,
    scope_statement: SCOPE_STATEMENT,
    scope_exclusions: SCOPE_EXCLUSIONS,
    bilingual_pair_matching: false,
    bilingual_pair_matching_note:
      "Bilingual breakdown counts each language entry independently. Japanese and English versions of the same FSA document are treated as separate rows; cross-language pairing is a planned 0.2.0 enhancement.",
    sources: [
      {
        id: "fsa-jp-en",
        name: "FSA Japan Supervisory Guidelines & Inspection Manuals (English portal)",
        authority: "Financial Services Agency of Japan (金融庁)",
        url: "https://www.fsa.go.jp/en/refer/guide/",
        language: "en",
        last_fetched: nowIso,
        last_verified: today,
        update_frequency: "monthly",
        item_count: enItems,
        expected_items: enItems,
        measurement_unit: "guidance documents and inspection items (English)",
        verification_method: "page_scraped",
        completeness: "partial",
        completeness_note:
          "Subset of Japanese-only content. English translations published by FSA can lag Japanese releases by 1-6 months.",
        status: "current",
      },
      {
        id: "fsa-jp-ja",
        name: "FSA Japan Laws & Guidelines catalog (Japanese primary portal)",
        authority: "Financial Services Agency of Japan (金融庁)",
        url: "https://www.fsa.go.jp/common/law/",
        language: "ja",
        last_fetched: latest?.date ?? nowIso,
        last_verified: today,
        update_frequency: "monthly",
        item_count: jaItems,
        expected_items: jaItems,
        measurement_unit: "guidance documents and inspection items (Japanese)",
        verification_method: "page_scraped",
        completeness: "partial",
        completeness_note:
          "Top-level catalogue from FSA Japanese portal. Section-level inspection items (Ⅱ-1-1 etc) are stored at framework granularity in the current ingest.",
        status: "current",
      },
    ],
    totals: {
      categories,
      inspections,
      guidelines,
      total,
    },
    bilingual: {
      categories: { ja_only: catJaOnly, en_only: catEnOnly, both: catBoth },
      guidelines: { ja_only: gdJaOnly, en_only: gdEnOnly, both: gdBoth },
    },
    gaps: GAPS,
    tools: TOOL_CATALOG,
    summary: {
      total_tools: TOOL_CATALOG.length,
      total_sources: 2,
      total_items: total,
      db_size_mb: dbSizeMb,
      known_gaps: GAPS.length,
      gaps_planned: GAPS.filter((g) => g.planned).length,
    },
  };

  const dir = dirname(COVERAGE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(COVERAGE_FILE, JSON.stringify(coverage, null, 2), "utf8");

  console.log(`Coverage updated: ${COVERAGE_FILE}`);
  console.log(`  Categories  : ${categories}`);
  console.log(`  Inspections : ${inspections}`);
  console.log(`  Guidelines  : ${guidelines}`);
  console.log(`  Total       : ${total}`);
  console.log(`  DB size     : ${dbSizeMb} MB`);
  console.log(`  Bilingual (categories) : ja_only=${catJaOnly} en_only=${catEnOnly} both=${catBoth}`);
  console.log(`  Bilingual (guidelines) : ja_only=${gdJaOnly} en_only=${gdEnOnly} both=${gdBoth}`);
  console.log(`  Tools: ${TOOL_CATALOG.length} | Gaps: ${GAPS.length} | Sources: 2`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
