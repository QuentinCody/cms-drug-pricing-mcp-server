import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { datasetEvidence } from "./dataset-evidence";
import { datasetRead, fail } from "./dataset-http";
import { searchDatasets } from "./dataset-search";
import { FIRST_TIME_NADAC_ID, FIRST_TIME_NADAC_SCOPE } from "./first-time";

/**
 * Dataset UUID mapping for DKAN API endpoints.
 */
const DATASET_UUIDS: Record<string, string> = {
    // NADAC (National Average Drug Acquisition Cost)
    "/nadac/current": "fbb83258-11c7-47f5-8b18-5f8e79f7e704", // 2026
    "/nadac/comparison": "a217613c-12bc-5137-8b3a-ada0e4dad1ff",
    "/nadac/2025": "f38d0706-1239-442c-a3cc-40ef1b686ac0",
    // Medicaid State Drug Utilization
    "/utilization/2024": "61729e5a-7aa8-448c-8903-ba3e0cd0ea3c",
    "/utilization/2023": "d890d3a9-6b00-43fd-8b31-fcba4c8e2909",
};

export function createDrugPricingApiFetch(): ApiFetchFn {
    return async (request) => {
        if (request.method !== "GET" || request.body !== undefined) fail("CMS Drug Pricing supports bodyless GET requests only", 405);
        const path = request.path;
        if (path === "/datasets/search") return searchDatasets(request.params ?? {});
        if (path === "/nadac/first-time") {
            const response = await datasetEvidence(FIRST_TIME_NADAC_ID, true, request.params ?? {});
            return { ...response, data: { ...response.data, _first_time_nadac: FIRST_TIME_NADAC_SCOPE } };
        }
        const evidence = /^\/datasets\/([^/]+)\/(metadata|page)$/.exec(path);
        if (evidence) return datasetEvidence(evidence[1], evidence[2] === "page", request.params ?? {});

        // Resolve the dataset UUID from the path
        const uuid = Object.prototype.hasOwnProperty.call(DATASET_UUIDS, path) ? DATASET_UUIDS[path] : undefined;
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

        // Preserve native parameters, but reject the old spelling that DKAN silently ignores.
        const params: Record<string, unknown> = {};
        if (request.params) {
            for (const [key, value] of Object.entries(request.params)) {
                if (/^sort\[/.test(key)) fail("Use sorts[i][property] and sorts[i][order]; DKAN ignores singular sort parameters");
                params[key] = value;
            }
        }

        const response = await datasetRead(dkanPath, params, Date.now() + 15000);
        return { status: response.status, data: response.data };
    };
}
