import { datasetRead, digest, fail } from "./dataset-http";

function pageNumber(value: unknown, fallback: number, max: number, name: string): number {
  const number = value === undefined ? fallback : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 || number > max) fail(`${name} must be an integer from 1 to ${max}`);
  return number;
}

/** Discover identifiers via DKAN search; do not infer dataset identity from ranking. */
export async function searchDatasets(params: Record<string, unknown>) {
  const allowed = ["fulltext", "theme", "keyword", "page", "page-size"];
  if (Object.keys(params).some(key => !allowed.includes(key))) fail("Unsupported Medicaid dataset search parameter");
  const query: Record<string, unknown> = {
    page: pageNumber(params.page, 1, 10000, "page"),
    "page-size": pageNumber(params["page-size"], 10, 100, "page-size"),
  };
  for (const name of ["fulltext", "theme", "keyword"]) {
    const value = params[name];
    if (value === undefined) continue;
    if (typeof value !== "string" || !value.trim() || value.length > 500 || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) fail(`${name} must be a nonempty string of at most 500 characters without control characters`);
    query[name] = value;
  }
  const response = await datasetRead("/api/1/search", query, Date.now() + 15000);
  return {status: response.status, data: {
    native: response.data,
    _medicaid: {
      source_url: response.source_url, observed_at: new Date().toISOString(), request: query,
      response_sha256: await digest(response.data),
      hash_scope: "Complete parsed native search response with recursively sorted object keys; not dataset-row content",
      complete: false, historical_snapshot: false, atomic_snapshot: false,
      interpretation: "One current catalog search page. Ranking, titles and modified dates do not establish dataset identity, latest effective rates or a complete inventory. Inspect candidate identifiers and native metadata/distributions before using /datasets/{dataset_id}/page. Catalog search pages can change between requests; no automatic pagination or selection is performed.",
    },
  }};
}
