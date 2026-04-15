/**
 * Update data/coverage.json with current database statistics.
 *
 * Preserves hand-maintained schema fields (schema_version, mcp_type,
 * scope_statement, scope_exclusions, gaps, tools, per-source metadata,
 * completeness, bilingual_pair_matching_note, etc.) and only refreshes
 * the dynamic counts + timestamps. Runs safely on CI without
 * clobbering docs.
 *
 * Usage:
 *   npx tsx scripts/update-coverage.ts
 */

import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["FSA_JP_DB_PATH"] ?? "data/fsa-jp.db";
const COVERAGE_FILE = "data/coverage.json";

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

  // Bilingual breakdown
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

  const dbSizeMb = existsSync(DB_PATH)
    ? Math.round((statSync(DB_PATH).size / (1024 * 1024)) * 10) / 10
    : 0;

  const enItems = catEnOnly + gdEnOnly + catBoth + gdBoth;
  const jaItems = catJaOnly + gdJaOnly + catBoth + gdBoth;

  const existing: Record<string, unknown> = existsSync(COVERAGE_FILE)
    ? JSON.parse(readFileSync(COVERAGE_FILE, "utf8"))
    : {};

  // Per-source update: use source.id to decide which language count to apply.
  const sources =
    Array.isArray(existing["sources"]) && existing["sources"].length > 0
      ? (existing["sources"] as Record<string, unknown>[]).map((s) => {
          const id = s["id"];
          if (id === "fsa-jp-en") {
            return {
              ...s,
              item_count: enItems,
              expected_items:
                typeof s["expected_items"] === "number"
                  ? s["expected_items"]
                  : enItems,
            };
          }
          if (id === "fsa-jp-ja") {
            return {
              ...s,
              item_count: jaItems,
              expected_items:
                typeof s["expected_items"] === "number"
                  ? s["expected_items"]
                  : jaItems,
              last_fetched: s["last_fetched"] ?? latest?.date ?? null,
            };
          }
          return s;
        })
      : [];

  const existingSummary =
    (existing["summary"] as Record<string, unknown> | undefined) ?? {};
  const summary = {
    ...existingSummary,
    total_sources: sources.length,
    total_items: total,
    db_size_mb: dbSizeMb,
  };

  const coverage = {
    ...existing,
    sources,
    totals: { categories, inspections, guidelines, total },
    bilingual: {
      categories: { ja_only: catJaOnly, en_only: catEnOnly, both: catBoth },
      guidelines: { ja_only: gdJaOnly, en_only: gdEnOnly, both: gdBoth },
    },
    summary,
    generatedAt: nowIso,
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
  console.log(
    `  Schema fields preserved: scope_exclusions, gaps, tools, per-source metadata`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
