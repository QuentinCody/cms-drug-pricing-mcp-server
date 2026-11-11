const ROOT = "https://data.medicaid.gov";
const MAX_BYTES = 4 * 1024 * 1024;

function requestError(message: string, status: number, data?: unknown) {
  return Object.assign(new Error(message), { status,
    data: data ?? { error: { code: "MEDICAID_REQUEST_ERROR", message, status } },
  });
}

export function fail(message: string, status = 400, data?: unknown): never {
  throw requestError(message, status, data);
}

export function queryUrl(path: string, params: Record<string, unknown>): URL {
  const url = new URL(path, ROOT);
  if (url.origin !== ROOT || url.username || url.password || url.hash) fail("Invalid Medicaid URL");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") fail("Query values must be scalar strings, numbers or booleans");
    if (typeof value === "number" && !Number.isFinite(value)) fail("Query numbers must be finite");
    if (key.length > 200 || String(value).length > 16000) fail("Query parameter too long");
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function readJson(response: Response, sourceUrl: string): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) fail("Empty Medicaid response", 502);
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) fail("Medicaid response exceeds 4 MiB; narrow the query", 502);
      chunks.push(decoder.decode(part.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    const text = chunks.join("");
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!response.ok || !data || typeof data !== "object" || "error" in data || "errors" in data) {
      fail(response.ok ? "Invalid Medicaid JSON envelope" : `Medicaid HTTP ${response.status}`, response.ok ? 502 : response.status, {
        native_error: data, response_evidence: { source_url: sourceUrl, upstream_status: response.status,
          observed_at: new Date().toISOString(), response_sha256: await digest(data),
          hash_scope: "Complete parsed native error body, or complete text when not JSON; recursively sorted object keys", complete: false },
      });
    }
    return data;
  } finally {
    void reader.cancel().catch(() => {}); // Best-effort cleanup must not replace the read failure.
    reader.releaseLock();
  }
}

export async function datasetRead(path: string, params: Record<string, unknown>, deadline: number): Promise<{ status: number; data: unknown; source_url: string }> {
  const url = queryUrl(path, params);
  const remaining = deadline - Date.now();
  if (remaining <= 0) fail("Medicaid read deadline exceeded", 504);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(requestError("Medicaid read deadline exceeded", 504));
    }, remaining);
  });
  try {
    const work = async () => {
      const response = await fetch(url, { headers: { Accept: "application/json" }, redirect: "manual", signal: controller.signal });
      return { status: response.status, data: await readJson(response, url.href), source_url: url.href };
    };
    return await Promise.race([work(), timeout]);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) throw error;
    throw requestError("Medicaid response unavailable or invalid JSON", 502);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
