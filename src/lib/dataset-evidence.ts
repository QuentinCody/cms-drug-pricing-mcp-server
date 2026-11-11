import { datasetRead, digest, fail, queryUrl } from "./dataset-http";

function integer(value: unknown, name: string, min: number, max: number): number {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+$/.test(String(value))) fail(`Invalid ${name}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) fail(`Invalid ${name}`);
  return number;
}

function controls(params: Record<string, unknown>, page: boolean) {
  const { expected_metadata_sha256: expected, distribution_index: index = 0, ...query } = params;
  if (expected !== undefined && (typeof expected !== "string" || !/^[a-f0-9]{64}$/i.test(expected))) fail("Expected metadata SHA-256 must have 64 hexadecimal characters");
  const distribution = integer(index, "distribution_index", 0, 99);
  if (!page && (Object.keys(query).length || params.distribution_index !== undefined)) fail("Unsupported metadata parameter");
  if (page) {
    for (const key of Object.keys(query)) {
      if (!/^(limit|offset|conditions\[\d+\]\[(property|value|operator)\]|sorts\[\d+\]\[(property|order)\])$/.test(key)) fail(`Unsupported full-row page parameter: ${key}. Use sorts[i] for ordering; column projection is unavailable on full-row pages.`);
    }
    query.limit = integer(query.limit ?? 50, "limit", 1, 500);
    query.offset = integer(query.offset ?? 0, "offset", 0, 10000000);
    queryUrl("/", query); // Validate before making any network request.
  }
  return { expected, distribution, query };
}

async function metadata(id: string, deadline: number) {
  const response = await datasetRead(`/api/1/metastore/schemas/dataset/items/${id}`, { "show-reference-ids": "" }, deadline);
  const data = response.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || !("identifier" in data) || data.identifier !== id || !("distribution" in data) || !Array.isArray(data.distribution)) fail("Medicaid metadata identity/distribution mismatch", 502);
  return { ...response, data, distributions: data.distribution, metadata_sha256: await digest(data), observed_at: new Date().toISOString() };
}

function rowsFrom(data: unknown): unknown[] {
  if (data && typeof data === "object" && "results" in data && Array.isArray(data.results)) return data.results;
  fail("Medicaid data response has no results array", 502);
}

export async function datasetEvidence(id: string, page: boolean, params: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) fail("Invalid Medicaid dataset UUID");
  const { expected, distribution, query } = controls(params, page);
  const deadline = Date.now() + 15000;
  const before = await metadata(id, deadline);
  if (expected !== undefined && String(expected).toLowerCase() !== before.metadata_sha256) fail("Medicaid metadata changed from requested version", 409);
  const observation = { dataset_id: id, metadata_sha256: before.metadata_sha256, metadata_url: before.source_url, observed_before: before.observed_at, historical_snapshot: false, atomic_snapshot: false };
  if (!page) return { status: before.status, data: { metadata: before.data, _medicaid: observation } };
  const selected = before.distributions[distribution];
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) fail("Requested distribution is absent from metadata", 502);
  const response = await datasetRead(`/api/1/datastore/query/${id}/${distribution}`, query, deadline);
  const rows = rowsFrom(response.data);
  const after = await metadata(id, deadline);
  if (before.metadata_sha256 !== after.metadata_sha256) fail("Medicaid metadata changed during this read; discard the page and retry", 409);
  return { status: response.status, data: { native: response.data, metadata: before.data, _medicaid: {
    ...observation, distribution_index: distribution, distribution: selected, source_url: response.source_url,
    observed_after: after.observed_at, request: query, rows_returned: rows.length, complete: false,
    response_sha256: await digest(response.data),
    hash_scope: "Complete parsed native page with recursively sorted object keys; includes rows, count, schema and query. Distinct from metadata_sha256.",
    next_offset_candidate: rows.length === query.limit ? Number(query.offset) + rows.length : null,
    consistency: "Metadata was stable across this read; rows are not an atomic or immutable snapshot. Retain expected_metadata_sha256 on continuation. Native count is not assumed to be total dataset size.",
  } } };
}
