import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { drugPricingFetch } from "./http";

/**
 * Dataset UUID mapping for DKAN API endpoints.
 */
const DATASET_UUIDS: Record<string, string> = {
    // NADAC (National Average Drug Acquisition Cost)
    "/nadac/current": "fbb83258-11c7-47f5-8b18-5f8e79f7e704", // 2026
    "/nadac/2025": "f38d0706-1239-442c-a3cc-40ef1b686ac0",
    // Medicaid State Drug Utilization
    "/utilization/2024": "61729e5a-7aa8-448c-8903-ba3e0cd0ea3c",
    "/utilization/2023": "d890d3a9-6b00-43fd-8b31-fcba4c8e2909",
};

export function createDrugPricingApiFetch(): ApiFetchFn {
    return async (request) => {
        const path = request.path;

        // Resolve the dataset UUID from the path
        const uuid = DATASET_UUIDS[path];
        if (!uuid) {
            const validPaths = Object.keys(DATASET_UUIDS).join(", ");
            const error = new Error(
                `Unknown dataset path: ${path}. Valid paths: ${validPaths}`,
            ) as Error & { status: number; data: unknown };
            error.status = 400;
            error.data = { validPaths: Object.keys(DATASET_UUIDS) };
            throw error;
        }

        // Build the DKAN datastore query path
        const dkanPath = `/api/1/datastore/query/${uuid}/0`;

        // Pass through query params (conditions, limit, offset, sort, keys, etc.)
        const params: Record<string, unknown> = {};
        if (request.params) {
            for (const [key, value] of Object.entries(request.params)) {
                params[key] = value;
            }
        }

        const response = await drugPricingFetch(dkanPath, params);

        if (!response.ok) {
            let errorBody: string;
            try {
                errorBody = await response.text();
            } catch {
                errorBody = response.statusText;
            }
            const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            const text = await response.text();
            return { status: response.status, data: text };
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
