# CMS Drug Pricing MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query the upstream CMS Drug Pricing API in natural language. It is one of 100+ servers in the [Bio MCP](../../README.md) monorepo.

## Connect

The server is deployed and ready at:

```
https://cms-drug-pricing-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "cms-drug-pricing": {
      "command": "npx",
      "args": ["mcp-remote", "https://cms-drug-pricing-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8847/mcp` (start it with `./scripts/dev-servers.sh cms-drug-pricing`):

```json
{
  "mcpServers": {
    "cms-drug-pricing-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8847/mcp"]
    }
  }
}
```

## Tools

- `drug_pricing_search` — discover available API operations through the Code Mode catalog
- `drug_pricing_execute` — **Code Mode**: write JavaScript in a V8 isolate (`api.get()` / `api.post()` / `searchSpec()`) instead of issuing tool calls one by one
- `drug_pricing_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `drug_pricing_get_schema` — inspect the inferred schema of a staged dataset

Large responses (>30KB) are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Every tool returns both a human-readable `content` summary and a structured `structuredContent` payload.

All four tools also register an `mcp_`-prefixed alias.

## NADAC Comparison and dataset evidence

`/nadac/current` retains the existing 2026 dataset. `/nadac/comparison` adds the native comparison dataset (`a217613c-12bc-5137-8b3a-ada0e4dad1ff`), identified in the [CMS DKAN endpoint mapping](https://downloads.cms.gov/files/Socrata-DKAN-API-Endpoints-Mapping.pdf). Raw routes accept native flat DKAN conditions, pagination, `sorts[0][property]` / `sorts[0][order]` and column selection with `properties[0]`, `properties[1]`, etc. Singular `sort[...]` is rejected because the live API echoes but ignores it. `keys=column1,column2` is not a column selector and fails upstream validation. Higher array indices can receive the shared catalog's conservative `__unfiltered_warning`; inspect native `query` and actual returned rows/columns to establish their effect.

Use `GET /datasets/search` to discover dataset identifiers by `fulltext` (title
or description), `theme` or `keyword` before selecting metadata. It wraps the
documented DKAN `/api/1/search` route. `page` starts at 1 (default 1, local maximum
10000); `page-size` is 1–100 (default 10). This pagination differs from datastore
row offsets. Search returns the entire native response under `native`, with its
source URL, query, observation time and response hash under `_medicaid`. It does
not select the first result, infer the newest effective rates or automatically
page. Search reads share the existing 15-second/4 MiB bounds and staging path.

```javascript
return await api.get('/datasets/search', {
  fulltext: 'First Time NADAC Rates', 'page-size': 10, page: 1
});
```

Inspect the returned candidate UUID and title, then use these evidence helpers:

- `GET /datasets/{dataset_id}/metadata` returns full native metadata, distribution references and a canonical metadata SHA-256.
- `GET /datasets/{dataset_id}/page` reads metadata before and after a bounded native page and rejects identity/hash changes. Optional `expected_metadata_sha256` guards continuation reads; `distribution_index` defaults to 0 and must exist in metadata. Limit is 1–500 (default 50), offset 0–10000000. Flat conditions and `sorts` are accepted; projection is rejected to retain context. Reads have a 15-second total deadline and 4 MiB per-response cap. `_medicaid.response_sha256` hashes the complete parsed native page, separately from the metadata hash.

The helpers preserve the native response envelope, NDC strings, precision, unknown columns and metadata. Metadata consistency does not prove an atomic, historical or immutable data snapshot. `complete` remains false; `next_offset_candidate` is a paging hint, and native `count` is not assumed to be the dataset total. Large results retain their complete native payload through shared staging.

Raw aliases now share the bounded reader: one request with a 15-second deadline
and a 4 MiB response cap. They return the observed HTTP error body/status for
the caller to inspect and retry; the former three-retry transport is removed.

[CMS comparison definitions](https://www.medicaid.gov/media/25386) distinguish start/end dates of compared reference files from the new rate's effective date. Comparison contains replaced rates, not every added or terminated NDC. Preserve missing units as unknown; consult the corresponding reference data before comparing unit costs. [NADAC reference definitions](https://www.medicaid.gov/media/25376) distinguish ML/GM/EA units and corresponding-generic effective dates. This server does not derive reimbursement amounts or convert price units.

## First Time NADAC rates

`GET /nadac/first-time` uses the same metadata-guarded full-row controls. Native
catalog search, metadata, the CMS monthly index and all 1,390 current CSV/API rows
qualified dataset `e3af839d-8175-5be0-b94e-4a302ed7a035` on October 4, 2026.
It describes **drug rate groups**, not individual NDCs or all newly marketed
drugs. `as_of_date` identifies the reported date when the group first appeared
on NADAC; select a provider-reported date explicitly. Native rates, package
sizes, counts, units, classifications and reason strings are preserved. Some
dictionary examples differ from actual labels; no remapping is inferred.

```javascript
const metadata = await api.get('/datasets/e3af839d-8175-5be0-b94e-4a302ed7a035/metadata');
if (metadata.__staged || metadata.__api_error) return metadata;
return await api.get('/nadac/first-time', {
  expected_metadata_sha256: metadata._medicaid.metadata_sha256,
  'conditions[0][property]': 'as_of_date',
  'conditions[0][value]': '2026-09-23',
  'conditions[0][operator]': '=', limit: 50
});
```

Native search `results` is an object keyed by `dkan_dataset/UUID`; retain each
entry's identifier and the complete catalog response. Staged tables include
`first_time_rates`, `nadac_prices`, `drug_utilization`, `datasets` or generic
`results`, with exact `native_json` and `source_path` per row; `response_context`
and canonical `payloads` preserve the full response. Numeric-looking strings
stay strings, including NDC leading zeros, decimal precision and suppression
flags. Both aliases retain complete success/error fields, canonical query/result
citations and native HTTP error bodies/hashes. Composed responses stage with
reserved SDK metadata headroom before crossing 30 KiB.

See the [October 4 native source and acceptance review](../../docs/audits/2026-10-04-medicaid-nadac-review.md).
[Medicaid API documentation](https://data.medicaid.gov/about/api) and
[DKAN documentation](https://dkan.readthedocs.io/en/2.21.0/user-guide/guide_api.html)
describe search and datastore parameters; they do not establish the deployed
DKAN version. Observed metadata stability and CSV/API parity do not establish
an immutable historical snapshot or complete provider coverage.

## Development

October 4 validation supersedes the earlier access failures below: **91 server
tests plus 207 catalog checks**, direct TypeScript and lint pass. Full Vitest:
**13,989 passed / 109 skipped**. Native reads and local Worker acceptance now
work with verified TLS and the installed Node public CA roots in the local test
network configuration. Final acceptance/gate receipts are retained under
`scratch/2026-10-04-medicaid/`; the implementation tracker records their scope.
These changes have not been committed, pushed or deployed.

October 1 catalog-search validation: 65 focused tests, TypeScript and Biome pass;
full Vitest passes 10,518 tests with 109 skipped. `check:affected` stops at FINRA's
`tsx` IPC listener permission error. The local MCP endpoint is unreachable
(three connection failures, seven skipped checks); live acceptance remains pending.

September 29 local validation: 41 focused tests pass, as do direct TypeScript and Biome checks. The full repository suite passes (8,537 tests, 109 skipped). `check:affected` stops at GDC's Wrangler type generation because the sandbox denies its loopback listener (`EPERM 127.0.0.1`). The deployed MCP probe was denied under the session approval policy; live provider acceptance, Worker execution and staged SQL remain pending. Nothing in these local results certifies the deployed server.

```bash
./scripts/dev-servers.sh cms-drug-pricing            # run locally (port 8847)
pnpm --filter cms-drug-pricing-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).

---

*Auto-generated baseline README — refine with server-specific detail as needed.*

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from Medicaid NADAC and stays under the terms of that source: US public domain.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
