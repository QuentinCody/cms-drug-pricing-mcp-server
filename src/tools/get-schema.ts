import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createGetSchemaHandler } from "@bio-mcp/shared/staging/utils";

export function registerGetSchema(server: McpServer, env?: Partial<Env>): void {
    const handler = createGetSchemaHandler("DRUG_PRICING_DATA_DO", "drug_pricing");

    server.registerTool(
        "drug_pricing_get_schema",
        {
            title: "Get Staged Data Schema",
            description:
                "Get schema information for staged drug pricing data. Shows table structures and row counts. " +
                "If called without a data_access_id, lists all staged datasets available in this session.",
            inputSchema: {
                data_access_id: z.string().min(1).optional().describe(
                    "Data access ID for the staged dataset. If omitted, lists all staged datasets in this session.",
                ),
            },
        },
        async (args, extra) => {
            const runtimeEnv = env ?? (extra as { env?: Partial<Env> })?.env ?? {};
            const handlerRecord: Record<string, unknown> = {
                data_access_id: args.data_access_id,
            };
            const envRecord: Record<string, unknown> = { ...runtimeEnv };
            return handler(
                handlerRecord,
                envRecord,
                (extra as { sessionId?: string })?.sessionId,
            );
        },
    );
}
