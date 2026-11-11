import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const projected = (value: unknown, path: string): Row => ({
  ...(record(value) ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== "_rowid").map(([key, cell]) =>
    [key, cell !== null && typeof cell === "object" ? JSON.stringify(cell) : cell])) : { value }),
  native_json: JSON.stringify(value), source_path: path,
});

/** Project full native rows while retaining the entire response and its source locations. */
export function medicaidTables(value: unknown) {
  const data = record(value) && Array.isArray(value.content) && record(value.structuredContent) && "data" in value.structuredContent
    ? value.structuredContent.data : value;
  const tables: Record<string, Row[]> = {};
  collect(data, "", tables);
  tables.response_context = [{ native_json: JSON.stringify(data) ?? "null" }];
  return tables;
}

function collect(value: unknown, path: string, tables: Record<string, Row[]>, resultRows = false) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => { collect(item, `${path}/${index}`, tables, resultRows); });
    return;
  }
  if (!record(value)) return;
  const table = typeof value.drug_product === "string" && "nadac_rate" in value ? "first_time_rates"
    : typeof value.ndc_description === "string" || (typeof value.ndc === "string" && "nadac_per_unit" in value) ? "nadac_prices"
    : typeof value.state === "string" && ("units_reimbursed" in value || "number_of_prescriptions" in value) ? "drug_utilization"
    : value["@type"] === "dcat:Dataset" && typeof value.identifier === "string" ? "datasets"
    : resultRows ? "results" : undefined;
  if (table) {
    tables[table] ??= [];
    tables[table].push(projected(value, path));
    return;
  }
  if (typeof value.sql === "string" && Array.isArray(value.rows)) {
    tables.query_rows = value.rows.map((item, index) => projected(item, `${path}/rows/${index}`));
    return;
  }
  for (const [key, child] of Object.entries(value)) collect(child, `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`, tables, key === "results" && Array.isArray(child));
}

export function medicaidSchemaHints(value: unknown): SchemaHints {
  const columnTypes: Record<string, string> = { native_json: "TEXT", source_path: "TEXT" };
  for (const rows of Object.values(medicaidTables(value))) for (const row of rows) {
    for (const [key, cell] of Object.entries(row)) if (typeof cell === "string") columnTypes[key] = "TEXT";
  }
  return { columnTypes };
}
