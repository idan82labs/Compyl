#!/usr/bin/env node
/**
 * @compyl/cli
 *
 * CLI for Compyl. Every command emits structured AgentAction events
 * via the same audit contract as the MCP server.
 *
 * Usage:
 *   compyl pull --project <id>
 *   compyl bundle <id>
 *   compyl status <id> <status>
 *   compyl plan <id>
 *   compyl push-result <id> --summary <text> --files <paths...>
 *   compyl validate <id> --results <json>
 *   compyl diff --project <id> --query <text>
 */

export {
  pullCommand,
  bundleCommand,
  statusCommand,
  planCommand,
  pushResultCommand,
  validateCommand,
  diffCommand,
} from "./commands.js";

export { createCliAuditEvent } from "./audit.js";
export type { CliAuditEmitter } from "./audit.js";
export type { CommandContext } from "./commands.js";
