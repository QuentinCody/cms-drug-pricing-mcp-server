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
        "- Filtering: conditions is an ARRAY. Use zero-based indices:\n" +
        "  conditions[{i}][property]={field}, conditions[{i}][value]={value}, conditions[{i}][operator]={op}\n" +
        "  Operators are LOWERCASE: =, <>, >, >=, <, <=, between, in, not in, like, starts with, contains\n" +
        "  Example (one filter): conditions[0][property]=ndc_description&conditions[0][value]=METFORMIN&conditions[0][operator]=contains\n" +
        "  Example (two filters, AND-combined): add conditions[1][property]=otc&conditions[1][value]=N&conditions[1][operator]==\n" +
        "  NOTE: the object form conditions[{field}][value] is REJECTED with HTTP 400; conditions must be an array, and uppercase operators (CONTAINS/LIKE) cause a 400 'Database internal error'.\n" +
        "- Pagination: limit={n}&offset={n} (default limit is 50, max varies)\n" +
        "- Sorting: sort[0][property]={field}&sort[0][order]=asc (or desc)\n" +
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
                { name: "conditions[0][property]", type: "string", required: false, description: "Field to filter on, e.g. ndc_description, ndc, pharmacy_type_indicator (C/I or S/O), otc (Y/N), classification_for_rate_setting (G/B). Add more filters with conditions[1][property], conditions[2][property], ..." },
                { name: "conditions[0][value]", type: "string", required: false, description: "Value to match for the conditions[0] filter (e.g. METFORMIN)" },
                { name: "conditions[0][operator]", type: "string", required: false, description: "Operator for the conditions[0] filter (lowercase)", enum: ["=", "<>", ">", ">=", "<", "<=", "contains", "starts with", "like", "in"] },
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
                { name: "conditions[0][property]", type: "string", required: false, description: "Field to filter on, e.g. ndc_description, ndc, pharmacy_type_indicator (C/I or S/O), otc (Y/N). Add more filters with conditions[1][property], conditions[2][property], ..." },
                { name: "conditions[0][value]", type: "string", required: false, description: "Value to match for the conditions[0] filter (e.g. METFORMIN)" },
                { name: "conditions[0][operator]", type: "string", required: false, description: "Operator for the conditions[0] filter (lowercase)", enum: ["=", "<>", ">", ">=", "<", "<=", "contains", "starts with", "like", "in"] },
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
                { name: "conditions[0][property]", type: "string", required: false, description: "Field to filter on, e.g. state (CA/NY/TX), product_name, ndc, quarter (1-4), utilization_type (MCOU/FFSU). Add more filters with conditions[1][property], conditions[2][property], ..." },
                { name: "conditions[0][value]", type: "string", required: false, description: "Value to match for the conditions[0] filter (e.g. CA)" },
                { name: "conditions[0][operator]", type: "string", required: false, description: "Operator for the conditions[0] filter (lowercase)", enum: ["=", "<>", ">", ">=", "<", "<=", "contains", "starts with", "like", "in"] },
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
                { name: "conditions[0][property]", type: "string", required: false, description: "Field to filter on, e.g. state (CA/NY/TX), product_name, ndc, quarter (1-4), utilization_type (MCOU/FFSU). Add more filters with conditions[1][property], conditions[2][property], ..." },
                { name: "conditions[0][value]", type: "string", required: false, description: "Value to match for the conditions[0] filter (e.g. CA)" },
                { name: "conditions[0][operator]", type: "string", required: false, description: "Operator for the conditions[0] filter (lowercase)", enum: ["=", "<>", ">", ">=", "<", "<=", "contains", "starts with", "like", "in"] },
                { name: "limit", type: "number", required: false, description: "Number of results (default 50)" },
                { name: "offset", type: "number", required: false, description: "Offset for pagination" },
                { name: "keys", type: "string", required: false, description: "Comma-separated list of fields to return" },
            ],
        },
    ],
};
