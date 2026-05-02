/**
 * SQLite database access layer for the Japan FSA Financial Guidance MCP server.
 *
 * Schema:
 *   - categories  — FSA guidance categories (Supervisory Guidelines, Cyber Security, etc.)
 *   - inspections — Individual inspection items and standards within each category
 *   - guidelines  — FSA guidance documents, circulars, and inspection manuals
 *
 * FTS5 virtual tables back full-text search on inspections and guidelines.
 * Both title_ja (Japanese) and title_en (English) columns are indexed in FTS5.
 */

import Database from "better-sqlite3";
const DB_PATH = process.env["FSA_JP_DB_PATH"] ?? "data/fsa-jp.db";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id              TEXT    PRIMARY KEY,
  name_ja         TEXT    NOT NULL,
  name_en         TEXT    NOT NULL,
  version         TEXT,
  domain          TEXT,
  description     TEXT,
  item_count      INTEGER DEFAULT 0,
  effective_date  TEXT,
  source_url      TEXT
);

CREATE INDEX IF NOT EXISTS idx_categories_domain ON categories(domain);

CREATE TABLE IF NOT EXISTS inspections (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    TEXT    NOT NULL REFERENCES categories(id),
  item_ref       TEXT    NOT NULL UNIQUE,
  domain         TEXT    NOT NULL,
  subdomain      TEXT,
  title_ja       TEXT    NOT NULL,
  title_en       TEXT    NOT NULL,
  description    TEXT    NOT NULL,
  standard_level TEXT,
  priority       TEXT
);

CREATE INDEX IF NOT EXISTS idx_inspections_category   ON inspections(category_id);
CREATE INDEX IF NOT EXISTS idx_inspections_domain     ON inspections(domain);
CREATE INDEX IF NOT EXISTS idx_inspections_level      ON inspections(standard_level);
CREATE INDEX IF NOT EXISTS idx_inspections_priority   ON inspections(priority);

