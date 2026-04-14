/**
 * FSA Japan Ingestion Fetcher
 *
 * Fetches the FSA Japan guidance portals (English and Japanese), extracts links to
 * supervisory guidelines, inspection manuals, and circulars, downloads content,
 * and saves text for database ingestion.
 *
 * Japanese is the primary authoritative source. English translations are official
 * FSA translations but may lag behind Japanese versions. Handles both UTF-8 and
 * Shift-JIS encoded responses from fsa.go.jp.
 *
 * Usage:
 *   npx tsx scripts/ingest-fetch.ts
 *   npx tsx scripts/ingest-fetch.ts --dry-run     # log what would be fetched
 *   npx tsx scripts/ingest-fetch.ts --force        # re-download existing files
 *   npx tsx scripts/ingest-fetch.ts --limit 5      # fetch only first N documents
 */

import * as cheerio from "cheerio";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  createWriteStream,
} from "node:fs";
import { join, basename } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = "https://www.fsa.go.jp";
// English portal — subset of guidance available in English
const EN_PORTAL_URL = `${BASE_URL}/en/refer/guide/`;
// Additional EN index pages to crawl for document links
const EN_INDEX_URLS = [
  `${BASE_URL}/en/refer/guide/`,
  `${BASE_URL}/en/refer/legislation/index.html`,
];
// Japanese primary portal — comprehensive law and guidelines list
const JA_PORTAL_URL = `${BASE_URL}/common/law/`;
// Additional JA index pages to crawl for document links
const JA_INDEX_URLS = [
  `${BASE_URL}/common/law/`,
  `${BASE_URL}/common/law/guide.html`,   // 監督指針一覧 — Supervisory Guidelines catalog
  `${BASE_URL}/common/law/kokuji.html`,  // 告示・ガイドライン・Ｑ＆Ａ — Notices & Guidelines
];
const RAW_DIR = "data/raw";
const RATE_LIMIT_MS = 2500;  // fsa.go.jp rate limiting — be conservative
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE_MS = 3000;
const REQUEST_TIMEOUT_MS = 60_000;
const USER_AGENT = "Ansvar-MCP/1.0 (regulatory-data-ingestion; https://ansvar.eu)";

// Keywords identifying FSA guidance documents (English and Japanese)
const GUIDANCE_KEYWORDS = [
  // English keywords
  "supervision", "supervisory", "guideline", "guidelines", "inspection",
  "aml", "cft", "anti-money laundering", "cyber security", "cybersecurity",
  "fintech", "cloud", "outsourcing", "risk management", "capital adequacy",
  "solvency", "disclosure", "conduct of business", "crypto",
  // Japanese keywords
  "監督", "指針", "ガイドライン", "検査", "マネーロンダリング", "サイバー",
  "フィンテック", "クラウド", "リスク管理", "自己資本", "ソルベンシー",
  "開示", "暗号資産",
];

// CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const fetchLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "999", 10) : 999;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentLink {
  title: string;
  url: string;
  category: string;
  filename: string;
  lang: "en" | "ja";
}

interface FetchedDocument {
  title: string;
  url: string;
  category: string;
  filename: string;
  lang: string;
  text: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const backoff = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.error(
        `  Attempt ${attempt + 1}/${retries} failed for ${url}: ${lastError.message}. ` +
          `Retrying in ${backoff}ms...`,
      );
      if (attempt < retries - 1) await sleep(backoff);
    }
  }
  throw lastError ?? new Error(`All retries failed for ${url}`);
}

/**
 * Decode response body handling both UTF-8 and Shift-JIS encoding.
 * fsa.go.jp serves some pages with charset=shift_jis (especially older Japanese pages).
 * Node.js TextDecoder supports 'shift_jis' as an encoding label via ICU.
 */
