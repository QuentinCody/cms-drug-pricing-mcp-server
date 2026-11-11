import type { ApiEndpoint, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";

export const datasetSearchEndpoint: ApiEndpoint = {
  method: "GET", path: "/datasets/search", category: "dataset_evidence", featured: true,
  summary: "Discover Medicaid datasets by title/description text, theme or keyword before selecting a dataset UUID",
  description: "Local wrapper for documented GET /api/1/search. Retains the entire native catalog response and its hash. Search page numbering starts at 1; it is distinct from datastore offset paging. Native results may be an object keyed by dkan_dataset/UUID; inspect each value's identifier. Use returned identifiers with /datasets/{dataset_id}/metadata to inspect identity and distributions, then /page for data. No automatic latest-release selection or completeness claim. First Time NADAC has a separately documented /nadac/first-time full-row route.",
  queryParams: [
    {name: "fulltext", type: "string", required: false, description: "Text in dataset title or description; e.g. First Time NADAC Rates. At most 500 characters."},
    {name: "theme", type: "string", required: false, description: "Dataset theme, e.g. Drug Pricing and Payment; at most 500 characters."},
    {name: "keyword", type: "string", required: false, description: "Dataset keyword/tag, e.g. National Average Drug Acquisition Cost (NADAC); at most 500 characters."},
    {name: "page-size", type: "number", required: false, description: "1–100, default 10; native DKAN search page size."},
    {name: "page", type: "number", required: false, description: "One-based search page, default 1; local maximum 10000."},
  ],
};

export const datasetSearchWorkflow: WorkflowRecipe = {
  title: "Discover First Time NADAC Rates",
  keywords: ["NADAC", "first time", "new rates", "catalog", "dataset discovery"],
  description: "CMS publishes this dataset separately from NADAC Comparison. Return a catalog page with native identifiers and metadata for inspection, then use the selected UUID with the metadata/page helpers. First-time rates do not identify every newly marketed drug, every added NDC or all rate changes. No dataset UUID or data-column schema is assumed.",
  code: 'return await api.get("/datasets/search", {fulltext: "First Time NADAC Rates", "page-size": 10, page: 1});',
};
