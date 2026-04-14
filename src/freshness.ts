/**
 * Runtime freshness reporter for the `jp_fsa_check_data_freshness` tool.
 *
 * Reads `data/coverage.json` and reports per-source data age, flagging
 * staleness against the source's declared `update_frequency`. Status logic
 * matches the non-law golden standard (Section 4.1):
 *
 *   - `Current` — within the expected refresh window
 *   - `Due in N days` — within 20 % of the refresh deadline
 *   - `OVERDUE (N days)` — past expected refresh date
 *
 * No hardcoded dates: every value comes from coverage.json at runtime.
 */

import { existsSync, readFileSync } from "node:fs";

interface CoverageSource {
  name: string;
  url?: string;
  last_fetched?: string | null;
  update_frequency?: string;
  item_count?: number;
}

interface CoverageFile {
  generatedAt?: string;
  database_built?: string;
  version?: string;
  sources?: CoverageSource[];
  totals?: Record<string, number>;
}

type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annually" | "annual";

const FREQUENCY_DAYS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
  quarterly: 92,
  annual: 365,
  annually: 365,
};

function frequencyToDays(freq: string | undefined): number {
  if (!freq) return 92;
  return FREQUENCY_DAYS[freq.toLowerCase() as Frequency] ?? 92;
}

export interface FreshnessRow {
  source: string;
  last_refresh: string | null;
  frequency: string;
  age_days: number | null;
  max_age_days: number;
  status: "Current" | "Due" | "OVERDUE";
  status_text: string;
}

export interface FreshnessReport {
  database_version: string;
  database_built: string;
  any_stale: boolean;
  rows: FreshnessRow[];
  text: string;
  refresh_command: string;
}

export function buildFreshnessReport(
  coveragePath = "data/coverage.json",
  repoSlug = "Ansvar-Systems/japan-fsa-guidance-mcp",
): FreshnessReport {
  const cmd = `gh workflow run ingest.yml --repo ${repoSlug} -f force=true`;

  if (!existsSync(coveragePath)) {
    return {
      database_version: "unknown",
      database_built: "unknown",
      any_stale: true,
      rows: [],
      text: `## Data Freshness Report\n\ncoverage.json not found at ${coveragePath}. Run \`npm run coverage:update\` first.\n\nTo trigger a forced ingestion:\n\n    ${cmd}`,
      refresh_command: cmd,
    };
  }

  const cov = JSON.parse(readFileSync(coveragePath, "utf8")) as CoverageFile;
  const now = Date.now();
  const rows: FreshnessRow[] = [];
  let anyStale = false;

  for (const src of cov.sources ?? []) {
    const maxAgeDays = frequencyToDays(src.update_frequency);
    let ageDays: number | null = null;
    let status: FreshnessRow["status"] = "Current";
    let statusText = "Current";

    if (!src.last_fetched) {
      status = "OVERDUE";
      statusText = "OVERDUE (never fetched)";
      anyStale = true;
    } else {
      const ms = new Date(src.last_fetched).getTime();
      if (Number.isNaN(ms)) {
        status = "OVERDUE";
        statusText = "OVERDUE (invalid last_fetched date)";
        anyStale = true;
      } else {
        ageDays = Math.floor((now - ms) / (24 * 60 * 60 * 1000));
        if (ageDays > maxAgeDays) {
          status = "OVERDUE";
          statusText = `OVERDUE (${ageDays - maxAgeDays} days)`;
          anyStale = true;
        } else if (ageDays >= maxAgeDays * 0.8) {
          status = "Due";
          statusText = `Due in ${maxAgeDays - ageDays} days`;
        } else {
          status = "Current";
          statusText = "Current";
        }
      }
    }

    rows.push({
      source: src.name,
      last_refresh: src.last_fetched ?? null,
      frequency: src.update_frequency ?? "unknown",
      age_days: ageDays,
      max_age_days: maxAgeDays,
      status,
      status_text: statusText,
    });
  }

  const dbVersion = cov.version ?? "unknown";
  const dbBuilt = cov.database_built ?? cov.generatedAt ?? "unknown";

  const header = "## Data Freshness Report\n\n";
  const tableHeader =
    "| Source | Last Refresh | Frequency | Status |\n" +
    "|--------|-------------|-----------|--------|\n";
  const tableBody = rows
    .map((r) => `| ${r.source} | ${r.last_refresh ?? "never"} | ${r.frequency} | ${r.status_text} |`)
    .join("\n");
  const meta = `\n\nDatabase version: ${dbVersion}\nDatabase built: ${dbBuilt}\n`;
  const cmdText = `\nTo trigger a forced update:\n\n    ${cmd}\n`;

  return {
    database_version: dbVersion,
    database_built: dbBuilt,
    any_stale: anyStale,
    rows,
    text: header + tableHeader + tableBody + meta + cmdText,
    refresh_command: cmd,
  };
}
