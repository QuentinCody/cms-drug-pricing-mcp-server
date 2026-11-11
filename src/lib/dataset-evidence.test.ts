import { afterEach, expect, it, vi } from "vitest";
import { createDrugPricingApiFetch } from "./api-adapter";
import { datasetEvidence } from "./dataset-evidence";
import { digest } from "./dataset-http";

const id = "a217613c-12bc-5137-8b3a-ada0e4dad1ff";
const metadata = { identifier: id, title: "NADAC Comparison", modified: "2026-09-23", distribution: [{ identifier: "distribution-v1", downloadURL: "https://download.example/fixture.csv" }] };
const row = { ndc: "00012345678", old_nadac_per_unit: "0.0100", new_nadac_per_unit: "0.0200", start_date: "2026-09-16", end_date: "2026-09-23", effective_date: "2026-09-18", future_field: "retain" };

function mock(...values: unknown[]) {
  const fetcher = vi.fn();
  for (const value of values) fetcher.mockResolvedValueOnce(Response.json(value));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());

it("retains full native rows, metadata, distribution and distinct date semantics", async () => {
  const native = { results: [row], count: 1, schema: { fields: ["ndc"] }, query: { native: true } };
  const fetcher = mock(metadata, native, metadata);
  const result = await datasetEvidence(id, true, { limit: 1 });
  expect(result.data).toMatchObject({ native, metadata, _medicaid: { dataset_id: id, distribution_index: 0, distribution: metadata.distribution[0], complete: false, atomic_snapshot: false, historical_snapshot: false, rows_returned: 1, next_offset_candidate: 1, metadata_sha256: await digest(metadata) } });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(new URL(fetcher.mock.calls[1][0]).pathname).toBe(`/api/1/datastore/query/${id}/0`);
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.has("show-reference-ids")).toBe(true);
});

it("retains units and corresponding-generic dates without deriving price values", async () => {
  const full = { ...row, pricing_unit: "ML", nadac_per_unit: "2.00000", corresponding_generic_drug_nadac_per_unit: "1.02000", corresponding_generic_drug_effective_date: "2026-08-12", as_of_date: "2026-09-23" };
  mock(metadata, { results: [full] }, metadata);
  expect((await datasetEvidence(id, true, {})).data).toMatchObject({ native: { results: [full] } });
});

it("discovers metadata and accepts its hash for a continuation read", async () => {
  const hash = await digest(metadata);
  mock(metadata);
  expect((await datasetEvidence(id, false, { expected_metadata_sha256: hash.toUpperCase() })).data).toMatchObject({ metadata, _medicaid: { metadata_sha256: hash } });
});

it("rejects a stale expected hash before reading rows", async () => {
  const fetcher = mock(metadata);
  await expect(datasetEvidence(id, true, { expected_metadata_sha256: "0".repeat(64) })).rejects.toMatchObject({ status: 409, data: { error: { status: 409, code: "MEDICAID_REQUEST_ERROR" } } });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("rejects metadata drift after a page", async () => {
  mock(metadata, { results: [row] }, { ...metadata, modified: "2026-09-30" });
  await expect(datasetEvidence(id, true, {})).rejects.toMatchObject({ status: 409 });
});

it.each([{ ...metadata, identifier: "wrong" }, { ...metadata, distribution: null }, []])("rejects incompatible dataset identity/metadata %#", async data => {
  mock(data);
  await expect(datasetEvidence(id, false, {})).rejects.toMatchObject({ status: 502 });
});

it("does not query a distribution absent from current metadata", async () => {
  const fetcher = mock(metadata);
  await expect(datasetEvidence(id, true, { distribution_index: 1 })).rejects.toMatchObject({ status: 502 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([{ keys: "ndc" }, { "properties[0]": "ndc" }, { "sort[0][property]": "as_of_date" }, { limit: 0 }, { limit: 501 }, { offset: -1 }, { offset: Number.POSITIVE_INFINITY }, { distribution_index: 100 }, { expected_metadata_sha256: "bad" }, { "conditions[0][value]": {} }])("rejects invalid/projection page controls before network access %#", async params => {
  const fetcher = mock();
  await expect(datasetEvidence(id, true, params)).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});

it("preserves flat filters and excludes local controls from provider queries", async () => {
  const fetcher = mock(metadata, { results: [] }, metadata);
  await datasetEvidence(id, true, { "conditions[0][value]": "00012345678", "sorts[0][property]": "as_of_date", "sorts[0][order]": "desc", expected_metadata_sha256: await digest(metadata), distribution_index: 0 });
  const url = new URL(fetcher.mock.calls[1][0]);
  expect(url.searchParams.get("conditions[0][value]")).toBe("00012345678");
  expect(url.searchParams.get("sorts[0][property]")).toBe("as_of_date");
  expect(url.searchParams.get("sorts[0][order]")).toBe("desc");
  expect(url.searchParams.has("expected_metadata_sha256")).toBe(false);
  expect(url.searchParams.has("distribution_index")).toBe(false);
});

it("adds comparison while retaining the 2026 raw route and native envelopes", async () => {
  const fetcher = mock({ results: [row] }, { results: [] });
  const api = createDrugPricingApiFetch();
  expect(await api({ method: "GET", path: "/nadac/comparison", params: { limit: 1 } })).toMatchObject({ data: { results: [row] } });
  await api({ method: "GET", path: "/nadac/current" });
  expect(String(fetcher.mock.calls[0][0])).toContain(id);
  expect(String(fetcher.mock.calls[1][0])).toContain("fbb83258-11c7-47f5-8b18-5f8e79f7e704");
});

it("rejects writes, GET bodies and invalid IDs", async () => {
  const api = createDrugPricingApiFetch();
  await expect(api({ method: "POST", path: "/nadac/current" })).rejects.toMatchObject({ status: 405 });
  await expect(api({ method: "GET", path: "/nadac/current", body: {} })).rejects.toMatchObject({ status: 405 });
  await expect(datasetEvidence("../other", false, {})).rejects.toMatchObject({ status: 400 });
});

it("preserves native sorting/projection on raw routes and rejects silently ignored singular sort", async () => {
  const fetcher = mock({ results: [{ ndc: "00012345678", nadac_per_unit: "0.0100" }] });
  const api = createDrugPricingApiFetch();
  const params = { "sorts[0][property]": "ndc", "sorts[0][order]": "asc", "properties[0]": "ndc", "properties[1]": "nadac_per_unit" };
  const result = await api({ method: "GET", path: "/nadac/current", params });
  expect(result.data).toEqual({ results: [{ ndc: "00012345678", nadac_per_unit: "0.0100" }] });
  const url = new URL(fetcher.mock.calls[0][0]);
  for (const [key, value] of Object.entries(params)) expect(url.searchParams.get(key)).toBe(value);
  await expect(api({ method: "GET", path: "/nadac/current", params: { "sort[0][property]": "ndc" } })).rejects.toMatchObject({ status: 400 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
