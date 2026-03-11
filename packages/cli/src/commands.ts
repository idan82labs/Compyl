/**
 * CLI command handlers.
 *
 * Each command wraps an ApiClient call with audit event emission.
 * Commands use the same ApiClient interface as the MCP server
 * to ensure contract consistency.
 */

import type { ApiClient } from "@compyl/mcp-server";
import type { AgentTokenPermission } from "@compyl/contracts";
import { createCliAuditEvent, type CliAuditEmitter } from "./audit.js";

export interface CommandContext {
  api: ApiClient;
  audit: CliAuditEmitter;
  actorId?: string;
  projectId?: string;
  /** Token permission level. When set, mutating commands are blocked for "read" tokens. */
  permission?: AgentTokenPermission;
}

/** CLI commands that require write permission. */
const MUTATING_COMMANDS = new Set([
  "status",
  "push-result",
  "validate",
]);

function isCommandAllowed(command: string, permission: AgentTokenPermission | undefined): boolean {
  if (!permission) return true;
  if (permission === "full" || permission === "readwrite") return true;
  return !MUTATING_COMMANDS.has(command);
}

/** Run a command with audit wrapping and scope enforcement. */
async function audited<T>(
  ctx: CommandContext,
  command: string,
  payload: Record<string, unknown>,
  target: { type?: string; id?: string; projectId?: string; sessionId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();

  // Scope enforcement — check before executing
  if (!isCommandAllowed(command, ctx.permission)) {
    ctx.audit(createCliAuditEvent({
      action: command,
      payload,
      actorId: ctx.actorId,
      targetEntityType: target.type,
      targetEntityId: target.id,
      projectId: target.projectId ?? ctx.projectId,
      sessionId: target.sessionId,
      status: "denied",
      durationMs: Date.now() - start,
      errorCode: "SCOPE_DENIED",
      errorMessage: `Token with "${ctx.permission}" permission cannot execute mutating command "${command}"`,
    }));
    throw new Error(`Command "${command}" requires write permission, but token has "${ctx.permission}" scope`);
  }

  try {
    const result = await fn();
    ctx.audit(createCliAuditEvent({
      action: command,
      payload,
      actorId: ctx.actorId,
      targetEntityType: target.type,
      targetEntityId: target.id,
      projectId: target.projectId ?? ctx.projectId,
      sessionId: target.sessionId,
      status: "success",
      durationMs: Date.now() - start,
    }));
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    ctx.audit(createCliAuditEvent({
      action: command,
      payload,
      actorId: ctx.actorId,
      targetEntityType: target.type,
      targetEntityId: target.id,
      projectId: target.projectId ?? ctx.projectId,
      sessionId: target.sessionId,
      status: "error",
      durationMs: Date.now() - start,
      errorCode: "CLI_ERROR",
      errorMessage: error.message,
    }));
    throw err;
  }
}

/** `compyl pull` — fetch bundles for a project. */
export async function pullCommand(
  ctx: CommandContext,
  args: { project_id: string; status?: string; limit?: number },
): Promise<{ bundles: unknown[]; total: number }> {
  return audited(ctx, "pull", args, { type: "project", id: args.project_id, projectId: args.project_id },
    () => ctx.api.listBundles(args),
  );
}

/** `compyl bundle <id>` — get a single bundle. */
export async function bundleCommand(
  ctx: CommandContext,
  args: { bundle_id: string },
): Promise<unknown> {
  return audited(ctx, "bundle", args, { type: "bundle", id: args.bundle_id },
    () => ctx.api.getBundle(args.bundle_id),
  );
}

/** `compyl status <bundle_id> <new_status>` — update bundle status. */
export async function statusCommand(
  ctx: CommandContext,
  args: { bundle_id: string; status: string; reason?: string },
): Promise<{ success: boolean; error?: string }> {
  return audited(ctx, "status", args, { type: "bundle", id: args.bundle_id },
    () => ctx.api.updateBundleStatus(args.bundle_id, args.status, args.reason),
  );
}

/** `compyl plan <bundle_id>` — get acceptance criteria for planning. */
export async function planCommand(
  ctx: CommandContext,
  args: { bundle_id: string },
): Promise<unknown> {
  return audited(ctx, "plan", args, { type: "bundle", id: args.bundle_id },
    () => ctx.api.getAcceptanceCriteria(args.bundle_id),
  );
}

/** `compyl push-result <bundle_id>` — propose a resolution. */
export async function pushResultCommand(
  ctx: CommandContext,
  args: {
    bundle_id: string;
    resolution_summary: string;
    files_changed: string[];
    commit_sha?: string;
    pr_url?: string;
  },
): Promise<{ success: boolean; proposal_id?: string; error?: string }> {
  return audited(ctx, "push-result", args, { type: "bundle", id: args.bundle_id },
    () => ctx.api.proposeResolution(args.bundle_id, {
      resolution_summary: args.resolution_summary,
      files_changed: args.files_changed,
      commit_sha: args.commit_sha,
      pr_url: args.pr_url,
    }),
  );
}

/** `compyl validate <bundle_id>` — submit validation results. */
export async function validateCommand(
  ctx: CommandContext,
  args: {
    bundle_id: string;
    validation_results: Array<{ step: string; passed: boolean; evidence?: string }>;
  },
): Promise<{ success: boolean; error?: string }> {
  return audited(ctx, "validate", args, { type: "bundle", id: args.bundle_id },
    () => ctx.api.submitValidationResults(args.bundle_id, args.validation_results),
  );
}

/** `compyl diff` — search bundles (used for comparing/finding). */
export async function diffCommand(
  ctx: CommandContext,
  args: { project_id: string; query: string; limit?: number },
): Promise<{ bundles: unknown[]; total: number }> {
  return audited(ctx, "diff", args, { type: "project", id: args.project_id, projectId: args.project_id },
    () => ctx.api.searchBundles(args),
  );
}
