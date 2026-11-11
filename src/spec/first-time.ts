import type { ApiEndpoint, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";
import { FIRST_TIME_NADAC_ID } from "../lib/first-time";
import { datasetEndpoints } from "./datasets";

export const firstTimeEndpoint: ApiEndpoint = {
  method: "GET", path: "/nadac/first-time", category: "nadac", featured: true,
  summary: "First Time NADAC rate-group rows with metadata drift guards, native page hash and full context; select as_of_date explicitly",
  description: `Verified dataset ${FIRST_TIME_NADAC_ID}. Returns {native:{results,count,schema,query},metadata,_medicaid,_first_time_nadac}. Uses the full-row page controls. Observed fields: drug_product, brief_indicationdescription, drug_class, package_size, ncpdp_billing_unit_standard, nadac_rate, number_of_active_ndcs_within_the_rategroup_that_are_on_the__0bb0, primary_reason_code, as_of_date, classification_for_rate_setting. Preserve all native fields/strings. Rows describe drug rate groups, not NDC identifiers or all newly marketed drugs. Dates and provider labels retain their original meaning. Read /datasets/{dataset_id}/metadata first to pin metadata for continuation; it does not pin row content or establish an immutable snapshot.`,
  queryParams: datasetEndpoints.find(endpoint => endpoint.path.endsWith("/page"))?.queryParams,
};

export const firstTimeWorkflow: WorkflowRecipe = {
  title: "Read First Time NADAC rates for a reported month",
  keywords: ["NADAC", "first time", "rate group", "monthly", "new rates"],
  description: "Read metadata and retain its hash while selecting the September 23, 2026 reported month. Replace as_of_date with a provider-reported date for another month. Rates, units, classifications and NDC counts remain native strings; this is not an individual-NDC or reimbursement table. If staged, use the returned schema and SQL handle to recover full results.",
  code: `const metadata = await api.get("/datasets/${FIRST_TIME_NADAC_ID}/metadata");
if (metadata.__staged || metadata.__api_error) return metadata;
return await api.get("/nadac/first-time", {expected_metadata_sha256: metadata._medicaid.metadata_sha256, limit: 50, offset: 0, "conditions[0][property]": "as_of_date", "conditions[0][value]": "2026-09-23", "conditions[0][operator]": "="});`,
};
