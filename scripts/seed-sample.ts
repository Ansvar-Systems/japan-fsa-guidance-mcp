/**
 * Seed the FSA Japan database with sample categories, inspection items, and guidance documents.
 *
 * Usage:
 *   npx tsx scripts/seed-sample.ts
 *   npx tsx scripts/seed-sample.ts --force
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["FSA_JP_DB_PATH"] ?? "data/fsa-jp.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);
console.log(`Database initialised at ${DB_PATH}`);

// --- Categories ---------------------------------------------------------------

interface CategoryRow {
  id: string;
  name_ja: string;
  name_en: string;
  version: string;
  domain: string;
  description: string;
  item_count: number;
  effective_date: string;
  source_url: string;
}

const categories: CategoryRow[] = [
  {
    id: "fsa-sup-bank",
    name_ja: "主要行等向けの総合的な監督指針",
    name_en: "Comprehensive Guidelines for Supervision of Major Banks",
    version: "2024 (latest)",
    domain: "Supervisory Guidelines",
    description:
      "The FSA Comprehensive Guidelines for Supervision of Major Banks (主要行等向けの総合的な監督指針) set out " +
      "the FSA's supervisory approach and examination criteria for major banks, bank holding companies, " +
      "and their subsidiaries. The guidelines cover corporate governance, risk management, internal audit, " +
      "AML/CFT compliance, IT systems, and customer protection. They are updated regularly to reflect " +
      "regulatory developments, international standards (Basel Committee), and supervisory experience.",
    item_count: 350,
    effective_date: "2024-04-01",
    source_url: "https://www.fsa.go.jp/common/law/guide/city/index.html",
  },
  {
    id: "fsa-cyber-2024",
    name_ja: "金融分野におけるサイバーセキュリティに関するガイドライン",
    name_en: "Guidelines on Cyber Security in the Financial Sector",
    version: "2024",
    domain: "Cyber Security",
    description:
      "The FSA Cyber Security Guidelines (金融分野におけるサイバーセキュリティに関するガイドライン) establish " +
      "minimum cyber security standards for financial institutions supervised by the FSA. " +
      "Published in 2024, these guidelines reflect the FSA's shift to a more risk-based supervisory " +
      "approach for cyber risk. They cover cyber risk governance, threat intelligence, incident response, " +
      "third-party and supply chain risk, and sector-wide information sharing. " +
      "All banks, insurance companies, and securities firms must comply.",
    item_count: 85,
    effective_date: "2024-10-01",
    source_url: "https://www.fsa.go.jp/news/r6/cyber/20241001.html",
  },
  {
    id: "fsa-aml",
    name_ja: "マネー・ローンダリング及びテロ資金供与対策に関するガイドライン",
    name_en: "Guidelines on Anti-Money Laundering and Combating the Financing of Terrorism",
    version: "2024 (rev.)",
    domain: "AML/CFT",
    description:
      "The FSA AML/CFT Guidelines (マネー・ローンダリング及びテロ資金供与対策に関するガイドライン) establish " +
      "a risk-based framework for financial institutions to prevent money laundering and terrorist financing. " +
      "Originally issued in 2018 and revised multiple times, the guidelines align with FATF recommendations " +
      "and cover customer due diligence (CDD), enhanced due diligence (EDD), transaction monitoring, " +
      "suspicious transaction reporting (STR), record-keeping, and staff training. " +
      "The FSA has significantly strengthened AML/CFT supervision since Japan's 2021 FATF mutual evaluation.",
    item_count: 120,
    effective_date: "2024-03-01",
    source_url: "https://www.fsa.go.jp/common/law/amlcft/index.html",
  },
  {
    id: "fsa-sup-ins",
    name_ja: "保険会社向けの総合的な監督指針",
    name_en: "Comprehensive Guidelines for Supervision of Insurance Companies",
    version: "2024 (latest)",
    domain: "Insurance Supervision",
    description:
      "The FSA Comprehensive Guidelines for Supervision of Insurance Companies " +
      "(保険会社向けの総合的な監督指針) set out supervisory principles and examination criteria " +
      "for life and non-life insurance companies and their holding companies. " +
      "The guidelines cover solvency, investment management, policyholder protection, " +
      "IT systems, AML/CFT, governance, and climate-related financial risk.",
    item_count: 280,
    effective_date: "2024-04-01",
    source_url: "https://www.fsa.go.jp/common/law/guide/ins.html",
  },
  {
    id: "fsa-sup-sec",
    name_ja: "金融商品取引業者等向けの総合的な監督指針",
    name_en: "Comprehensive Guidelines for Supervision of Financial Instruments Business Operators",
    version: "2024 (latest)",
    domain: "Securities Supervision",
    description:
      "The FSA Comprehensive Guidelines for Supervision of Financial Instruments Business Operators " +
      "(金融商品取引業者等向けの総合的な監督指針) set out supervisory criteria for securities companies, " +
      "investment advisers, investment managers, and fintech operators. " +
      "Coverage includes conduct of business, suitability, market abuse, crypto-asset exchanges, " +
      "operational resilience, and investor protection.",
    item_count: 220,
    effective_date: "2024-04-01",
    source_url: "https://www.fsa.go.jp/common/law/guide/kinyushohin.html",
  },
];

const insertCategory = db.prepare(
  "INSERT OR IGNORE INTO categories (id, name_ja, name_en, version, domain, description, item_count, effective_date, source_url) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const c of categories) {
  insertCategory.run(
    c.id, c.name_ja, c.name_en, c.version, c.domain, c.description, c.item_count, c.effective_date, c.source_url,
  );
}
console.log(`Inserted ${categories.length} categories`);

// --- Inspection Items ---------------------------------------------------------

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

const inspections: InspectionRow[] = [
  // Bank Supervision — Governance
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-GOV-1.1",
    domain: "Corporate Governance",
    subdomain: "Board Responsibilities",
    title_ja: "取締役会の役割と責任",
    title_en: "Board of Directors: Roles and Responsibilities",
    description:
      "The FSA examines whether the board of directors has appropriate oversight of management and risk-taking. " +
      "Key inspection points: (1) The board must include a sufficient number of independent outside directors " +
      "with relevant expertise. (2) The board must approve the risk appetite statement and monitor adherence. " +
      "(3) Board committees (audit, risk, nomination, compensation) must function effectively. " +
      "(4) Management information provided to the board must be adequate for informed decision-making. " +
      "(5) The board must review and approve major strategies, risk management policies, and compliance frameworks. " +
      "The FSA pays particular attention to whether outside directors can effectively challenge management.",
    standard_level: "Required",
    priority: "High",
  },
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-GOV-1.2",
    domain: "Corporate Governance",
    subdomain: "Internal Audit",
    title_ja: "内部監査の有効性",
    title_en: "Effectiveness of Internal Audit",
    description:
      "The FSA examines whether the bank's internal audit function operates effectively and independently. " +
      "Key inspection points: (1) The internal audit function must report directly to the board audit committee. " +
      "(2) Audit plans must be risk-based and cover all significant risk areas including IT and cyber risk. " +
      "(3) The Chief Audit Executive must have appropriate qualifications and independence. " +
      "(4) Internal audit findings must be tracked to resolution with appropriate escalation for critical items. " +
      "(5) The internal audit function must conduct quality assessments at least once every five years.",
    standard_level: "Required",
    priority: "High",
  },

  // Bank Supervision — Credit Risk
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-CR-2.1",
    domain: "Credit Risk Management",
    subdomain: "Credit Policies",
    title_ja: "与信方針・手続の整備",
    title_en: "Credit Policies and Procedures",
    description:
      "The FSA examines whether the bank has sound credit risk management policies and procedures. " +
      "Key inspection points: (1) Board-approved credit risk appetite and concentration limits must be documented. " +
      "(2) Credit underwriting standards must be clearly defined and consistently applied. " +
      "(3) Credit review and loan classification processes must be robust and forward-looking. " +
      "(4) Loan loss provisioning must comply with applicable accounting standards and FSA guidance. " +
      "(5) Sector, geographic, and single-name concentration risks must be monitored against approved limits.",
    standard_level: "Required",
    priority: "High",
  },

  // Bank Supervision — IT Systems
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-IT-5.1",
    domain: "IT Systems",
    subdomain: "IT Governance",
    title_ja: "情報システムに係るガバナンス",
    title_en: "IT Governance",
    description:
      "The FSA examines whether the bank has effective governance over its information systems. " +
      "Key inspection points: (1) The board must receive regular reports on IT risk and major IT projects. " +
      "(2) A designated Chief Information Officer (CIO) or equivalent must be accountable for IT strategy. " +
      "(3) The bank must maintain an IT strategic plan aligned with the business strategy. " +
      "(4) Significant IT outsourcing arrangements must have board-level approval and ongoing oversight. " +
      "(5) Legacy system risks must be identified and managed with documented migration or remediation plans.",
    standard_level: "Required",
    priority: "High",
  },
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-IT-5.2",
    domain: "IT Systems",
    subdomain: "System Availability and Resilience",
    title_ja: "システムの安定稼働",
    title_en: "System Availability and Operational Stability",
    description:
      "The FSA examines whether banking systems maintain adequate availability and operational stability. " +
      "Key inspection points: (1) Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO) " +
      "must be defined for all critical systems and tested at least annually. " +
      "(2) Incident and problem management processes must ensure rapid restoration of critical services. " +
      "(3) Change management controls must prevent unauthorised changes and reduce outage risk. " +
      "(4) Capacity management must prevent degradation during peak periods. " +
      "(5) System outages affecting customers must be reported to the FSA in accordance with notification requirements.",
    standard_level: "Required",
    priority: "High",
  },

  // Cyber Security Guidelines
  {
    category_id: "fsa-cyber-2024",
    item_ref: "FSA-CYBER-2024-GOV-1",
    domain: "Cyber Security Governance",
    subdomain: "Leadership Accountability",
    title_ja: "経営陣によるサイバーセキュリティへの関与",
    title_en: "Senior Management Engagement in Cyber Security",
    description:
      "Financial institutions must ensure senior management is actively engaged in cyber security governance. " +
      "Requirements: (1) The board must approve the cyber security strategy and risk appetite annually. " +
      "(2) A senior executive (equivalent to CISO) must be accountable for cyber security and report to the board. " +
      "(3) The board must receive quarterly cyber security reports covering threat landscape, incidents, " +
      "vulnerability status, and progress against the cyber security programme. " +
      "(4) Cyber security must be integrated into enterprise risk management, not treated as solely an IT matter. " +
      "(5) The institution must participate in sector-wide information sharing (FS-ISAC Japan or equivalent).",
    standard_level: "Required",
    priority: "High",
  },
  {
    category_id: "fsa-cyber-2024",
    item_ref: "FSA-CYBER-2024-001",
    domain: "Cyber Security Governance",
    subdomain: "Cyber Security Strategy",
    title_ja: "金融分野におけるサイバーセキュリティ強化に向けたガイドライン",
    title_en: "Guidelines for Strengthening Cyber Security in the Financial Sector",
    description:
      "The FSA 2024 Cyber Security Guidelines establish a comprehensive framework for managing cyber risk " +
      "in Japanese financial institutions. Key requirements: " +
      "(1) Risk-based cyber security programme aligned with institution's risk profile and systemic importance. " +
      "(2) Threat intelligence programme to identify and assess current and emerging threats. " +
      "(3) Vulnerability management with defined remediation SLAs: critical vulnerabilities within 14 days, " +
      "high-severity within 30 days for internet-facing systems. " +
      "(4) Zero-trust architecture principles to be adopted for network access control. " +
      "(5) Regular penetration testing by qualified external parties for critical systems. " +
      "(6) Cyber incident response plan tested annually with tabletop exercises. " +
      "(7) FSA notification required within 3 hours of a significant cyber incident detection.",
    standard_level: "Required",
    priority: "High",
  },
  {
    category_id: "fsa-cyber-2024",
    item_ref: "FSA-CYBER-2024-SC-3",
    domain: "Supply Chain Risk",
    subdomain: "Third-Party Cyber Risk",
    title_ja: "サードパーティ・サイバーリスク管理",
    title_en: "Third-Party and Supply Chain Cyber Risk Management",
    description:
      "Financial institutions must manage cyber risks arising from third-party service providers and supply chains. " +
      "Requirements: (1) All material technology vendors must undergo cyber security due diligence before engagement. " +
      "(2) Contracts must include cyber security requirements, audit rights, and incident notification obligations. " +
      "(3) Critical technology providers must submit annual cyber security posture attestations. " +
      "(4) Concentration risk from dependence on single cloud providers must be assessed and reported to the board. " +
      "(5) Software bill of materials (SBOM) must be maintained for critical systems and reviewed for known vulnerabilities. " +
      "(6) Institutions must monitor for vulnerabilities in open-source components used in critical applications.",
    standard_level: "Required",
    priority: "High",
  },

  // AML/CFT
  {
    category_id: "fsa-aml",
    item_ref: "FSA-AML-CDD-2.1",
    domain: "AML/CFT",
    subdomain: "Customer Due Diligence",
    title_ja: "顧客管理（カスタマー・デュー・ディリジェンス）",
    title_en: "Customer Due Diligence (CDD)",
    description:
      "Financial institutions must implement risk-based customer due diligence procedures. " +
      "Requirements: (1) Customer identification and verification at onboarding for all account types. " +
      "(2) Beneficial ownership identification for legal entities, trusts, and other arrangements. " +
      "(3) Ongoing monitoring of customer relationships and transactions for consistency with risk profile. " +
      "(4) Enhanced due diligence (EDD) for higher-risk customers: politically exposed persons (PEPs), " +
      "customers from high-risk jurisdictions (FATF grey/black list), and high-value clients. " +
      "(5) Simplified due diligence permitted only for lower-risk customers with FSA guidance. " +
      "(6) CDD records must be retained for at least seven years after the relationship ends.",
    standard_level: "Required",
    priority: "High",
  },
  {
    category_id: "fsa-aml",
    item_ref: "FSA-AML-STR-3.1",
    domain: "AML/CFT",
    subdomain: "Suspicious Transaction Reporting",
    title_ja: "疑わしい取引の届出",
    title_en: "Suspicious Transaction Reporting (STR)",
    description:
      "Financial institutions must have robust procedures for identifying and reporting suspicious transactions. " +
      "Requirements: (1) All staff must be trained to identify indicators of money laundering and terrorist financing. " +
      "(2) A transaction monitoring system appropriate to the institution's risk profile and transaction volume. " +
      "(3) Escalation procedures for reviewed alerts with documented decision rationale retained for audit. " +
      "(4) Suspicious transactions must be reported to the Japan Financial Intelligence Centre (JAFIC) " +
      "promptly upon suspicion — no waiting for certainty. " +
      "(5) Tipping-off to the customer (or others) about an STR is prohibited. " +
      "(6) The institution must track STR filing rates and patterns as a governance metric.",
    standard_level: "Required",
    priority: "High",
  },

  // Insurance Supervision
  {
    category_id: "fsa-sup-ins",
    item_ref: "FSA-SUP-INS-SOL-1.1",
    domain: "Solvency",
    subdomain: "Capital Adequacy",
    title_ja: "ソルベンシー・マージン比率の管理",
    title_en: "Solvency Margin Ratio Management",
    description:
      "The FSA examines whether insurance companies maintain adequate capital and manage solvency risk. " +
      "Key inspection points: (1) The solvency margin ratio must be calculated accurately and reported to the FSA quarterly. " +
      "(2) The internal capital adequacy assessment process (ICAAP equivalent for insurers) must be robust. " +
      "(3) Stress testing must cover natural catastrophe scenarios, pandemic risks, and interest rate shocks. " +
      "(4) The board must approve the risk appetite and capital management plan annually. " +
      "(5) Dividend and capital distribution decisions must account for current and projected solvency position. " +
      "The FSA is developing an economic-value-based solvency regime (ESR) for implementation by 2025.",
    standard_level: "Required",
    priority: "High",
  },

  // Securities Supervision
  {
    category_id: "fsa-sup-sec",
    item_ref: "FSA-SUP-SEC-COB-1.1",
    domain: "Conduct of Business",
    subdomain: "Suitability",
    title_ja: "適合性の原則",
    title_en: "Suitability Principle",
    description:
      "Financial instruments business operators must assess and ensure suitability of products for customers. " +
      "Key inspection points: (1) Customer profiling must collect sufficient information on investment objectives, " +
      "risk tolerance, financial situation, and investment experience. " +
      "(2) Product governance must ensure complex or high-risk products are offered only to appropriate customers. " +
      "(3) Sales practices must not prioritise commissions over customer interests (fiduciary principles). " +
      "(4) Elderly customer policies must include enhanced safeguards against unsuitable sales. " +
      "(5) Complaint data must be analysed to identify systemic suitability issues. " +
      "The FSA's customer-focused supervision approach (顧客本位の業務運営) requires all operators " +
      "to demonstrate how they are improving customer outcomes.",
    standard_level: "Required",
    priority: "High",
  },
  {
    category_id: "fsa-sup-sec",
    item_ref: "FSA-SUP-SEC-CRYPTO-5.1",
    domain: "Crypto-Asset Exchange",
    subdomain: "Customer Asset Protection",
    title_ja: "暗号資産交換業者における利用者保護",
    title_en: "Customer Protection at Crypto-Asset Exchange Operators",
    description:
      "Registered crypto-asset exchange operators must maintain robust customer protection measures. " +
      "Key inspection points: (1) Customer assets (crypto and fiat) must be segregated from operator assets " +
      "and held in cold wallets or equivalent secure custody for at least 95% of crypto holdings. " +
      "(2) Regular audits of customer asset reconciliation must be conducted and results reported to the FSA. " +
      "(3) System security must meet FSA cyber security guideline standards with emphasis on wallet security. " +
      "(4) Operators must maintain a reserve fund adequate to cover customer losses from cyber incidents. " +
      "(5) Marketing must be fair and not target retail customers with misleading risk disclosures. " +
      "The FSA significantly tightened crypto regulation following the 2018 Coincheck and 2019 Bitpoint incidents.",
    standard_level: "Required",
    priority: "High",
  },

  // IT Inspection
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-OUTSCR-6.1",
    domain: "IT Outsourcing",
    subdomain: "Cloud Services",
    title_ja: "クラウドサービスの利用に係る管理",
    title_en: "Cloud Service Adoption and Risk Management",
    description:
      "The FSA examines whether banks manage risks arising from cloud service adoption appropriately. " +
      "Key inspection points: (1) Cloud adoption must have board-level approval with documented risk assessment. " +
      "(2) Core banking system migration to cloud requires FSA consultation prior to implementation. " +
      "(3) Data residency requirements: personal data of Japanese customers should preferably be stored in Japan " +
      "unless adequate cross-border transfer safeguards are in place. " +
      "(4) Multi-cloud or hybrid arrangements must have documented security architecture reviewed by internal audit. " +
      "(5) Exit strategies from cloud providers must be documented and tested. " +
      "(6) Concentration risk from hyperscaler dependency must be assessed and disclosed in risk reports to the board.",
    standard_level: "Guidance",
    priority: "Medium",
  },
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-RISK-3.1",
    domain: "Risk Management",
    subdomain: "Operational Risk",
    title_ja: "オペレーショナル・リスクの管理態勢",
    title_en: "Operational Risk Management Framework",
    description:
      "The FSA examines whether the bank has a sound operational risk management framework. " +
      "Key inspection points: (1) An operational risk management framework aligned with Basel Committee " +
      "Principles for the Sound Management of Operational Risk must be in place. " +
      "(2) Operational risk events must be collected, categorised, and analysed to identify root causes. " +
      "(3) Key risk indicators (KRIs) must be defined and monitored with breach escalation procedures. " +
      "(4) The bank must participate in external operational loss data collection (e.g., ORX). " +
      "(5) Operational risk capital requirements under the standardised approach must be correctly calculated. " +
      "(6) Business continuity plans must be tested annually and cover pandemic, cyber, and natural disaster scenarios.",
    standard_level: "Required",
    priority: "High",
  },
  {
    category_id: "fsa-sup-bank",
    item_ref: "FSA-SUP-BANK-FINTECH-7.1",
    domain: "Fintech and Innovation",
    subdomain: "Open Banking and API",
    title_ja: "オープンAPIへの対応",
    title_en: "Open Banking and API Management",
    description:
      "Banks must manage risks arising from open banking API arrangements with fintech partners. " +
      "Key inspection points: (1) API security must meet FSA cyber security guideline standards including " +
      "OAuth 2.0 authentication, TLS 1.2 minimum, rate limiting, and forensic-grade logging. " +
      "(2) Third-party fintech providers accessing bank systems via API must be registered Electronic Payment " +
      "Service Providers (EPSPs) under the Banking Act. " +
      "(3) Customer consent management for data sharing must be explicit and revocable at any time. " +
      "(4) Incident response procedures must cover API-specific scenarios including data leakage and abuse. " +
      "(5) API-related customer complaints must be tracked and analysed separately.",
    standard_level: "Guidance",
    priority: "Medium",
  },
];

const insertInspection = db.prepare(
  "INSERT OR IGNORE INTO inspections " +
    "(category_id, item_ref, domain, subdomain, title_ja, title_en, description, standard_level, priority) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const i of inspections) {
  insertInspection.run(
    i.category_id, i.item_ref, i.domain, i.subdomain, i.title_ja, i.title_en,
    i.description, i.standard_level, i.priority,
  );
}
console.log(`Inserted ${inspections.length} inspection items`);

// --- Guidance Documents -------------------------------------------------------

interface GuidelineRow {
  reference: string;
  title_ja: string;
  title_en: string;
  date: string;
  category: string;
  summary: string;
  full_text: string;
  source_url: string;
  status: string;
}

const guidelines: GuidelineRow[] = [
  {
    reference: "FSA-GD-2024-CYBER-001",
    title_ja: "金融分野におけるサイバーセキュリティに関するガイドライン",
    title_en: "Guidelines on Cyber Security in the Financial Sector (2024)",
    date: "2024-10-01",
    category: "Cyber Security",
    summary:
      "Comprehensive FSA cyber security guidelines establishing minimum standards for all supervised financial " +
      "institutions including risk-based governance, threat intelligence, incident response, and supply chain risk.",
    full_text:
      "FSA Guidelines on Cyber Security in the Financial Sector (2024). " +
      "Issued by the Financial Services Agency of Japan (金融庁). Effective: October 2024. " +
      "These guidelines replace and consolidate prior FSA cyber security guidance. " +
      "Scope: All banks, insurance companies, securities firms, crypto-asset exchange operators, " +
      "and other financial institutions registered or licensed under FSA supervision. " +
      "Chapter 1 — Governance: Financial institutions must establish a cyber security governance framework " +
      "with clear board accountability. A designated executive (CISO or equivalent) must be responsible for " +
      "cyber security and must report to the board at least quarterly. " +
      "Chapter 2 — Risk Assessment: Institutions must conduct annual cyber risk assessments using recognised " +
      "frameworks (NIST CSF, ISO 27001, or FSA-endorsed equivalents) and update threat models to reflect the " +
      "current threat landscape including nation-state actors and ransomware groups targeting Japanese financial institutions. " +
      "Chapter 3 — Technical Controls: Minimum requirements include multi-factor authentication for all privileged " +
      "access, network segmentation between internet-facing and core banking systems, EDR deployment on all endpoints, " +
      "and SIEM with 24x7 monitoring capability. Vulnerability management must remediate critical vulnerabilities " +
      "in internet-facing systems within 14 days. " +
      "Chapter 4 — Incident Response: Institutions must maintain a tested cyber incident response plan. " +
      "The FSA must be notified within 3 hours of detecting a significant cyber incident. " +
      "Significant incidents are defined as those affecting system availability, data integrity, " +
      "customer data security, or having systemic implications. " +
      "Chapter 5 — Third-Party and Supply Chain Risk: See FSA-CYBER-2024-SC-3. " +
      "Chapter 6 — Sector Information Sharing: Institutions must participate in designated sector " +
      "information sharing mechanisms for cyber threat intelligence.",
    source_url: "https://www.fsa.go.jp/news/r6/cyber/20241001.html",
    status: "active",
  },
  {
    reference: "FSA-GD-2024-AML-001",
    title_ja: "マネー・ローンダリング及びテロ資金供与対策に関するガイドライン（2024年改訂）",
    title_en: "Guidelines on Anti-Money Laundering and Combating the Financing of Terrorism (2024 revision)",
    date: "2024-03-01",
    category: "AML/CFT",
    summary:
      "Updated FSA AML/CFT guidelines reflecting FATF follow-up recommendations after Japan's 2021 mutual " +
      "evaluation, with enhanced requirements for customer due diligence, transaction monitoring, and sanctions screening.",
    full_text:
      "FSA Guidelines on Anti-Money Laundering and Combating the Financing of Terrorism (2024 revision). " +
      "Issued by the Financial Services Agency of Japan (金融庁). Effective: March 2024. " +
      "These guidelines reflect Japan's response to the FATF Follow-Up Report (2023) and strengthen " +
      "AML/CFT requirements across the financial sector. " +
      "Part I — Risk-Based Approach: All financial institutions must conduct an institutional money laundering " +
      "and terrorist financing (ML/TF) risk assessment at least annually. The risk assessment must consider " +
      "customer risk, product/service risk, geographic risk, and delivery channel risk. " +
      "Board approval of the risk assessment and the AML/CFT programme is mandatory. " +
      "Part II — Customer Due Diligence: Enhanced requirements effective April 2024 include: " +
      "(1) Mandatory beneficial ownership verification for all legal entity customers to the ultimate natural person " +
      "holding 25% or more of ownership or control. " +
      "(2) PEP screening at onboarding and on a periodic basis using commercially available screening tools. " +
      "(3) Adverse media screening as part of enhanced due diligence. " +
      "(4) Periodic CDD refresh: high-risk customers annually, standard customers every 3 years. " +
      "Part III — Transaction Monitoring: Institutions must implement transaction monitoring systems " +
      "calibrated to their risk profile. Alert coverage must extend to unusual cash transactions, " +
      "structuring, high-risk corridor transfers, and patterns inconsistent with customer profiles. " +
      "Backtesting of monitoring rules must be conducted annually. " +
      "Part IV — Sanctions Compliance: Real-time sanctions screening against Japanese government (METI/MoFA) " +
      "lists, UN Security Council lists, and OFAC SDN list is required. " +
      "Part V — Governance: A designated Money Laundering Reporting Officer (MLRO) must be appointed " +
      "with direct board access. The MLRO must report STR statistics and programme performance quarterly.",
    source_url: "https://www.fsa.go.jp/common/law/amlcft/index.html",
    status: "active",
  },
  {
    reference: "FSA-GD-2023-CLOUD-001",
    title_ja: "金融機関のクラウドサービス利用に関する監督上の考え方",
    title_en: "Supervisory Approach to Cloud Service Adoption by Financial Institutions",
    date: "2023-07-15",
    category: "IT Governance",
    summary:
      "FSA guidance on supervisory expectations for cloud service adoption by financial institutions, " +
      "covering risk assessment, data residency, outsourcing oversight, and concentration risk.",
    full_text:
      "FSA Supervisory Approach to Cloud Service Adoption by Financial Institutions (2023). " +
      "Financial Services Agency of Japan (金融庁). " +
      "This guidance sets out the FSA's supervisory approach when financial institutions adopt cloud services. " +
      "It does not prohibit cloud adoption but establishes expectations for sound risk management. " +
      "1. Governance: Board approval is required for material cloud adoption decisions. " +
      "Cloud strategy must be integrated into IT strategic planning and reviewed at least annually. " +
      "2. Risk Assessment: A formal risk assessment must be completed before any significant cloud migration. " +
      "The assessment must address: data security and confidentiality; availability and resilience; " +
      "compliance with applicable laws (Act on Protection of Personal Information); auditability; " +
      "exit risk and vendor lock-in; and concentration risk. " +
      "3. Data Residency: The FSA does not mandate Japan-only data residency but expects institutions " +
      "to assess cross-border data transfer risks and ensure compliance with APPI transfer requirements. " +
      "Customer consent or equivalent safeguards are required for cross-border personal data transfers. " +
      "4. Outsourcing Oversight: Cloud providers are treated as material outsourcing arrangements. " +
      "Contracts must include audit rights, incident notification (within 3 hours for significant events), " +
      "data return on termination, and sub-processor disclosure. " +
      "5. Operational Resilience: Institutions must ensure cloud arrangements do not compromise " +
      "their ability to meet recovery time objectives (RTOs) for critical systems. " +
      "Multi-cloud or hybrid strategies are encouraged to reduce single-provider concentration risk. " +
      "6. FSA Notification: Institutions planning to migrate core banking systems to public cloud " +
      "must consult with the FSA in advance.",
    source_url: "https://www.fsa.go.jp/news/r5/ginkou/cloud-guidance-2023.html",
    status: "active",
  },
  {
    reference: "FSA-GD-2024-ESG-001",
    title_ja: "気候関連リスクの金融機関向け監督指針",
    title_en: "Supervisory Guidelines on Climate-Related Risks for Financial Institutions",
    date: "2024-06-01",
    category: "Risk Management",
    summary:
      "FSA guidance on supervisory expectations for climate-related risk management and disclosure " +
      "by major banks and insurance companies, aligned with TCFD recommendations and Basel Committee guidance.",
    full_text:
      "FSA Supervisory Guidelines on Climate-Related Risks for Financial Institutions (2024). " +
      "Financial Services Agency of Japan (金融庁). Effective: June 2024. " +
      "These guidelines apply to major banks (major bank groups and regional banks) and large insurance companies. " +
      "1. Governance: The board must demonstrate oversight of climate-related risks. " +
      "Climate risk must be integrated into the institution's risk taxonomy and enterprise risk management framework. " +
      "A senior executive must be accountable for climate risk management. " +
      "2. Risk Assessment: Institutions must assess both physical risks (acute events: floods, typhoons; " +
      "chronic: sea-level rise, temperature change) and transition risks (policy, technology, market, reputational). " +
      "Climate scenario analysis using 1.5°C and 3°C scenarios (aligned with NGFS) is required annually. " +
      "3. Disclosure: Major banks and insurance companies must publish TCFD-aligned climate disclosures. " +
      "From 2025, disclosures must comply with ISSB IFRS S2 Climate Standard as adopted in Japan. " +
      "4. Credit Risk: Lending portfolios must be assessed for climate-related credit risk. " +
      "Counterparty transition plans must be evaluated as part of credit due diligence for material exposures. " +
      "5. Transition Finance: Institutions engaged in transition finance must have policies for " +
      "assessing credibility of transition plans and avoiding greenwashing.",
    source_url: "https://www.fsa.go.jp/news/r6/climate/supervisory-guidelines-2024.html",
    status: "active",
  },
  {
    reference: "FSA-GD-2023-FINTECH-001",
    title_ja: "電子決済等代行業者の登録に関する監督指針",
    title_en: "Supervisory Guidelines for Registration of Electronic Payment Service Providers",
    date: "2023-04-01",
    category: "Fintech",
    summary:
      "FSA guidelines for electronic payment service providers (EPSPs) under the Banking Act, " +
      "covering registration requirements, API security, customer protection, and FSA notification obligations.",
    full_text:
      "FSA Supervisory Guidelines for Registration of Electronic Payment Service Providers (EPSPs) (2023). " +
      "Financial Services Agency of Japan (金融庁). " +
      "Electronic Payment Service Providers (電子決済等代行業者) — fintechs that access bank accounts " +
      "via bank APIs — must register with the FSA under Article 52-61 of the Banking Act. " +
      "Registration Requirements: " +
      "(1) Minimum capital: ¥10 million. (2) Fit-and-proper assessment of directors and major shareholders. " +
      "(3) Information security management system (ISMS) equivalent to ISO 27001 or equivalent. " +
      "(4) Signed API agreements with at least one licensed bank prior to registration. " +
      "Operational Requirements: " +
      "Registered EPSPs must maintain: (1) API security controls meeting bank API security standards. " +
      "(2) Customer authentication using bank-delegated authentication or equivalent strong authentication. " +
      "(3) Customer consent records for each data access or payment initiation. " +
      "(4) Incident notification to the FSA within 24 hours of a significant security incident. " +
      "(5) Annual security assessment and submission of results to the FSA on request. " +
      "Customer Protection: EPSPs must disclose their registration status, services, and data handling practices. " +
      "They must not retain bank credentials and must implement appropriate data minimisation. " +
      "Liability for customer losses from security incidents involving EPSP systems lies with the EPSP unless " +
      "the bank is at fault.",
    source_url: "https://www.fsa.go.jp/common/law/epsp-guidelines-2023.html",
    status: "active",
  },
];

const insertGuideline = db.prepare(
  "INSERT OR IGNORE INTO guidelines (reference, title_ja, title_en, date, category, summary, full_text, source_url, status) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const g of guidelines) {
  insertGuideline.run(
    g.reference, g.title_ja, g.title_en, g.date, g.category, g.summary, g.full_text, g.source_url, g.status,
  );
}
console.log(`Inserted ${guidelines.length} guidance documents`);

// --- Summary ------------------------------------------------------------------

const cc = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
const ic = (db.prepare("SELECT COUNT(*) AS n FROM inspections").get() as { n: number }).n;
const gc = (db.prepare("SELECT COUNT(*) AS n FROM guidelines").get() as { n: number }).n;

console.log(`
Database summary:
  Categories        : ${cc}
  Inspection Items  : ${ic}
  Guidance Documents: ${gc}

Seed complete.`);
