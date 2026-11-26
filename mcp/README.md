# MEMO Studio | American Superblock MCP

A read-only Model Context Protocol server that runs the original American Superblock browser model with Playwright, rather than recreating the architecture. It uses the existing geometry JSON and IFC4 export buttons. The default model is cached per process. No edits to the browser application are required.

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

First model access starts a headless browser and can take several minutes. Local export files live in the process temp directory. Custom generation, edits, IFC4x3, certified analyses and drawing exports are not implemented. Raw level indices are zero-based; -1 is basement. Area metrics are not GFA or FAR.

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
