import { afterEach, expect, it, vi } from "vitest";
import { datasetRead, digest, queryUrl } from "./dataset-http";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("encodes native DKAN query values exactly once and retains NDC leading zeros", () => {
  const url = queryUrl("/api/1/datastore/query/fixture/0", { "conditions[0][value]": "00012345678", "conditions[1][value]": "A+B & 5%", unused: undefined });
  expect(url.origin).toBe("https://data.medicaid.gov");
  expect(url.searchParams.get("conditions[0][value]")).toBe("00012345678");
  expect(url.searchParams.get("conditions[1][value]")).toBe("A+B & 5%");
  expect(url.searchParams.has("unused")).toBe(false);
});

it.each([null, {}, [], Number.NaN, Number.POSITIVE_INFINITY, "x".repeat(16001)])("rejects invalid scalar query input %#", value => {
  expect(() => queryUrl("/", { value })).toThrow();
});

it("hashes native metadata independent of object key order but preserves array order", async () => {
  expect(await digest({ b: ["01", "02"], a: 1 })).toBe(await digest({ a: 1, b: ["01", "02"] }));
  expect(await digest(["01", "02"])).not.toBe(await digest(["02", "01"]));
});

it.each([
  [() => new Response("private diagnostic", { status: 429 }), 429],
  [() => new Response("<html>bad gateway</html>"), 502],
  [() => Response.json({ errors: ["provider failure"] }), 502],
  [() => Response.json(null), 502],
  [() => new Response("x".repeat(4 * 1024 * 1024 + 1)), 502],
] as const)("rejects provider errors and malformed or oversized bodies %#", async (response, status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
  await expect(datasetRead("/api/1/test", {}, Date.now() + 15000)).rejects.toMatchObject({ status });
});

it.each(["headers", "body"])("bounds stalled %s with an explicit deadline", async phase => {
  vi.useFakeTimers();
  const fetcher = phase === "headers" ? vi.fn(() => new Promise(() => {})) : vi.fn().mockResolvedValue(new Response(new ReadableStream({ start() {} })));
  vi.stubGlobal("fetch", fetcher);
  const result = expect(datasetRead("/api/1/test", {}, Date.now() + 100)).rejects.toMatchObject({ status: 504, data: { error: { status: 504 } } });
  await vi.advanceTimersByTimeAsync(101);
  await result;
});

it("rejects an already-expired deadline without requesting data", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(datasetRead("/", {}, Date.now() - 1)).rejects.toMatchObject({ status: 504 });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([400, 429, 500])("retains full native HTTP %i evidence for API and MCP error recovery", async status => {
  const native = { message: "Column not found.", status, timestamp: "2026-10-04", detail: "α".repeat(20000) };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(native, { status })));
  const responseHash = await digest(native);
  await expect(datasetRead("/api/1/test", {}, Date.now() + 15000)).rejects.toMatchObject({ status, data: {
    native_error: native, response_evidence: { upstream_status: status, response_sha256: responseHash, source_url: "https://data.medicaid.gov/api/1/test" },
  } });
});

it.each(["https://other.example/test", "//other.example/test", "https://user:pass@data.medicaid.gov/test", "/test#fragment"])("rejects unqualified destination %s", path => {
  expect(() => queryUrl(path, {})).toThrow("Invalid Medicaid URL");
});
