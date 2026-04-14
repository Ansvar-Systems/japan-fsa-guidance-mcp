/**
 * Update data/coverage.json with current database statistics.
 *
 * Reads the Japan FSA SQLite database and writes a coverage summary file
 * used by the freshness checker and the fleet manifest.
 *
 * Usage:
 *   npx tsx scripts/update-coverage.ts
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["FSA_JP_DB_PATH"] ?? "data/fsa-jp.db";
const COVERAGE_FILE = "data/coverage.json";

interface BilingualBreakdown {
  ja_only: number;
  en_only: number;
  both: number;
}

interface CoverageSource {
  name: string;
  url: string;
  last_fetched: string | null;
  update_frequency: string;
  item_count: number;
  status: "current" | "stale" | "unknown";
}

interface CoverageFile {
  generatedAt: string;
  mcp: string;
  version: string;
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
}

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

  // Bilingual breakdown — schema uses NOT NULL with "" as "missing translation"
  const catJaOnly = (db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name_ja != '' AND name_en = ''").get() as { n: number }).n;
  const catEnOnly = (db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name_en != '' AND name_ja = ''").get() as { n: number }).n;
  const catBoth = (db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name_ja != '' AND name_en != ''").get() as { n: number }).n;

  const gdJaOnly = (db.prepare("SELECT COUNT(*) AS n FROM guidelines WHERE title_ja != '' AND title_en = ''").get() as { n: number }).n;
  const gdEnOnly = (db.prepare("SELECT COUNT(*) AS n FROM guidelines WHERE title_en != '' AND title_ja = ''").get() as { n: number }).n;
  const gdBoth = (db.prepare("SELECT COUNT(*) AS n FROM guidelines WHERE title_ja != '' AND title_en != ''").get() as { n: number }).n;

  // Get latest date for freshness heuristic
  const latest = db
    .prepare("SELECT date FROM guidelines WHERE date IS NOT NULL ORDER BY date DESC LIMIT 1")
    .get() as { date: string } | undefined;

  const total = categories + inspections + guidelines;

  const coverage: CoverageFile = {
    generatedAt: new Date().toISOString(),
    mcp: "japan-fsa-guidance-mcp",
    version: "0.1.0",
    sources: [
      {
        name: "FSA Japan Supervisory Guidelines & Inspection Manuals (English portal)",
        url: "https://www.fsa.go.jp/en/refer/guide/",
        last_fetched: new Date().toISOString(),
        update_frequency: "monthly",
        item_count: catEnOnly + gdEnOnly + catBoth + gdBoth,
        status: "current",
      },
      {
        name: "FSA Japan Laws & Guidelines catalog (Japanese primary portal)",
        url: "https://www.fsa.go.jp/common/law/",
        last_fetched: latest?.date ?? new Date().toISOString(),
        update_frequency: "monthly",
        item_count: catJaOnly + gdJaOnly + catBoth + gdBoth,
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
  };

  const dir = dirname(COVERAGE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(COVERAGE_FILE, JSON.stringify(coverage, null, 2), "utf8");

  console.log(`Coverage updated: ${COVERAGE_FILE}`);
  console.log(`  Categories  : ${categories}`);
  console.log(`  Inspections : ${inspections}`);
  console.log(`  Guidelines  : ${guidelines}`);
  console.log(`  Total       : ${total}`);
  console.log(`  Bilingual (categories) : ja_only=${catJaOnly} en_only=${catEnOnly} both=${catBoth}`);
  console.log(`  Bilingual (guidelines) : ja_only=${gdJaOnly} en_only=${gdEnOnly} both=${gdBoth}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
