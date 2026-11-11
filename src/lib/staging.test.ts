import { expect, it } from "vitest";
import { medicaidSchemaHints, medicaidTables } from "./staging";

it("preserves native rate strings, units, dates, counts and unknown fields in SQL projections", () => {
  const row = { drug_product: "A", nadac_rate: "0.01000", package_size: "3 X 100", ncpdp_billing_unit_standard: "ML", ndc_count: "02", as_of_date: "2026-09-23", future: { retain: [null, "α"] } };
  const source = { native: { results: [row], query: { offset: 0 }, schema: { fields: { drug_product: { type: "text" }, nadac_rate: { type: "text" } } } }, metadata: { identifier: "source" }, _medicaid: { metadata_sha256: "hash" } };
  const tables = medicaidTables(source);
  expect(tables.first_time_rates).toHaveLength(1);
  expect(tables.first_time_rates[0]).toMatchObject({ nadac_rate: "0.01000", ndc_count: "02", source_path: "/native/results/0" });
  expect(JSON.parse(String(tables.first_time_rates[0].native_json))).toEqual(row);
  expect(JSON.parse(String(tables.response_context[0].native_json))).toEqual(source);
  expect(medicaidSchemaHints(source).columnTypes).toMatchObject({ nadac_rate: "TEXT", ndc_count: "TEXT", future: "TEXT" });
});

it("supports legacy envelopes, composed arrays and keyed native catalog results", () => {
  const nadac = { ndc_description: "A", ndc: "00001234567", nadac_per_unit: "0.0001" };
  const utilization = { state: "CA", units_reimbursed: "", suppression_used: "true" };
  const dataset = { "@type": "dcat:Dataset", identifier: "native", distribution: [{ id: "d" }] };
  const source = { "a/~b": { results: [nadac], schema: { fields: { ndc_description: { type: "text" }, nadac_per_unit: { type: "text" } } } }, utilization: { results: [utilization], schema: { fields: { state: { type: "text" }, units_reimbursed: { type: "text" } } } }, catalog: { results: { "dkan_dataset/native": dataset } } };
  const tables = medicaidTables({ content: [], structuredContent: { data: [source] } });
  expect(tables.nadac_prices).toHaveLength(1);
  expect(tables.drug_utilization).toHaveLength(1);
  expect(tables.nadac_prices[0].source_path).toBe("/0/a~1~0b/results/0");
  expect(tables.drug_utilization[0].units_reimbursed).toBe("");
  expect(tables.datasets[0].source_path).toBe("/0/catalog/results/dkan_dataset~1native");
  expect(JSON.parse(String(tables.datasets[0].native_json))).toEqual(dataset);
});

it("retains reserved source columns in native JSON when restaging SQL rows", () => {
  const source = { sql: "SELECT * FROM first_time_rates", rows: [{ _rowid: 1, nadac_rate: "01.00", native_json: "provider-value" }] };
  const row = medicaidTables(source).query_rows[0];
  expect(row).not.toHaveProperty("_rowid");
  expect(JSON.parse(String(row.native_json))).toEqual(source.rows[0]);
});

it("retains SQL access to projected or unfamiliar native result rows", () => {
  const rows = [{ ndc: "00012345678" }, { new_provider_field: "001" }];
  const tables = medicaidTables({ results: rows, schema: { fields: { ndc: { type: "text" } } } });
  expect(tables.results.map(row => JSON.parse(String(row.native_json)))).toEqual(rows);
  expect(medicaidSchemaHints({ results: rows }).columnTypes).toMatchObject({ ndc: "TEXT", new_provider_field: "TEXT" });
});
