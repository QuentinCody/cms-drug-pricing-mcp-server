import { afterEach, expect, it, vi } from "vitest";
import { createDrugPricingApiFetch } from "./api-adapter";
import { digest } from "./dataset-http";
import { FIRST_TIME_NADAC_ID } from "./first-time";
import { firstTimeWorkflow } from "../spec/first-time";

const metadata = { identifier: FIRST_TIME_NADAC_ID, title: "First Time NADAC Rates", distribution: [{ identifier: "native-distribution" }] };
const row = { drug_product: "EXAMPLE 5 MG TABLET", nadac_rate: "0.01000", package_size: "3 X 100", ncpdp_billing_unit_standard: "EA", primary_reason_code: "New on COD File", classification_for_rate_setting: "Brand", as_of_date: "2026-09-23", number_of_active_ndcs_within_the_rategroup_that_are_on_the__0bb0: "02", future_field: { keep: true } };
const native = { results: [row], count: 1, schema: { future_schema: true }, query: { count: true } };
const api = createDrugPricingApiFetch();
afterEach(() => vi.unstubAllGlobals());

it("reads the verified dataset with a metadata guard and preserves rate-group semantics", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(metadata)).mockResolvedValueOnce(Response.json(native)).mockResolvedValueOnce(Response.json(metadata));
  vi.stubGlobal("fetch", fetcher);
  const result = await api({ method: "GET", path: "/nadac/first-time", params: { expected_metadata_sha256: await digest(metadata), limit: 10 } });
  expect(result).toMatchObject({ status: 200, data: { native, metadata, _medicaid: { response_sha256: await digest(native), metadata_sha256: await digest(metadata), complete: false },
    _first_time_nadac: { record_unit: "drug rate group, not an individual NDC", dictionary_caveat: expect.stringContaining("differ from observed") } } });
  expect(new URL(fetcher.mock.calls[1][0]).pathname).toBe(`/api/1/datastore/query/${FIRST_TIME_NADAC_ID}/0`);
});

it("executes the month recipe with explicit as_of_date and metadata evidence", async () => {
  const fetcher = vi.fn(async (url: URL) => Response.json(url.pathname.includes("metastore") ? metadata : native));
  vi.stubGlobal("fetch", fetcher);
  const run = new Function("api", `return (async () => {${firstTimeWorkflow.code}})()`);
  const result = await run({ get: async (path: string, params?: Record<string, unknown>) => (await api({ method: "GET", path, params })).data });
  expect(result).toMatchObject({ native, metadata });
  const url = new URL(fetcher.mock.calls.find(([url]) => url.pathname.includes("datastore"))![0]);
  expect(url.searchParams.get("conditions[0][property]")).toBe("as_of_date");
  expect(url.searchParams.get("conditions[0][value]")).toBe("2026-09-23");
  expect(url.searchParams.get("conditions[0][operator]")).toBe("=");
  expect(url.searchParams.has("expected_metadata_sha256")).toBe(false);
});

it.each([{ __staged: true, data_access_id: "fixture" }, { __api_error: true, status: 503 }])("does not dereference unresolved metadata %#", async handle => {
  const api = { get: vi.fn().mockResolvedValue(handle) };
  const run = new Function("api", `return (async () => {${firstTimeWorkflow.code}})()`);
  expect(await run(api)).toBe(handle);
  expect(api.get).toHaveBeenCalledTimes(1);
});

it.each(["constructor", "toString", "__proto__"])("does not dispatch inherited route %s", async path => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(api({ method: "GET", path })).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});
