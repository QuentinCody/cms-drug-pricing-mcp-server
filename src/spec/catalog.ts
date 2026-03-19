import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const drugPricingCatalog: ApiCatalog = {
    name: "CMS Drug Pricing (Medicaid.gov)",
    baseUrl: "https://data.medicaid.gov",
    version: "2026",
    auth: "none",
    endpointCount: 4,
    notes:
        "- Uses DKAN datastore API on data.medicaid.gov (no auth required)\n" +
        "- Query params are passed as GET query parameters\n" +
        "- Filtering: use conditions[{field}][value]={value} and conditions[{field}][operator]={op}\n" +
        "  Supported operators: =, <>, >, >=, <, <=, BETWEEN, IN, NOT IN, LIKE, STARTS_WITH, CONTAINS\n" +
        "  Example: conditions[ndc_description][value]=METFORMIN&conditions[ndc_description][operator]=CONTAINS\n" +
        "- Pagination: limit={n}&offset={n} (default limit is 50, max varies)\n" +
        "- Sorting: sort=asc&sort[0][property]={field} or sort=desc&sort[0][property]={field}\n" +
        "- Select specific columns: keys={field1},{field2}\n" +
        "- Response shape: { results: [...], count: N, schema: {...}, query: {...} }\n" +
        "- NADAC fields: ndc_description, ndc, nadac_per_unit, effective_date, pricing_unit, pharmacy_type_indicator, otc, classification_for_rate_setting, corresponding_generic_drug_nadac_per_unit, corresponding_generic_drug_effective_date, as_of_date\n" +
        "- Utilization fields: state, ndc, product_name, units_reimbursed, number_of_prescriptions, total_amount_reimbursed, year, quarter, suppression_used, labeler_code, utilization_type",
    endpoints: [
        {
            method: "GET",
            path: "/nadac/current",
            summary: "Current NADAC drug prices (2026 dataset) — weekly national average drug acquisition costs",
            category: "nadac",
            queryParams: [
                { name: "conditions[ndc_description][value]", type: "string", required: false, description: "Filter by drug name (use with operator CONTAINS for partial match)" },
                { name: "conditions[ndc_description][operator]", type: "string", required: false, description: "Operator for ndc_description filter", enum: ["=", "CONTAINS", "STARTS_WITH", "LIKE"] },
                { name: "conditions[ndc][value]", type: "string", required: false, description: "Filter by NDC (National Drug Code)" },
                { name: "conditions[ndc][operator]", type: "string", required: false, description: "Operator for NDC filter", enum: ["=", "CONTAINS", "STARTS_WITH"] },
                { name: "conditions[pharmacy_type_indicator][value]", type: "string", required: false, description: "Filter by pharmacy type", enum: ["C/I", "S/O"] },
                { name: "conditions[otc][value]", type: "string", required: false, description: "Filter OTC status", enum: ["Y", "N"] },
                { name: "conditions[classification_for_rate_setting][value]", type: "string", required: false, description: "Filter by classification", enum: ["G", "B"] },
                { name: "limit", type: "number", required: false, description: "Number of results (default 50)" },
                { name: "offset", type: "number", required: false, description: "Offset for pagination" },
                { name: "keys", type: "string", required: false, description: "Comma-separated list of fields to return" },
            ],
        },
        {
            method: "GET",
            path: "/nadac/2025",
            summary: "2025 NADAC drug prices — historical weekly national average drug acquisition costs",
            category: "nadac",
            queryParams: [
                { name: "conditions[ndc_description][value]", type: "string", required: false, description: "Filter by drug name (use with operator CONTAINS for partial match)" },
                { name: "conditions[ndc_description][operator]", type: "string", required: false, description: "Operator for ndc_description filter", enum: ["=", "CONTAINS", "STARTS_WITH", "LIKE"] },
                { name: "conditions[ndc][value]", type: "string", required: false, description: "Filter by NDC (National Drug Code)" },
                { name: "conditions[ndc][operator]", type: "string", required: false, description: "Operator for NDC filter", enum: ["=", "CONTAINS", "STARTS_WITH"] },
                { name: "conditions[pharmacy_type_indicator][value]", type: "string", required: false, description: "Filter by pharmacy type", enum: ["C/I", "S/O"] },
                { name: "conditions[otc][value]", type: "string", required: false, description: "Filter OTC status", enum: ["Y", "N"] },
                { name: "limit", type: "number", required: false, description: "Number of results (default 50)" },
                { name: "offset", type: "number", required: false, description: "Offset for pagination" },
                { name: "keys", type: "string", required: false, description: "Comma-separated list of fields to return" },
            ],
        },
        {
            method: "GET",
            path: "/utilization/2024",
            summary: "2024 Medicaid state drug utilization — prescriptions, units reimbursed, and costs by state",
            category: "utilization",
            queryParams: [
                { name: "conditions[state][value]", type: "string", required: false, description: "Filter by US state abbreviation (e.g. CA, NY, TX)" },
                { name: "conditions[product_name][value]", type: "string", required: false, description: "Filter by product/drug name" },
                { name: "conditions[product_name][operator]", type: "string", required: false, description: "Operator for product_name filter", enum: ["=", "CONTAINS", "STARTS_WITH", "LIKE"] },
                { name: "conditions[ndc][value]", type: "string", required: false, description: "Filter by NDC (National Drug Code)" },
                { name: "conditions[quarter][value]", type: "string", required: false, description: "Filter by quarter (1-4)" },
                { name: "conditions[utilization_type][value]", type: "string", required: false, description: "Filter by utilization type", enum: ["MCOU", "FFSU"] },
                { name: "limit", type: "number", required: false, description: "Number of results (default 50)" },
                { name: "offset", type: "number", required: false, description: "Offset for pagination" },
                { name: "keys", type: "string", required: false, description: "Comma-separated list of fields to return" },
            ],
        },
        {
            method: "GET",
            path: "/utilization/2023",
            summary: "2023 Medicaid state drug utilization — historical prescriptions, units reimbursed, and costs by state",
            category: "utilization",
            queryParams: [
                { name: "conditions[state][value]", type: "string", required: false, description: "Filter by US state abbreviation (e.g. CA, NY, TX)" },
                { name: "conditions[product_name][value]", type: "string", required: false, description: "Filter by product/drug name" },
                { name: "conditions[product_name][operator]", type: "string", required: false, description: "Operator for product_name filter", enum: ["=", "CONTAINS", "STARTS_WITH", "LIKE"] },
                { name: "conditions[ndc][value]", type: "string", required: false, description: "Filter by NDC (National Drug Code)" },
                { name: "conditions[quarter][value]", type: "string", required: false, description: "Filter by quarter (1-4)" },
                { name: "conditions[utilization_type][value]", type: "string", required: false, description: "Filter by utilization type", enum: ["MCOU", "FFSU"] },
                { name: "limit", type: "number", required: false, description: "Number of results (default 50)" },
                { name: "offset", type: "number", required: false, description: "Offset for pagination" },
                { name: "keys", type: "string", required: false, description: "Comma-separated list of fields to return" },
            ],
        },
    ],
};
