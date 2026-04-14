/**
 * Build the FSA Japan SQLite database from fetched raw data.
 *
 * Reads .meta.json files from data/raw/, parses the extracted text,
 * and inserts categories, inspection items, and guidance documents into the database.
 *
 * Usage:
 *   npx tsx scripts/build-db.ts
 *   npx tsx scripts/build-db.ts --force   # drop and rebuild database
 *   npx tsx scripts/build-db.ts --dry-run # log what would be inserted
 */

import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DB_PATH = process.env["FSA_JP_DB_PATH"] ?? "data/fsa-jp.db";
const RAW_DIR = "data/raw";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FetchedDocument {
  title: string;
  url: string;
  category: string;
  filename: string;
  text: string;
  fetchedAt: string;
}

interface CategoryRow {
  id: string;
  name_ja: string;
  name_en: string;
  version: string | null;
  domain: string;
  description: string;
  item_count: number;
  effective_date: string | null;
  source_url: string;
}

interface InspectionRow {
  category_id: string;
  item_ref: string;
  domain: string;
  subdomain: string;
  title_ja: string;
  title_en: string;
  description: string;
  standard_level: string;
  priority: string;
}

interface GuidelineRow {
  reference: string;
  title_ja: string;
  title_en: string;
  date: string | null;
  category: string;
  summary: string;
  full_text: string;
  source_url: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Document classification
// ---------------------------------------------------------------------------

function classifyDocument(doc: FetchedDocument): "framework" | "circular" | "unknown" {
  const titleLower = doc.title.toLowerCase();
  if (
    titleLower.includes("framework") ||
    titleLower.includes("standard") ||
    titleLower.includes("guideline")
  ) {
    return "framework";
  }
  if (
    titleLower.includes("circular") ||
    titleLower.includes("regulation") ||
    titleLower.includes("requirement")
  ) {
    return "circular";
  }
  // Default: treat longer framework documents as frameworks, shorter as circulars
  return doc.text.length > 50_000 ? "framework" : "circular";
}

function inferCategoryId(doc: FetchedDocument): string {
  const fn = doc.filename.toLowerCase();
  if (fn.includes("cyber")) return "fsa-cyber-2024";
  if (fn.includes("aml") || fn.includes("money")) return "fsa-aml";
  if (fn.includes("ins") || fn.includes("insurance")) return "fsa-sup-ins";
  if (fn.includes("sec") || fn.includes("securities")) return "fsa-sup-sec";
  return `fsa-sup-bank`;
}

function inferGuidelineReference(doc: FetchedDocument): string {
  // Try to extract an FSA reference from the text
  const refMatch = doc.text.match(/FSA[/-][A-Z]{2,6}[-/]\d{4}[-/][A-Z]{2,5}[-/]\d{3}/i);
  if (refMatch) return refMatch[0]!.toUpperCase();

  // Fall back to a reference derived from the filename and date
  const year = new Date().getFullYear();
  const base = doc.filename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9]/g, "-").substring(0, 30);
  return `FSA-GD-${year}-${doc.category.substring(0, 3).toUpperCase()}-${base}`;
}

function extractDate(text: string): string | null {
  // Look for dates in common SAMA document formats
  const patterns = [
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2] && /[a-z]/i.test(match[2])) {
        const months: Record<string, string> = {
          january: "01", february: "02", march: "03", april: "04",
          may: "05", june: "06", july: "07", august: "08",
          september: "09", october: "10", november: "11", december: "12",
        };
        const month = months[match[2]!.toLowerCase()] ?? "01";
        return `${match[3]}-${month}-${match[1]!.padStart(2, "0")}`;
      }
      return match[0]!;
    }
  }
  return null;
}

