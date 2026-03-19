import { restFetch } from "@bio-mcp/shared/http/rest-fetch";
import type { RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const MEDICAID_BASE = "https://data.medicaid.gov";

export interface DrugPricingFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    baseUrl?: string;
}

/**
 * Fetch from the data.medicaid.gov DKAN API.
 */
export async function drugPricingFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: DrugPricingFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? MEDICAID_BASE;
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(opts?.headers ?? {}),
    };

    return restFetch(baseUrl, path, params, {
        ...opts,
        headers,
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 3,
        timeout: opts?.timeout ?? 30_000,
        userAgent: "cms-drug-pricing-mcp-server/1.0 (bio-mcp)",
    });
}
