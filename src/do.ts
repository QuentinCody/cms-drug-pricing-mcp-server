import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class DrugPricingDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        if (Array.isArray(data)) {
            const sample = data[0];
            if (sample && typeof sample === "object") {
                // NADAC drug pricing data
                if ("nadac_per_unit" in sample || "ndc_description" in sample) {
                    return {
                        tableName: "nadac_prices",
                        indexes: ["ndc", "ndc_description", "effective_date", "pharmacy_type_indicator"],
                    };
                }
                // State drug utilization data
                if ("units_reimbursed" in sample || "number_of_prescriptions" in sample) {
                    return {
                        tableName: "drug_utilization",
                        indexes: ["state", "ndc", "product_name", "year", "quarter"],
                    };
                }
            }
        }

        // Single record detection — use `in` operator for safe property checks
        if ("nadac_per_unit" in data || "ndc_description" in data) {
            return {
                tableName: "nadac_prices",
                indexes: ["ndc", "ndc_description", "effective_date"],
            };
        }
        if ("units_reimbursed" in data || "number_of_prescriptions" in data) {
            return {
                tableName: "drug_utilization",
                indexes: ["state", "ndc", "product_name", "year", "quarter"],
            };
        }

        return undefined;
    }
}
