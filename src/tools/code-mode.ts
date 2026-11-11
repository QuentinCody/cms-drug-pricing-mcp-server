import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { drugPricingCatalog } from "../spec/catalog";
import { createDrugPricingApiFetch } from "../lib/api-adapter";
import { drugPricingResponse } from "../lib/tool-result";

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
function toRegistrable(server: McpServer, env: CodeModeEnv): { tool: (...args: unknown[]) => void } {
    // SAFETY: shared factories supply SDK arguments; only the alias name changes.
    const boundTool = server.tool.bind(server) as (...args: unknown[]) => void;
    return { tool: (...args: unknown[]) => {
        const [name, description, schema, callback] = args;
        for (const alias of [String(name), `mcp_${String(name)}`]) boundTool(alias, description, schema,
            (input: unknown, extra: unknown) => drugPricingResponse(
                () => (callback as (...values: unknown[]) => Promise<Awaited<ReturnType<typeof drugPricingResponse>>>)(input, extra),
                env, alias, extra, input));
    } };
}

export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
): void {
    const apiFetch = createDrugPricingApiFetch();
    const registrable = toRegistrable(server, env);

    const searchTool = createSearchTool({
        prefix: "drug_pricing",
        catalog: drugPricingCatalog,
    });
    searchTool.register(registrable);

    const executeTool = createExecuteTool({
        prefix: "drug_pricing",
        // Verifiable provenance: drug_pricing_execute results carry a _meta.citation.
        source: { id: "drug_pricing", name: "CMS Drug Pricing (NADAC)", url: "https://data.medicaid.gov", license: "U.S. Public Domain" },
        catalog: drugPricingCatalog,
        apiFetch,
        preserveApiErrors: true,
        maxInlineBytes: 30 * 1024,
        stagingThreshold: 30 * 1024,
        timeout: 60000,
        doNamespace: env.DRUG_PRICING_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(registrable);
}