function buildSummary(text: string, maxLen = 500): string {
  // Extract first meaningful paragraph as summary
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 50);
  const firstParagraph = lines[0] ?? "";
  return firstParagraph.length > maxLen
    ? firstParagraph.substring(0, maxLen) + "..."
    : firstParagraph;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    console.error(`Raw data directory not found: ${RAW_DIR}`);
    console.error("Run: npm run ingest:fetch");
    // Note: ingest-fetch.ts targets fsa.go.jp endpoints.
    process.exit(1);
  }

  // Collect all .meta.json files
  const metaFiles = readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".meta.json"))
    .sort();

  if (metaFiles.length === 0) {
    console.warn("No .meta.json files found. Run: npm run ingest:fetch");
    return;
  }

  console.log(`Found ${metaFiles.length} fetched documents`);

  if (dryRun) {
    for (const f of metaFiles) {
      const doc: FetchedDocument = JSON.parse(readFileSync(join(RAW_DIR, f), "utf8"));
      const type = classifyDocument(doc);
      console.log(`  [${type}] ${doc.title} (${doc.text.length.toLocaleString()} chars)`);
    }
    return;
  }

  // Set up database
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (force && existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    console.log(`Deleted ${DB_PATH}`);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = DELETE"); // Use DELETE mode for build script (faster for bulk inserts)
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (id, name_ja, name_en, version, domain, description, item_count, effective_date, source_url) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertInspection = db.prepare(
    "INSERT OR IGNORE INTO inspections " +
      "(category_id, item_ref, domain, subdomain, title_ja, title_en, description, standard_level, priority) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertGuideline = db.prepare(
    "INSERT OR IGNORE INTO guidelines (reference, title_ja, title_en, date, category, summary, full_text, source_url, status) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  let categoriesInserted = 0;
  let inspectionsInserted = 0;
  let guidelinesInserted = 0;

  for (const metaFile of metaFiles) {
    const doc: FetchedDocument = JSON.parse(readFileSync(join(RAW_DIR, metaFile), "utf8"));
    const type = classifyDocument(doc);
    console.log(`Processing [${type}]: ${doc.title}`);

    if (type === "framework") {
      // Treat FSA guidance frameworks (supervisory guidelines, inspection manuals) as categories
      const categoryId = inferCategoryId(doc);
      const result = insertCategory.run(
        categoryId,
        doc.title, // title_ja — populated with English title during build; real ingest populates both
        doc.title, // title_en
        null,
        doc.category,
        buildSummary(doc.text, 1000),
        0,
        extractDate(doc.text),
        doc.url,
      );
      if (result.changes > 0) categoriesInserted++;

      // For a real implementation, parse the HTML/PDF text to extract individual inspection items.
      // FSA documents use numbered section schemes (e.g., "Ⅱ-1-1", "別紙").
      // Here we insert one placeholder inspection item per document to demonstrate the flow.
      const inspectionResult = insertInspection.run(
        categoryId,
        `${categoryId.toUpperCase()}-AUTO-1`,
        doc.category,
        "General",
        doc.title, // title_ja
        `${doc.title} — General Requirements`, // title_en
        doc.text.substring(0, 2000) || "See full document for requirements.",
        "Required",
        "High",
      );
      if (inspectionResult.changes > 0) inspectionsInserted++;
    } else if (type === "circular") {
      const reference = inferGuidelineReference(doc);
      const result = insertGuideline.run(
        reference,
        doc.title, // title_ja
        doc.title, // title_en
        extractDate(doc.text),
        doc.category,
        buildSummary(doc.text),
        doc.text || `See full document at: ${doc.url}`,
        doc.url,
        "active",
      );
      if (result.changes > 0) guidelinesInserted++;
    }
  }

  // Switch to WAL for production use
  db.pragma("journal_mode = WAL");
  db.pragma("vacuum");

  console.log(`
Build complete:
  Categories  : ${categoriesInserted} inserted
  Inspections : ${inspectionsInserted} inserted
  Guidelines  : ${guidelinesInserted} inserted

Database: ${DB_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
