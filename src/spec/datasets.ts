import type { ApiCatalog, ParamDef } from "@bio-mcp/shared/codemode/catalog";

export const nativeSortParams: ParamDef[] = [
  { name: "sorts[0][property]", type: "string", required: false, description: "Native field to sort; additional sorts[i] indices accepted. Singular sort is rejected because DKAN silently ignores it." },
  { name: "sorts[0][order]", type: "string", required: false, description: "Native sort direction.", enum: ["asc", "desc"] },
];
export const nativeProjectionParams: ParamDef[] = [
  { name: "properties[0]", type: "string", required: false, description: "Native column to return; add properties[1], properties[2], etc. Omit for all fields. Projection loses omitted date/unit context; keys is not a comma-separated column selector." },
];

const expected: ParamDef = { name: "expected_metadata_sha256", type: "string", required: false, description: "Optional metadata SHA-256 from a previous observation; mismatch fails with 409. Does not pin row content or retrieve a historical snapshot." };
export const datasetEndpoints: ApiCatalog["endpoints"] = [
  { method: "GET", path: "/nadac/comparison", summary: "Native NADAC Comparison rows: replaced rates between two reference files. Does not include every new or terminated NDC. Retain start_date, end_date and effective_date separately.", category: "nadac", queryParams: [
    { name: "limit", type: "number", required: false, description: "Native DKAN page size; use 50 for discovery." },
    { name: "offset", type: "number", required: false, description: "Native DKAN offset." },
    { name: "conditions[0][property]", type: "string", required: false, description: "Native field name from the response schema; e.g. ndc." },
    { name: "conditions[0][value]", type: "string", required: false, description: "Exact filter value. Preserve NDC leading zeros." },
    { name: "conditions[0][operator]", type: "string", required: false, description: "Native lowercase DKAN operator, e.g. =." },
    ...nativeSortParams, ...nativeProjectionParams,
  ] },
  { method: "GET", path: "/datasets/{dataset_id}/metadata", summary: "Read full native Medicaid DKAN dataset metadata, distribution references and a canonical metadata hash. Dataset UUIDs remain stable while distributions may change.", category: "dataset_evidence", pathParams: [
    { name: "dataset_id", type: "string", required: true, description: "Canonical lowercase UUID on data.medicaid.gov. Comparison: a217613c-12bc-5137-8b3a-ada0e4dad1ff; NADAC 2026: fbb83258-11c7-47f5-8b18-5f8e79f7e704." },
  ], queryParams: [expected] },
  { method: "GET", path: "/datasets/{dataset_id}/page", summary: "Read a bounded full-row page bracketed by metadata reads; fails on identity or metadata drift. Returns native envelope and full metadata, preserving dates, units, suppression flags and unknown fields. No price conversion or reimbursement inference.", category: "dataset_evidence", pathParams: [
    { name: "dataset_id", type: "string", required: true, description: "Canonical lowercase Medicaid dataset UUID." },
  ], queryParams: [expected,
    { name: "distribution_index", type: "number", required: false, description: "0–99, default 0. Must exist in current metadata; retain the selected distribution reference." },
    { name: "limit", type: "number", required: false, description: "1–500, default 50." },
    { name: "offset", type: "number", required: false, description: "0–10000000, default 0. Pagination is not an atomic snapshot." },
    { name: "conditions[0][property]", type: "string", required: false, description: "Native field to filter. Additional flat conditions indices accepted. Column projection is rejected to retain row context." },
    { name: "conditions[0][value]", type: "string", required: false, description: "Native filter value; keep NDCs as strings." },
    { name: "conditions[0][operator]", type: "string", required: false, description: "Native lowercase DKAN operator." },
    ...nativeSortParams,
  ] },
];

export const datasetWorkflows: ApiCatalog["workflows"] = [{
  title: "Discover NADAC Comparison and retain its release context",
  keywords: ["NADAC", "comparison", "effective date", "metadata", "replaced rates"],
  description: "Read metadata before a full-row comparison page. Start/end dates refer to the compared files; effective_date refers to the new rate. Missing pricing units remain unknown. This is not a complete NDC change log.",
  code: 'const id = "a217613c-12bc-5137-8b3a-ada0e4dad1ff";\nconst discovery = await api.get(`/datasets/${id}/metadata`);\nif (discovery.__staged || discovery.__api_error) return discovery;\nreturn await api.get(`/datasets/${id}/page`, {limit: 50, expected_metadata_sha256: discovery._medicaid.metadata_sha256});',
}, {
  title: "Read an exact NDC with its native NADAC units and dates",
  keywords: ["NDC", "pricing_unit", "corresponding generic", "as_of_date", "NADAC"],
  description: "Replace the example NDC with an 11-digit string. Retain pricing_unit (ML/GM/EA), effective_date, corresponding_generic_drug_effective_date and as_of_date separately. NADAC is acquisition cost, not a reimbursement amount.",
  code: 'return await api.get("/datasets/fbb83258-11c7-47f5-8b18-5f8e79f7e704/page", {"conditions[0][property]": "ndc", "conditions[0][value]": "00012345678", "conditions[0][operator]": "=", limit: 50});',
}];

export const datasetNotes = "\n- /nadac/comparison uses a217613c-12bc-5137-8b3a-ada0e4dad1ff. It contains replaced rates, not all newly added/terminated NDCs; CMS publishes First Time NADAC Rates separately.\n- /datasets/{dataset_id}/metadata and /page are local evidence helpers. Full native fields are retained; metadata checks do not establish an atomic snapshot or verify distribution-file checksums.\n- Preserve native pricing units and dates. Corresponding-generic effective dates can differ from the generic product's effective date. Do not infer reimbursement amounts, missing units, or rate-setting classification from MDRP drug categories.";
