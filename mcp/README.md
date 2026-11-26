# MEMO Studio | American Superblock MCP

A Model Context Protocol server with read-only baseline access and isolated temporary design variations that runs the original American Superblock browser model with Playwright, rather than recreating the architecture. It uses the existing geometry JSON and IFC4 export buttons. The default model is cached per process. No edits to the browser application are required.

## Install locally

Requires Node.js 22+, npm and Chromium dependencies.

```sh
git clone https://github.com/Memortal/American-Superblock.git
cd American-Superblock/mcp
npm install
npx playwright install --with-deps chromium
npm test
npm start
```

For Claude Desktop or other stdio clients, configure the absolute path:

```json
{
  "mcpServers": {
    "american-superblock": {
      "command": "node",
      "args": ["/absolute/path/American-Superblock/mcp/server.mjs"]
    }
  }
}
```

## Tools

- get_project: metadata and viewer links
- get_superblock: real generated model summary
- list_elements: paginated BIM element filtering
- inspect_element: element metadata and paginated geometry parts
- analyze_density: residential counts, base-plan program area, homes per acre
- get_system_status: egress validity and engineering limitations
- export_model: geometry JSON or browser IFC4 export

First model access starts a headless browser and can take several minutes. Local export files live in the process temp directory. Persistent model edits, arbitrary geometry generation, IFC4x3 and certified analyses are not implemented. Drawing and image tools are available in V2. Raw level indices are zero-based; -1 is basement. Area metrics are not GFA or FAR.

## V2: views, drawings and temporary design variations

- `get_parameters`: actual supported design controls, defaults and ranges.
- `get_model_view`: PNG of the actual WebGL model; axonometric building focus, whole-site plan or low camera; LOD, shadows and cut.
- `get_floor_plan`: real drawing engine plan; PNG plus temporary vector SVG. Level 0 means Level 01, -1 means basement. Use site=true for the site sheet.
- `get_section`: real drawing engine A301–A304 or V301–V304 sections, with scope and offset; PNG plus temporary vector SVG.
- `modify_parameters`: rebuild an isolated browser model and report actual applied settings and program summary. Pass returned parameters into the view or drawing tools explicitly.

Example: modify_parameters with { "setback": 19, "runPerStorey": 2.25, "stepFloors": 3 }, then get_model_view with { "parameters": { "setback": 19, "runPerStorey": 2.25, "stepFloors": 3 } }. The default model, GitHub source, IFC exports and other users' requests are unchanged. Variants are stateless and are not saved. Default export_model continues to export only the baseline.

SVG files are temporary (up to one hour, at most 12 drawings per process, earlier eviction possible). Remote links use /drawings/:id; local stdio returns a temporary file path. PNG images are returned directly as MCP image content; display depends on the client. Browser work is serialized with at most two admitted jobs; excess work returns an error. Render Free cold starts, memory and client timeouts can limit these operations.

Run TEST_V2=1 npm test for full browser view, plan, section and variation checks. The standard smoke test checks discovery, bounds and baseline exports.

## V3: portable design version history

- `create_design`: creates a version manifest from validated browser parameters.
- `edit_design`: appends a revision. The original manifest is unchanged.
- `undo_design` and `redo_design`: move the current revision cursor.
- `compare_designs`: actually rebuilds two selected revisions and compares model schedule counts, base-plan program area and V geometry maximum shift.
- `export_design`: generates real browser IFC4 or geometry JSON for the selected revision.

Every history operation returns a complete portable JSON manifest and current revision. Save that manifest on the client (or as a JSON file) to resume later; there is no shared project database. A manifest supports up to 20 revisions. Editing after undo replaces the redo branch in the returned manifest, so retain the previous manifest to preserve the abandoned branch. IDs are deterministic integrity identifiers, not authorization or digital signatures. The current revision parameters can be supplied to the V2 view and drawing tools. Manifests describe inputs, not frozen geometry snapshots: later architectural engine changes may produce different geometry.

Version export files are temporary (one hour maximum, two retained files per process, earlier eviction possible); remote links are bearer links, so do not share private designs on the unauthenticated public instance. The baseline export_model remains unchanged. Compare area is the undeformed base-plan program schedule including offices, not FAR, GFA, or the deformed V geometry floor area. No arbitrary topology editing, engineering certification, server database or persistent multi-user collaboration is implemented.

Run TEST_V3=1 npm test for actual browser revision comparison and JSON export checks; TEST_V2=1 enables the V2 image checks. GET /health and get_project report the MCP release version (health also reports tool count); health does not establish browser readiness.

## V4: architectural analysis and candidate optimization

All six tools consume actual browser JSON exports, using the baseline cache or rebuilding requested parameters in an isolated browser.

- `analyze_daylight`: approximate vertical facade glazing area and model-axis orientation distribution; unshaded two-sided directional projection only, no geographic sun path, occlusion or illuminance simulation.
- `check_clashes`: bounded AABB screening of distinct exported geometry groups, with positive overlap tolerance; false positives and expected joints possible. Partial screens and missing geometry are explicitly marked. Not exact solid clashes.
- `analyze_egress`: exposes invalidated route status for the V section. Does not claim travel distances or compliance.
- `analyze_structure`: inventory of modeled columns, beams, members and slabs, including loft parts and unresolved engineering issues; not load analysis.
- `analyze_efficiency`: actual undeformed base-plan residential program, homes, density, average area; net-to-gross remains unavailable, and program/site ratio is not FAR.
- `optimize_design`: evaluate two or three explicit candidates using real model exports and rank by weighted normalized housing count, residential program area and low V shift. Returns Pareto flags and failed candidates; not a global optimization or a code-compliance assessment.

Example optimization input: {"candidates":[{},{"setback":20,"runPerStorey":3}],"weights":{"homes":3,"area":2,"lowShift":1}}. Analysis is read-only. No shared edits, third-party climate data, certification or cost estimates. Render Free capacity and client timeouts may limit browser operations.

Run TEST_V4=1 npm test for live model analysis tests, including bounded candidate optimization. Synthetic analysis formula tests run by default.

## Remote endpoint

GitHub Pages cannot run this server. Build a Docker image from the repository root:

```sh
docker build -f mcp/Dockerfile -t american-superblock-mcp .
docker run --rm -p 127.0.0.1:3000:3000 american-superblock-mcp
```

Deploy this Dockerfile with the repository root as build context on a Docker-compatible host (e.g. Render). Configure HOST=0.0.0.0, PORT as assigned by the host, PUBLIC_BASE_URL=https://your-service.example (your actual HTTPS origin). Set ALLOWED_ORIGINS to a comma-separated list of explicitly trusted browser origins if needed. Endpoint: PUBLIC_BASE_URL/mcp. Health: /health. Download paths: /artifacts/json and /artifacts/ifc.

This is a stateless Streamable HTTP endpoint. Add HTTPS, gateway rate limits, resource limits, monitoring, and authentication if required by your deployment policy. The default tools expose only the public design, no private user data or arbitrary URL/filesystem access. No public hosted endpoint is supplied by this repository itself. Check client compatibility and successful smoke tests before advertising it.

## Smoke test

npm test exercises MCP discovery, the existing model's JSON export and queries. TEST_IFC=1 npm test also runs IFC export. A successful health endpoint alone does not establish model readiness. 

The architecture is a research prototype, not a certified design. Original project rights remain unchanged; this README does not grant an additional license.
