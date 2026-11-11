import {afterEach, expect, it, vi} from "vitest";
import {createApiProxyTool} from "@bio-mcp/shared/tools/api-proxy";
import {createDrugPricingApiFetch} from "./api-adapter";
import {digest} from "./dataset-http";
import {drugPricingCatalog} from "../spec/catalog";
import {datasetSearchWorkflow} from "../spec/dataset-search";

// Synthetic search metadata: no current provider dataset ID or row schema is inferred.
const native = {results: [{identifier: "12345678-1234-1234-1234-123456789abc", title: "First Time NADAC Rates", modified: "2026-09-22", distribution: [{identifier: "fixture-distribution", downloadURL: "https://example.invalid/fixture.csv"}]}], total: 17, facets: {theme: ["Drug Pricing and Payment"]}, future_field: {retain: true}, _medicaid: {provider: true}};
const request = (params = {}) => ({method: "GET", path: "/datasets/search", params});
const api = createDrugPricingApiFetch();
afterEach(() => vi.unstubAllGlobals());

it("queries native one-based search and preserves all metadata, facets and provider fields", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(native)); vi.stubGlobal("fetch", fetcher);
  const result = await api(request({fulltext: "First Time NADAC Rates"}));
  expect(result).toMatchObject({status: 200, data: {native, _medicaid: {response_sha256: await digest(native), complete: false, atomic_snapshot: false, historical_snapshot: false}}});
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.origin + url.pathname).toBe("https://data.medicaid.gov/api/1/search");
  expect(Object.fromEntries(url.searchParams)).toEqual({page: "1", "page-size": "10", fulltext: "First Time NADAC Rates"});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("preserves filter text and passes native page-size/page names without double encoding", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(native)); vi.stubGlobal("fetch", fetcher);
  await api(request({fulltext: "A&B+NADAC", theme: "Drug Pricing and Payment", keyword: "National Average Drug Acquisition Cost (NADAC)", page: "2", "page-size": "100"}));
  expect(Object.fromEntries(new URL(fetcher.mock.calls[0][0]).searchParams)).toEqual({page: "2", "page-size": "100", fulltext: "A&B+NADAC", theme: "Drug Pricing and Payment", keyword: "National Average Drug Acquisition Cost (NADAC)"});
});

it.each([{results: [], total: 0}, [], {items: [], pagination: {next: "https://other.example"}}])("retains native envelope variations without inferring completeness or following links %#", async response => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(response)); vi.stubGlobal("fetch", fetcher);
  expect((await api(request())).data).toMatchObject({native: response, _medicaid: {complete: false}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([{page: 0}, {page: 10001}, {page: 1.5}, {"page-size": 0}, {"page-size": 101}, {page: true}, {fulltext: []}, {theme: ""}, {keyword: "a\nb"}, {fulltext: "a".repeat(501)}, {limit: 10}, {offset: 1}, {url: "https://other.example"}])("rejects unsupported search controls before fetching %#", async params => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(api(request(params))).rejects.toMatchObject({status: 400});
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([403, 429, 500])("keeps HTTP %i failures as errors", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream error", {status})));
  await expect(api(request())).rejects.toMatchObject({status, message: `Medicaid HTTP ${status}`});
});

it("rejects in-band error objects instead of treating them as an empty catalog", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({error: "unsupported search"})));
  await expect(api(request())).rejects.toMatchObject({status: 502});
});

it("runs the discovery recipe without selecting a UUID or fetching prices", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(native)); vi.stubGlobal("fetch", fetcher);
  const run = new Function("api", `return (async () => {${datasetSearchWorkflow.code}})()`);
  expect(await run({get: async (path: string, params: Record<string, unknown>) => (await api({method: "GET", path, params})).data})).toMatchObject({native});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(drugPricingCatalog.endpointCount).toBe(drugPricingCatalog.endpoints.length);
});

it("stages the entire large search response and hash through Code Mode", async () => {
  const response = {...native, vendor_notes: "α".repeat(55000)};
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));
  const stored: unknown[] = [];
  const namespace = {idFromName: (name: string) => name, get: () => ({fetch: async (req: Request) => {
    if (new URL(req.url).pathname === "/process") {stored.push((await req.json() as {data: unknown}).data); return Response.json({success: true, tables_created: ["payloads"], total_rows: 1});}
    return Response.json({success: true, schema: {tables: {}}});
  }})} as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({apiFetch: api, catalog: drugPricingCatalog, doNamespace: namespace, stagingPrefix: "drug_pricing", maxInlineBytes: 30 * 1024});
  const result = await proxy.handler(request(), {sql: () => []});
  expect(result).toMatchObject({__staged: true});
  expect(JSON.parse(stored[0] as string)).toMatchObject({native: response, _medicaid: {response_sha256: await digest(response), complete: false}});
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(30 * 1024);
});
