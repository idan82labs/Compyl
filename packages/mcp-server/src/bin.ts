#!/usr/bin/env node
/**
 * Compyl MCP server — stdio entry point.
 *
 * Usage: reviewlayer-mcp [--api-url <url>] [--token <agent-token>]
 *
 * Env vars:
 * - REVIEWLAYER_API_URL: Base URL for the Compyl API (default: http://localhost:3001)
 * - REVIEWLAYER_AGENT_TOKEN: Agent token for authentication
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createReviewLayerMcpServer } from "./server.js";
import { createHttpApiClient } from "./http-client.js";
import type { AgentAction } from "@reviewlayer/contracts";

const apiUrl = process.argv.includes("--api-url")
  ? process.argv[process.argv.indexOf("--api-url") + 1]
  : process.env["REVIEWLAYER_API_URL"] ?? "http://localhost:3001";

const token = process.argv.includes("--token")
  ? process.argv[process.argv.indexOf("--token") + 1]
  : process.env["REVIEWLAYER_AGENT_TOKEN"];

if (!apiUrl) {
  console.error("Missing --api-url or REVIEWLAYER_API_URL");
  process.exit(1);
}

const apiClient = createHttpApiClient({ baseUrl: apiUrl, token });

const server = createReviewLayerMcpServer({
  apiClient,
  actorId: token ? `agent:${token.slice(0, 8)}...` : undefined,
  auditEmitter: (action: AgentAction) => {
    // In stdio mode, emit audit events as structured stderr logs.
    // Production deployments should wire this to a persistent store.
    process.stderr.write(JSON.stringify({ audit: action }) + "\n");
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);