CREATE VIRTUAL TABLE IF NOT EXISTS inspections_fts USING fts5(
  item_ref, domain, subdomain, title_ja, title_en, description,
  content='inspections',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS inspections_ai AFTER INSERT ON inspections BEGIN
  INSERT INTO inspections_fts(rowid, item_ref, domain, subdomain, title_ja, title_en, description)
  VALUES (new.id, new.item_ref, new.domain, COALESCE(new.subdomain, ''), new.title_ja, new.title_en, new.description);
END;

CREATE TRIGGER IF NOT EXISTS inspections_ad AFTER DELETE ON inspections BEGIN
  INSERT INTO inspections_fts(inspections_fts, rowid, item_ref, domain, subdomain, title_ja, title_en, description)
  VALUES ('delete', old.id, old.item_ref, old.domain, COALESCE(old.subdomain, ''), old.title_ja, old.title_en, old.description);
END;

CREATE TRIGGER IF NOT EXISTS inspections_au AFTER UPDATE ON inspections BEGIN
  INSERT INTO inspections_fts(inspections_fts, rowid, item_ref, domain, subdomain, title_ja, title_en, description)
  VALUES ('delete', old.id, old.item_ref, old.domain, COALESCE(old.subdomain, ''), old.title_ja, old.title_en, old.description);
  INSERT INTO inspections_fts(rowid, item_ref, domain, subdomain, title_ja, title_en, description)
  VALUES (new.id, new.item_ref, new.domain, COALESCE(new.subdomain, ''), new.title_ja, new.title_en, new.description);
END;

CREATE TABLE IF NOT EXISTS guidelines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reference  TEXT    NOT NULL UNIQUE,
  title_ja   TEXT    NOT NULL,
  title_en   TEXT    NOT NULL,
  title      TEXT    NOT NULL GENERATED ALWAYS AS (COALESCE(title_en, title_ja)) VIRTUAL,
  date       TEXT,
  category   TEXT,
  summary    TEXT,
  full_text  TEXT    NOT NULL,
  source_url TEXT,
  status     TEXT    DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_guidelines_date     ON guidelines(date);
CREATE INDEX IF NOT EXISTS idx_guidelines_category ON guidelines(category);
CREATE INDEX IF NOT EXISTS idx_guidelines_status   ON guidelines(status);

CREATE VIRTUAL TABLE IF NOT EXISTS guidelines_fts USING fts5(
  reference, title_ja, title_en, category, summary, full_text,
  content='guidelines',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS guidelines_ai AFTER INSERT ON guidelines BEGIN
  INSERT INTO guidelines_fts(rowid, reference, title_ja, title_en, category, summary, full_text)
  VALUES (new.id, new.reference, new.title_ja, new.title_en, COALESCE(new.category, ''), COALESCE(new.summary, ''), new.full_text);
END;

CREATE TRIGGER IF NOT EXISTS guidelines_ad AFTER DELETE ON guidelines BEGIN
  INSERT INTO guidelines_fts(guidelines_fts, rowid, reference, title_ja, title_en, category, summary, full_text)
  VALUES ('delete', old.id, old.reference, old.title_ja, old.title_en, COALESCE(old.category, ''), COALESCE(old.summary, ''), old.full_text);
END;

CREATE TRIGGER IF NOT EXISTS guidelines_au AFTER UPDATE ON guidelines BEGIN
  INSERT INTO guidelines_fts(guidelines_fts, rowid, reference, title_ja, title_en, category, summary, full_text)
  VALUES ('delete', old.id, old.reference, old.title_ja, old.title_en, COALESCE(old.category, ''), COALESCE(old.summary, ''), old.full_text);
  INSERT INTO guidelines_fts(rowid, reference, title_ja, title_en, category, summary, full_text)
  VALUES (new.id, new.reference, new.title_ja, new.title_en, COALESCE(new.category, ''), COALESCE(new.summary, ''), new.full_text);
END;
`;

// --- Interfaces ---------------------------------------------------------------

export interface Category {
  id: string;
  name_ja: string;
  name_en: string;
  version: string | null;
  domain: string | null;
  description: string | null;
  item_count: number;
  effective_date: string | null;
  source_url: string | null;
}

export interface Inspection {
  id: number;
  category_id: string;
  item_ref: string;
  domain: string;
  subdomain: string | null;
  title_ja: string;
  title_en: string;
  description: string;
  standard_level: string | null;
  priority: string | null;
}

export interface Guideline {
  id: number;
  reference: string;
  title_ja: string;
  title_en: string;
  date: string | null;
  category: string | null;
  summary: string | null;
  full_text: string;
  source_url: string | null;
  status: string;
}

// --- DB singleton -------------------------------------------------------------

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  // Read-only: DB is baked into the image at build time via the ingestion
  // pipeline; runtime never writes. Container rootfs is read_only:true (per
  // mcp-defaults compose anchor), so opening write-mode + setting WAL +
  // execing CREATE TABLE IF NOT EXISTS would fail with "unable to open
  // database file". Schema is exported for use by the offline ingestion
  // scripts, not at runtime.
  _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return _db;
}

// --- Category queries ---------------------------------------------------------

export function listCategories(): Category[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM categories ORDER BY effective_date DESC")
    .all() as Category[];
}

export function getCategory(id: string): Category | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM categories WHERE id = ? LIMIT 1")
      .get(id) as Category | undefined) ?? null
  );
}

// --- Inspection queries -------------------------------------------------------

export interface SearchInspectionsOptions {
  query: string;
  category?: string | undefined;
  domain?: string | undefined;
  limit?: number | undefined;
}

export function searchInspections(opts: SearchInspectionsOptions): Inspection[] {
  const db = getDb();
  const limit = opts.limit ?? 10;

  const conditions: string[] = ["inspections_fts MATCH :query"];
  const params: Record<string, unknown> = { query: opts.query, limit };

  if (opts.category) {
    conditions.push("i.category_id = :category");
    params["category"] = opts.category;
  }
  if (opts.domain) {
    conditions.push("i.domain = :domain");
    params["domain"] = opts.domain;
  }

  const where = conditions.join(" AND ");
  return db
    .prepare(
      `SELECT i.*, snippet(inspections_fts, 5, '[', ']', '...', 20) AS _snippet
       FROM inspections_fts f
       JOIN inspections i ON i.id = f.rowid
       WHERE ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params) as Inspection[];
}