async function decodeResponseText(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());

  // Detect Shift-JIS from Content-Type header
  const isShiftJis =
    contentType.toLowerCase().includes("shift_jis") ||
    contentType.toLowerCase().includes("shift-jis") ||
    contentType.toLowerCase().includes("sjis") ||
    contentType.toLowerCase().includes("x-sjis");

  if (isShiftJis) {
    try {
      const decoder = new TextDecoder("shift_jis");
      return decoder.decode(buffer);
    } catch {
      // If Shift-JIS decoding fails, fall back to UTF-8
      console.warn("  Warning: Shift-JIS decoding failed, falling back to UTF-8");
    }
  }

  // Check HTML meta charset as fallback
  const partial = buffer.toString("utf8", 0, 2000);
  if (
    partial.toLowerCase().includes('charset="shift_jis"') ||
    partial.toLowerCase().includes("charset=shift_jis")
  ) {
    try {
      const decoder = new TextDecoder("shift_jis");
      return decoder.decode(buffer);
    } catch {
      // fall through to UTF-8
    }
  }

  return buffer.toString("utf8");
}

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(pdfBuffer);
    return data.text ?? "";
  } catch (err) {
    console.error(
      `  Warning: PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "";
  }
}

// ---------------------------------------------------------------------------
// FSA portal scraping
// ---------------------------------------------------------------------------

function isGuidanceRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return GUIDANCE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function inferCategory(href: string, title: string): string {
  const lower = (href + title).toLowerCase();
  if (lower.includes("cyber") || lower.includes("サイバー")) return "Cyber Security";
  if (lower.includes("aml") || lower.includes("マネーロンダリング") || lower.includes("cft")) return "AML/CFT";
  if (lower.includes("ins") || lower.includes("保険")) return "Insurance";
  if (lower.includes("sec") || lower.includes("証券") || lower.includes("金融商品")) return "Securities";
  if (lower.includes("fintech") || lower.includes("フィンテック") || lower.includes("電子決済")) return "Fintech";
  if (lower.includes("cloud") || lower.includes("クラウド")) return "IT Governance";
  return "Supervisory Guidelines";
}

async function scrapePortal(portalUrl: string, lang: "en" | "ja"): Promise<DocumentLink[]> {
  console.log(`Fetching FSA portal (${lang}): ${portalUrl}`);
  let response: Response;
  try {
    response = await fetchWithRetry(portalUrl);
  } catch (err) {
    console.warn(`  Warning: Could not fetch ${portalUrl}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  const html = await decodeResponseText(response);
  const $ = cheerio.load(html);

  const links: DocumentLink[] = [];

  // Index pages like guide.html / kokuji.html list concrete documents but their
  // link text is often just "HTML版" / "PDF版（2,493KB）" — these don't match
  // GUIDANCE_KEYWORDS. For those index pages we bypass the keyword filter
  // and accept any link under /common/law/guide/ or /common/law/kokuji/ or
  // /en/refer/guide/ as a document link. We still carry an enriched title
  // from the nearest preceding heading / list item.
  const isIndexPage =
    portalUrl.includes("/common/law/guide.html") ||
    portalUrl.includes("/common/law/kokuji.html") ||
    portalUrl.includes("/en/refer/legislation/") ||
    portalUrl.includes("/en/refer/guide/");

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const linkText = $(el).text().trim();

    if (!href || !linkText) return;

    const isPdf = href.toLowerCase().endsWith(".pdf");
    const isHtml = href.toLowerCase().endsWith(".html") || href.endsWith("/");
    if (!isPdf && !isHtml) return;

    // Keep only links pointing at actual FSA document paths we care about
    const looksLikeDocumentPath =
      href.includes("/common/law/guide/") ||
      href.includes("/common/law/kokuji/") ||
      href.includes("/en/refer/guide/") ||
      href.includes("/en/refer/legislation/") ||
      (href.includes("/news/") && (isPdf || href.includes("cyber") || href.includes("aml"))) ||
      (href.includes("/policy/") && (isPdf || href.includes("cyber") || href.includes("aml")));

    if (!looksLikeDocumentPath) return;

    // Skip self-navigation anchors / index page roots we already crawled
    const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
    if (
      fullUrl === portalUrl ||
      fullUrl === EN_PORTAL_URL ||
      fullUrl === JA_PORTAL_URL ||
      fullUrl.endsWith("/common/law/guide.html") ||
      fullUrl.endsWith("/common/law/kokuji.html") ||
      fullUrl.endsWith("/en/refer/legislation/index.html")
    ) {
      return;
    }

    // Derive a better title. Index pages use "HTML版" / "PDF版（XKB）" for
    // every row and the real doc title sits in the parent <li>'s leading text
    // (before the nested <ul> of format options).
    let title = linkText;
    const isGenericLink =
      /^(HTML版|PDF版|別紙|様式|rating|pdf|\(PDF|Available in Japanese)/i.test(linkText) ||
      linkText.length < 6;
    if (isGenericLink) {
      // Walk up parent <li>s. The real doc title is on an ancestor li whose
      // leading (non-nested-ul) text is descriptive — not a format label like
      // "本文" / "英語版" / "HTML版". We stop at the FIRST ancestor li whose
      // outer text (after removing nested ul/ol) is >= 10 chars AND does not
      // start with a format-label prefix.
      const REJECT_PREFIX = /^(HTML版|PDF版|別紙|様式|本文|英語版|日本語版|Available in Japanese|\(PDF|EXCEL|PDF:)/i;
      let chosen = "";
      $(el).parentsUntil("body", "li").each((_, liEl) => {
        const $li = $(liEl);
        const clone = $li.clone();
        clone.find("ul,ol").remove();
        const outer = clone.text().replace(/\s+/g, " ").trim();
        if (outer && outer.length >= 10 && !REJECT_PREFIX.test(outer)) {
          chosen = outer;
          return false; // innermost descriptive ancestor wins
        }
        return undefined;
      });
      if (chosen) {
        title = chosen.slice(0, 220);
      } else {
        const $row = $(el).closest("li,tr,p,div,section").first();
        const heading = $row.prevAll("h1,h2,h3,h4,h5").first().text().trim();
        if (heading) title = `${heading} — ${linkText}`.slice(0, 220);
      }
    }

    // On non-index portal pages still apply keyword relevance; on index pages
    // the path filter above is authoritative.
    if (!isIndexPage && !isGuidanceRelevant(title)) return;

    const rawFilename = basename(href.split("?")[0] ?? href);
    // For directory-style URLs (/guide/city/index.html → "index.html"), derive
    // a unique filename from the parent path segment so raw files don't collide.
    let filename = rawFilename;
    if (!filename || filename === "index.html" || filename === "") {
      const parts = href.split("?")[0]!.split("/").filter(Boolean);
      const segment = parts[parts.length - 2] ?? `fsa-${lang}-${links.length + 1}`;
      filename = `fsa-${lang}-${segment}.html`;
    } else if (!isPdf && !filename.endsWith(".html")) {
      filename = `${filename}.html`;
    }
    // Guarantee uniqueness
    if (links.some((l) => l.filename === filename)) {
      const parts = href.split("?")[0]!.split("/").filter(Boolean);
      const segment = parts[parts.length - 2] ?? "x";
      filename = `${segment}-${filename}`;
    }

    if (links.some((l) => l.url === fullUrl)) return;

    links.push({
      title,
      url: fullUrl,
      category: inferCategory(href, title),
      filename,
      lang,
    });
  });

  return links;
}

function getKnownDocuments(): DocumentLink[] {
  return [
    {
      title: "Comprehensive Guidelines for Supervision of Major Banks",
      url: "https://www.fsa.go.jp/en/refer/guide/city/index.html",
      category: "Supervisory Guidelines",
      filename: "fsa-sup-bank-en.html",
      lang: "en",
    },
    {
      title: "Guidelines on Cyber Security in the Financial Sector (2024)",
      url: "https://www.fsa.go.jp/news/r6/cyber/20241001.html",
      category: "Cyber Security",
      filename: "fsa-cyber-2024.html",
      lang: "en",
    },
    {
      title: "Guidelines on Anti-Money Laundering and Combating the Financing of Terrorism",
      url: "https://www.fsa.go.jp/common/law/amlcft/index.html",
      category: "AML/CFT",
      filename: "fsa-aml-guidelines.html",
      lang: "ja",
    },
    {
      title: "Comprehensive Guidelines for Supervision of Insurance Companies",
      url: "https://www.fsa.go.jp/common/law/guide/ins.html",
      category: "Insurance Supervision",
      filename: "fsa-sup-ins.html",
      lang: "ja",
    },
    {
      title: "Comprehensive Guidelines for Supervision of Financial Instruments Business Operators",
      url: "https://www.fsa.go.jp/common/law/guide/kinyushohin.html",
      category: "Securities Supervision",
      filename: "fsa-sup-sec.html",
      lang: "ja",
    },
    {
      title: "主要行等向けの総合的な監督指針 (Major Banks Supervisory Guidelines — Japanese)",
      url: "https://www.fsa.go.jp/common/law/guide/city/index.html",
      category: "Supervisory Guidelines",
      filename: "fsa-sup-bank-ja.html",
      lang: "ja",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
    console.log(`Created directory: ${RAW_DIR}`);
  }

  // Scrape all configured EN and JA index pages in sequence (rate limited)
  const enLinksArrays: DocumentLink[][] = [];
  for (const url of EN_INDEX_URLS) {
    enLinksArrays.push(await scrapePortal(url, "en"));
    await sleep(RATE_LIMIT_MS);
  }
  const jaLinksArrays: DocumentLink[][] = [];
  for (const url of JA_INDEX_URLS) {
    jaLinksArrays.push(await scrapePortal(url, "ja"));
    await sleep(RATE_LIMIT_MS);
  }
  const enLinks = enLinksArrays.flat();
  const jaLinks = jaLinksArrays.flat();

  let documents: DocumentLink[] = [...enLinks, ...jaLinks];

  // Deduplicate by URL
  const seen = new Set<string>();
  documents = documents.filter((d) => {
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });

  console.log(`Found ${documents.length} FSA guidance documents (${enLinks.length} EN + ${jaLinks.length} JA)`);

  if (documents.length === 0) {
    console.warn("No links found via scraping. Portals may require JavaScript or have changed structure.");
    console.warn("Falling back to known document list.");
    documents = getKnownDocuments();
  }

  if (documents.length > fetchLimit) {
    documents = documents.slice(0, fetchLimit);
    console.log(`Limiting to ${fetchLimit} documents`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would fetch:");
    for (const doc of documents) {
      console.log(`  [${doc.lang}] ${doc.title} → ${doc.filename}`);
    }
    return;
  }

  const fetched: FetchedDocument[] = [];
  let skipped = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!;
    const destPath = join(RAW_DIR, doc.filename);
    const metaPath = join(RAW_DIR, `${doc.filename}.meta.json`);

    if (!force && existsSync(metaPath)) {
      console.log(`[${i + 1}/${documents.length}] Skipping (exists): ${doc.title}`);
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${documents.length}] Fetching [${doc.lang}]: ${doc.title}`);
    console.log(`  URL: ${doc.url}`);

    try {
      const response = await fetchWithRetry(doc.url);
      const isPdf = doc.filename.endsWith(".pdf");

      let text: string;
      if (isPdf) {
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(destPath, buffer);
        console.log(`  Downloaded PDF: ${buffer.length.toLocaleString()} bytes → ${destPath}`);
        text = await extractPdfText(buffer);
      } else {
        text = await decodeResponseText(response);
        writeFileSync(destPath, text, "utf8");
        console.log(`  Downloaded HTML: ${text.length.toLocaleString()} chars → ${destPath}`);
        // Strip HTML tags for plain text storage
        const $ = cheerio.load(text);
        text = $("body").text().replace(/\s+/g, " ").trim();
      }

      console.log(`  Text length: ${text.length.toLocaleString()} chars`);

      const meta: FetchedDocument = {
        title: doc.title,
        url: doc.url,
        category: doc.category,
        filename: doc.filename,
        lang: doc.lang,
        text,
        fetchedAt: new Date().toISOString(),
      };

      writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
      fetched.push(meta);
    } catch (err) {
      console.error(
        `  ERROR fetching ${doc.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (i < documents.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    total: documents.length,
    fetched: fetched.length,
    skipped,
    errors: documents.length - fetched.length - skipped,
    documents: fetched.map((d) => ({
      title: d.title,
      filename: d.filename,
      category: d.category,
      lang: d.lang,
      textLength: d.text.length,
    })),
  };

  writeFileSync(join(RAW_DIR, "fetch-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nFetch complete: ${fetched.length} fetched, ${skipped} skipped, ${summary.errors} errors`);
  console.log(`Summary written to ${join(RAW_DIR, "fetch-summary.json")}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
