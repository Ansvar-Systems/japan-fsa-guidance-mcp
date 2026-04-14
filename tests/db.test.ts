/**
 * Smoke tests for the Japan FSA database layer.
 *
 * These run after the database has been ingested (or against the committed
 * data/fsa-jp.db) and verify:
 *   - the database file exists and is readable
 *   - it contains a non-trivial number of items across the three tables
 *   - FTS5 search works in both Japanese and English
 *   - each public query function returns a valid shape
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  getStats,
  listCategories,
  searchGuidance,
  searchInspections,
  searchGuidelines,
  getInspection,
  getGuideline,
} from "../src/db.js";

const DB_PATH = process.env["FSA_JP_DB_PATH"] ?? "data/fsa-jp.db";

describe("Japan FSA database", () => {
  it("database file exists", () => {
    expect(existsSync(DB_PATH)).toBe(true);
  });

  it("contains a non-trivial number of items across all three tables", () => {
    const s = getStats();
    expect(s.categories).toBeGreaterThanOrEqual(5);
    expect(s.guidelines).toBeGreaterThanOrEqual(10);
    expect(s.inspections).toBeGreaterThanOrEqual(1);
    const total = s.categories + s.inspections + s.guidelines;
    expect(total).toBeGreaterThanOrEqual(50);
  });

  it("lists categories with required fields", () => {
    const rows = listCategories();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const first = rows[0]!;
    expect(first.id).toBeTruthy();
    // Either Japanese or English name must be present (schema permits empty
    // string in the missing-translation column).
    expect((first.name_ja?.length ?? 0) + (first.name_en?.length ?? 0))
      .toBeGreaterThan(0);
  });

  it("FTS search works in English (combined search)", () => {
    const hits = searchGuidance({ query: "supervision", limit: 5 });
    // We do not require hits — the corpus is small and English-side coverage
    // is partial — but the call must not throw and must return an array.
    expect(Array.isArray(hits)).toBe(true);
  });

  it("FTS search works in Japanese (combined search)", () => {
    const hits = searchGuidance({ query: "金融", limit: 5 });
    expect(Array.isArray(hits)).toBe(true);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const h of hits) {
      expect(["inspection", "guideline"]).toContain(h.type);
      expect(h.reference).toBeTruthy();
    }
  });

  it("inspection FTS search returns array", () => {
    const hits = searchInspections({ query: "金融", limit: 5 });
    expect(Array.isArray(hits)).toBe(true);
  });

  it("guideline FTS search returns array", () => {
    const hits = searchGuidelines({ query: "金融", limit: 5 });
    expect(Array.isArray(hits)).toBe(true);
  });

  it("getInspection returns null for unknown reference", () => {
    expect(getInspection("FSA-DOES-NOT-EXIST-9999")).toBeNull();
  });

  it("getGuideline returns null for unknown reference", () => {
    expect(getGuideline("FSA-DOES-NOT-EXIST-9999")).toBeNull();
  });
});
