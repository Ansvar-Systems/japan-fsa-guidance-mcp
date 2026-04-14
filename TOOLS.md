# Tools — Japan FSA Financial Guidance MCP

All tools use the `jp_fsa_` prefix. Every response includes a `_meta` object with `disclaimer`, `data_age`, and `source_url`.

**Language note:** Search queries work in both Japanese and English. Japanese-language queries typically yield higher recall for FSA content since Japanese is the primary authoritative language.

---

## jp_fsa_search_guidance

Full-text search across FSA Japan supervisory guidelines, inspection items, and guidance documents. Covers both Japanese and English content.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query in Japanese or English (e.g., "サイバーセキュリティ", "cyber security", "AML/CFT") |
| `domain` | string | No | Filter by domain or category |
| `limit` | number | No | Max results (default 10, max 50) |

### Example Call

```json
{
  "name": "jp_fsa_search_guidance",
  "arguments": {
    "query": "cyber security incident response",
    "limit": 5
  }
}
```

### Example Response

```json
{
  "results": [
    {
      "type": "inspection",
      "item_ref": "FSA-CYBER-2024-001",
      "title_ja": "金融分野におけるサイバーセキュリティ強化に向けたガイドライン",
      "title_en": "Guidelines for Strengthening Cyber Security in the Financial Sector",
      "domain": "Cyber Security Governance",
      "summary": "The FSA 2024 Cyber Security Guidelines establish a comprehensive framework..."
    }
  ],
  "count": 1,
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.fsa.go.jp/en/refer/guide/"
  }
}
```

---

## jp_fsa_get_guideline

Get a specific FSA Japan guidance document or inspection item by its reference identifier.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | string | Yes | Inspection item reference (e.g., "FSA-CYBER-2024-001") or guidance reference (e.g., "FSA-GD-2024-AML-001") |

### Example Call

```json
{
  "name": "jp_fsa_get_guideline",
  "arguments": {
    "document_id": "FSA-CYBER-2024-001"
  }
}
```

### Example Response

```json
{
  "item_ref": "FSA-CYBER-2024-001",
  "title_ja": "金融分野におけるサイバーセキュリティ強化に向けたガイドライン",
  "title_en": "Guidelines for Strengthening Cyber Security in the Financial Sector",
  "domain": "Cyber Security Governance",
  "description": "The FSA 2024 Cyber Security Guidelines establish...",
  "_citation": {
    "canonical_ref": "FSA-CYBER-2024-001",
    "display_text": "FSA Japan — Guidelines for Strengthening Cyber Security in the Financial Sector (FSA-CYBER-2024-001)"
  },
  "_meta": {
    "disclaimer": "...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.fsa.go.jp/en/refer/guide/"
  }
}
```

Returns an error if the reference is not found, with a suggestion to use `jp_fsa_search_guidance`.

---

## jp_fsa_search_inspections

Search FSA Japan inspection manual items with optional category and domain filters.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query in Japanese or English (e.g., "リスク管理", "risk management") |
| `category` | string | No | Filter by category: `fsa-sup-bank`, `fsa-sup-ins`, `fsa-sup-sec`, `fsa-cyber-2024`, `fsa-aml` |
| `domain` | string | No | Filter by inspection domain |
| `limit` | number | No | Max results (default 10, max 50) |

### Example Call

```json
{
  "name": "jp_fsa_search_inspections",
  "arguments": {
    "query": "AML customer due diligence",
    "category": "fsa-aml",
    "limit": 5
  }
}
```

### Example Response

```json
{
  "results": [
    {
      "item_ref": "FSA-AML-CDD-2.1",
      "title_ja": "顧客管理（カスタマー・デュー・ディリジェンス）",
      "title_en": "Customer Due Diligence (CDD)",
      "domain": "AML/CFT",
      "standard_level": "Required",
      "summary": "Financial institutions must implement risk-based customer due diligence..."
    }
  ],
  "count": 1,
  "_meta": {
    "disclaimer": "...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.fsa.go.jp/en/refer/guide/"
  }
}
```

---

## jp_fsa_list_categories

List all FSA Japan guidance categories covered by this server.

### Parameters

None.

### Example Call

```json
{
  "name": "jp_fsa_list_categories",
  "arguments": {}
}
```

### Example Response

```json
{
  "categories": [
    {
      "id": "fsa-sup-bank",
      "name_ja": "主要行等向けの総合的な監督指針",
      "name_en": "Comprehensive Guidelines for Supervision of Major Banks",
      "version": "2024 (latest)",
      "effective_date": "2024-04-01",
      "item_count": 350,
      "domain": "Supervisory Guidelines"
    },
    {
      "id": "fsa-cyber-2024",
      "name_ja": "金融分野におけるサイバーセキュリティに関するガイドライン",
      "name_en": "Guidelines on Cyber Security in the Financial Sector",
      "version": "2024",
      "effective_date": "2024-10-01",
      "item_count": 85,
      "domain": "Cyber Security"
    }
  ],
  "count": 5,
  "_meta": {
    "disclaimer": "...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.fsa.go.jp/en/refer/guide/"
  }
}
```

---

## jp_fsa_about

Return metadata about this MCP server: version, data sources, coverage summary, and available tools.

### Parameters

None.

### Example Call

```json
{
  "name": "jp_fsa_about",
  "arguments": {}
}
```

### Example Response

```json
{
  "name": "japan-fsa-guidance-mcp",
  "version": "0.1.0",
  "description": "Financial Services Agency of Japan (金融庁) Financial Guidance MCP server...",
  "data_source": "Financial Services Agency of Japan (金融庁)",
  "source_url": "https://www.fsa.go.jp/en/refer/guide/",
  "coverage": {
    "categories": "5 FSA guidance categories",
    "inspections": "15 inspection manual items",
    "guidelines": "5 guidance documents",
    "jurisdictions": ["JP"],
    "sectors": ["Banking", "Insurance", "Securities", "Fintech"],
    "languages": ["ja", "en"]
  },
  "tools": [
    { "name": "jp_fsa_search_guidance", "description": "..." },
    { "name": "jp_fsa_get_guideline", "description": "..." },
    { "name": "jp_fsa_search_inspections", "description": "..." },
    { "name": "jp_fsa_list_categories", "description": "..." },
    { "name": "jp_fsa_about", "description": "..." },
    { "name": "jp_fsa_list_sources", "description": "..." }
  ],
  "_meta": {
    "disclaimer": "...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.fsa.go.jp/en/refer/guide/"
  }
}
```

---

## jp_fsa_list_sources

Return data provenance information: which FSA Japan sources are indexed, retrieval method, update frequency, and licensing terms.

### Parameters

None.

### Example Call

```json
{
  "name": "jp_fsa_list_sources",
  "arguments": {}
}
```

### Example Response

```json
{
  "sources_yml": "schema_version: \"1.0\"\nmcp_name: \"Japan FSA Financial Guidance MCP\"\n...",
  "note": "Data is sourced from official FSA Japan public publications. Japanese is the primary authoritative language. See sources.yml for full provenance.",
  "_meta": {
    "disclaimer": "...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.fsa.go.jp/en/refer/guide/"
  }
}
```
