import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import { medicaidSchemaHints, medicaidTables } from "./lib/staging";

export class DrugPricingDataDO extends RestStagingDO {
  protected getTabularData(value: unknown): unknown {
    // Canonical scalar evidence must reach the inherited raw payload store.
    return value === null || typeof value !== "object" ? value : medicaidTables(value);
  }

  protected getSchemaHints(value: unknown) {
    return medicaidSchemaHints(value);
  }
}
