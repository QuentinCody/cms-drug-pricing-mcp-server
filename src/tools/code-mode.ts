import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { drugPricingCatalog } from "../spec/catalog";
import { createDrugPricingApiFetch } from "../lib/api-adapter";

/** Minimal shape required from the worker Env for Code Mode registration. */
interface CodeModeEnv {
    DRUG_PRICING_DATA_DO: Pick<Env["DRUG_PRICING_DATA_DO"], "get" | "idFromName">;
    CODE_MODE_LOADER: Env["CODE_MODE_LOADER"];
}

/**
 * Wraps McpServer as a loose { tool(...) } registrable expected by @bio-mcp/shared.
 * The shared library declares `tool: (...args: unknown[]) => void` to avoid
 * coupling to the SDK's overloaded McpServer.tool signature.
 */
function toRegistrable(server: McpServer): { tool: (...args: unknown[]) => void } {
    const boundTool = server.tool.bind(server);
    return { tool: (...args: unknown[]) => { (boundTool as Function)(...args); } };
}

export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
) {
    const apiFetch = createDrugPricingApiFetch();
    const registrable = toRegistrable(server);

    const searchTool = createSearchTool({
        prefix: "drug_pricing",
        catalog: drugPricingCatalog,
    });
    searchTool.register(registrable);

    const executeTool = createExecuteTool({
        prefix: "drug_pricing",
        catalog: drugPricingCatalog,
        apiFetch,
        doNamespace: env.DRUG_PRICING_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(registrable);
}
