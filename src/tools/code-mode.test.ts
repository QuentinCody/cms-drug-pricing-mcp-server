import { afterEach, expect, it, vi } from "vitest";
import { McpServer } from "@bio-mcp/shared/mcp";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { registerCodeMode } from "./code-mode";
import { registerQueryData } from "./query-data";
import { registerGetSchema } from "./get-schema";
import { drugPricingCatalog } from "../spec/catalog";
import { createDrugPricingApiFetch } from "../lib/api-adapter";

afterEach(() => vi.unstubAllGlobals());

it("registers both aliases for each tool and preserves success/error envelopes", async () => {
  const server = new McpServer({ name: "fixture", version: "1" });
  // SAFETY: invalid execution never invokes the loader or DO.
  registerCodeMode(server, { CODE_MODE_LOADER: { get: () => ({}) } } as unknown as Parameters<typeof registerCodeMode>[1]);
  registerQueryData(server, {}); registerGetSchema(server, {});
  // SAFETY: inspect actual SDK callbacks solely for this registration contract test.
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<unknown> }> })._registeredTools;
  expect(Object.keys(tools)).toHaveLength(8);
  for (const prefix of ["", "mcp_"]) {
    const discovery = await tools[prefix + "drug_pricing_search"].handler({query: "First Time NADAC catalog dataset discovery", max_results: 5}, {});
    expect(discovery).toMatchObject({content: expect.any(Array), structuredContent: {success: true}});
    expect(JSON.stringify(discovery)).toContain("/datasets/search");
    expect(await tools[prefix + "drug_pricing_search"].handler({ query: "comparison", max_results: 5 }, {})).toMatchObject({ content: expect.any(Array), structuredContent: { success: true } });
    for (const [name, args] of [["execute", { code: "" }], ["query_data", { data_access_id: "fixture", sql: "SELECT 1" }], ["get_schema", { data_access_id: "fixture" }]] as const) {
      expect(await tools[prefix + "drug_pricing_" + name].handler(args, {})).toMatchObject({ content: expect.any(Array), structuredContent: expect.any(Object), isError: true });
    }
  }
});

it("stages full native rows and metadata with a transport-safe handle", async () => {
  const id = "a217613c-12bc-5137-8b3a-ada0e4dad1ff";
  const metadata = { identifier: id, distribution: [{ identifier: "fixture-distribution" }] };
  const row = { ndc: "00012345678", effective_date: "2026-09-18", start_date: "2026-09-16", end_date: "2026-09-23", notes: "α".repeat(20000) };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(metadata)).mockResolvedValueOnce(Response.json({ results: [row] })).mockResolvedValueOnce(Response.json(metadata)));
  const stored: unknown[] = [];
  // SAFETY: fixture supplies the DO methods used by shared staging.
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      // SAFETY: request payload originates in shared staging under test.
      const payload = await request.json() as { data: unknown };
      stored.push(payload.data);
      return Response.json({ success: true, tables_created: ["payloads"], total_rows: 1 });
    }
    return Response.json({ success: true, schema: { tables: { payloads: { columns: [{ name: "root_json" }] } } } });
  } }) } as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({ apiFetch: createDrugPricingApiFetch(), catalog: drugPricingCatalog, doNamespace: namespace, stagingPrefix: "drug_pricing", maxInlineBytes: 30 * 1024 });
  const result = await proxy.handler({ method: "GET", path: `/datasets/${id}/page` }, { sql: () => [] });
  expect(result).toMatchObject({ __staged: true, data_access_id: expect.any(String) });
  expect(stored.map(value => typeof value === "string" ? JSON.parse(value) : value)).toEqual(expect.arrayContaining([expect.objectContaining({ native: { results: [row] }, metadata, _medicaid: expect.objectContaining({ dataset_id: id }) })]));
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(100000);
});