export function getInspection(itemRef: string): Inspection | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM inspections WHERE item_ref = ? LIMIT 1")
      .get(itemRef) as Inspection | undefined) ?? null
  );
}

// --- Guideline queries --------------------------------------------------------

export interface SearchGuidelinesOptions {
  query: string;
  category?: string | undefined;
  limit?: number | undefined;
}

export function searchGuidelines(opts: SearchGuidelinesOptions): Guideline[] {
  const db = getDb();
  const limit = opts.limit ?? 10;

  const conditions: string[] = ["guidelines_fts MATCH :query"];
  const params: Record<string, unknown> = { query: opts.query, limit };

  if (opts.category) {
    conditions.push("g.category = :category");
    params["category"] = opts.category;
  }

  const where = conditions.join(" AND ");
  return db
    .prepare(
      `SELECT g.*, snippet(guidelines_fts, 5, '[', ']', '...', 20) AS _snippet
       FROM guidelines_fts f
       JOIN guidelines g ON g.id = f.rowid
       WHERE ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params) as Guideline[];
}

export function getGuideline(reference: string): Guideline | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM guidelines WHERE reference = ? LIMIT 1")
      .get(reference) as Guideline | undefined) ?? null
  );
}

// --- Combined search ----------------------------------------------------------

export interface SearchGuidanceOptions {
  query: string;
  domain?: string | undefined;
  limit?: number | undefined;
}

export interface GuidanceResult {
  type: "inspection" | "guideline";
  id: string;
  title_ja: string;
  title_en: string;
  reference: string;
  domain: string | null;
  summary: string | null;
  rank: number;
}

export function searchGuidance(opts: SearchGuidanceOptions): GuidanceResult[] {
  const db = getDb();
  const limit = opts.limit ?? 10;
  const halfLimit = Math.ceil(limit / 2);

  const inspectionParams: Record<string, unknown> = { query: opts.query, limit: halfLimit };
  const guidelineParams: Record<string, unknown> = { query: opts.query, limit: halfLimit };

  let inspectionWhere = "inspections_fts MATCH :query";
  if (opts.domain) {
    inspectionWhere += " AND i.domain = :domain";
    inspectionParams["domain"] = opts.domain;
  }

  const inspections = db
    .prepare(
      `SELECT 'inspection' AS type, i.item_ref AS id, i.title_ja, i.title_en,
              i.item_ref AS reference, i.domain, SUBSTR(i.description, 1, 200) AS summary, rank
       FROM inspections_fts f
       JOIN inspections i ON i.id = f.rowid
       WHERE ${inspectionWhere}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(inspectionParams) as GuidanceResult[];

  let guidelineWhere = "guidelines_fts MATCH :query";
  if (opts.domain) {
    guidelineWhere += " AND g.category = :domain";
    guidelineParams["domain"] = opts.domain;
  }

  const guidelines = db
    .prepare(
      `SELECT 'guideline' AS type, CAST(g.id AS TEXT) AS id, g.title_ja, g.title_en,
              g.reference, g.category AS domain, g.summary, rank
       FROM guidelines_fts f
       JOIN guidelines g ON g.id = f.rowid
       WHERE ${guidelineWhere}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(guidelineParams) as GuidanceResult[];

  // Merge, sort by rank (lower is better in FTS5 BM25), deduplicate
  const merged = [...inspections, ...guidelines];
  merged.sort((a, b) => a.rank - b.rank);
  return merged.slice(0, limit);
}

// --- Stats --------------------------------------------------------------------

export interface DbStats {
  categories: number;
  inspections: number;
  guidelines: number;
}

export function getStats(): DbStats {
  const db = getDb();
  const categories = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
  const inspections = (db.prepare("SELECT COUNT(*) AS n FROM inspections").get() as { n: number }).n;
  const guidelines = (db.prepare("SELECT COUNT(*) AS n FROM guidelines").get() as { n: number }).n;
  return { categories, inspections, guidelines };
}
