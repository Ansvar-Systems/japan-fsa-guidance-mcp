/**
 * Shared response-metadata helpers for the Japan FSA MCP server.
 *
 * `_meta` carries the disclaimer and a machine-readable data_age (ISO date)
 * with every tool response. `_error_type` is added on error responses for
 * deterministic downstream handling (NO_MATCH, INVALID_INPUT).
 *
 * Both stdio (src/index.ts) and HTTP (src/http-server.ts) entry points use
 * this module so disclaimer text and data-age computation stay identical.
 */

import { existsSync, readFileSync } from "node:fs";

export const SOURCE_URL = "https://www.fsa.go.jp/en/refer/guide/";

export const DISCLAIMER =
  "This data is provided for informational reference only. It does not constitute legal or professional advice. " +
  "Always verify against official FSA Japan publications at https://www.fsa.go.jp/. " +
  "Japanese is the primary authoritative language; English translations are official FSA translations but may lag behind Japanese versions.";

export type ErrorType = "NO_MATCH" | "INVALID_INPUT";

interface CoverageFile {
  generatedAt?: string;
  database_built?: string;
  sources?: Array<{ last_fetched?: string | null }>;
}

let cachedDataAge: string | null = null;

/**
 * Resolve the most recent data-age string for `_meta.data_age`.
 *
 * Order of preference:
 *   1. `database_built` field in data/coverage.json (set by build-db.ts after
 *      a fresh ingestion);
 *   2. `generatedAt` field on coverage.json (set by update-coverage.ts);
 *   3. The latest `last_fetched` across sources;
 *   4. Today's ISO date as a non-fatal fallback.
 *
 * Result is cached for the lifetime of the process.
 */
export function getDataAge(coveragePath = "data/coverage.json"): string {
  if (cachedDataAge !== null) return cachedDataAge;

  let resolved: string | null = null;
  try {
    if (existsSync(coveragePath)) {
      const cov = JSON.parse(readFileSync(coveragePath, "utf8")) as CoverageFile;
      if (typeof cov.database_built === "string" && cov.database_built.length > 0) {
        resolved = cov.database_built;
      } else if (typeof cov.generatedAt === "string" && cov.generatedAt.length > 0) {
        resolved = cov.generatedAt;
      } else if (Array.isArray(cov.sources)) {
        const latest = cov.sources
          .map((s) => s.last_fetched)
          .filter((d): d is string => typeof d === "string" && d.length > 0)
          .sort()
          .pop();
        if (latest) resolved = latest;
      }
    }
  } catch {
    // fall through to today
  }
  cachedDataAge = resolved ?? new Date().toISOString().slice(0, 10);
  return cachedDataAge;
}

/** Reset the cached data_age — only intended for tests. */
export function resetDataAgeCache(): void {
  cachedDataAge = null;
}

export function buildMeta(sourceUrl?: string): Record<string, unknown> {
  return {
    disclaimer: DISCLAIMER,
    data_age: getDataAge(),
    source_url: sourceUrl ?? SOURCE_URL,
  };
}

/**
 * Build an error response payload conforming to MCP `_error_type` + `_meta`
 * conventions described in the non-law golden standard (Section 4.8b).
 */
export function buildErrorPayload(message: string, errorType: ErrorType, sourceUrl?: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
    _error_type: errorType,
    _meta: buildMeta(sourceUrl),
  };
}
