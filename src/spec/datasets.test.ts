import { afterEach, expect, it, vi } from "vitest";
import { drugPricingCatalog } from "./catalog";
import { datasetWorkflows } from "./datasets";
import { createDrugPricingApiFetch } from "../lib/api-adapter";

afterEach(() => vi.unstubAllGlobals());

it.each(datasetWorkflows ?? [])("executes the documented recipe: $title", async workflow => {
  const fetcher = vi.fn(async (url: URL) => {
    const id = url.pathname.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/)?.[0];
    if (url.pathname.includes("metastore")) return Response.json({ identifier: id, distribution: [{ identifier: "fixture-distribution" }] });
    return Response.json({ results: [{ ndc: "00012345678", pricing_unit: "EA", effective_date: "2026-09-18" }] });
  });
  vi.stubGlobal("fetch", fetcher);
  const apiFetch = createDrugPricingApiFetch();
  const api = { get: async (path: string, params?: Record<string, unknown>) => (await apiFetch({ method: "GET", path, params })).data };
  // SAFETY: run checked-in recipe text only, with the mocked local adapter.
  const run = new Function("api", `return (async () => {${workflow.code}})()`);
  const result = await run(api);
  expect(result).toMatchObject({ native: { results: [{ ndc: "00012345678", pricing_unit: "EA", effective_date: "2026-09-18" }] }, _medicaid: { atomic_snapshot: false } });
  expect(drugPricingCatalog.endpointCount).toBe(drugPricingCatalog.endpoints.length);
  const dataCall = fetcher.mock.calls.find(([url]) => url.pathname.includes("datastore"));
  expect(dataCall?.[0].searchParams.has("keys")).toBe(false);
});

it.each([{ __staged: true, data_access_id: "fixture" }, { __api_error: true, status: 429, data: { message: "retry" } }])("returns a metadata handle/error instead of dereferencing missing fields %#", async handle => {
  const api = { get: vi.fn().mockResolvedValue(handle) };
  const workflow = datasetWorkflows?.[0];
  if (!workflow) throw new Error("Missing discovery recipe");
  // SAFETY: checked-in recipe with a local staged-handle fixture.
  const run = new Function("api", `return (async () => {${workflow.code}})()`);
  expect(await run(api)).toBe(handle);
  expect(api.get).toHaveBeenCalledTimes(1);
});
