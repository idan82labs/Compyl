#!/usr/bin/env node
/**
 * @reviewlayer/cli
 *
 * CLI for Compyl. Every command emits structured AgentAction events
 * via the same audit contract as the MCP server.
 *
 * Usage:
 *   reviewlayer pull --project <id>
 *   reviewlayer bundle <id>
 *   reviewlayer status <id> <status>
 *   reviewlayer plan <id>
 *   reviewlayer push-result <id> --summary <text> --files <paths...>
 *   reviewlayer validate <id> --results <json>
 *   reviewlayer diff --project <id> --query <text>
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
