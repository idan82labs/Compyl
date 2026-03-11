/**
 * HTTP API client for the MCP server.
 *
 * Implements the ApiClient interface by making real HTTP requests
 * to the Compyl API server. Used in standalone/stdio mode.
 *
 * In embedded mode (e.g. inside the Fastify API process), the host
 * can provide a direct in-process ApiClient instead.
 */

import type { ApiClient } from "./server.js";
import type { AgentDTO } from "@reviewlayer/contracts";

export interface HttpApiClientConfig {
  baseUrl: string;
  token?: string;
}

export function createHttpApiClient(config: HttpApiClientConfig): ApiClient {
  const { baseUrl, token } = config;
  const base = baseUrl.replace(/\/$/, "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${method} ${path} returned ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  return {
    async listBundles(params) {
      const qs = new URLSearchParams();
      qs.set("project_id", params.project_id);
      if (params.status) qs.set("status", params.status);
      if (params.severity) qs.set("severity", params.severity);
      if (params.category) qs.set("category", params.category);
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      return request<{ bundles: AgentDTO[]; total: number }>("GET", `/api/v1/bundles?${qs}`);
    },

    async getBundle(bundleId) {
      try {
        return await request<AgentDTO>("GET", `/api/v1/bundles/${bundleId}`);
      } catch {
        return null;
      }
    },

    async updateBundleStatus(bundleId, status, reason) {
      return request<{ success: boolean; error?: string }>("PATCH", `/api/v1/bundles/${bundleId}/status`, { status, reason });
    },

    async assignBundle(bundleId, assigneeType, assigneeId) {
      return request<{ success: boolean; error?: string }>("PATCH", `/api/v1/bundles/${bundleId}/assign`, { assignee_type: assigneeType, assignee_id: assigneeId });
    },

    async proposeResolution(bundleId, params) {
      return request<{ success: boolean; proposal_id?: string; error?: string }>("POST", `/api/v1/bundles/${bundleId}/propose`, params);
    },

    async getSession(sessionId) {
      try {
        return await request<{ session_id: string; project_id: string; status: string; bundle_count: number }>("GET", `/api/v1/sessions/${sessionId}`);
      } catch {
        return null;
      }
    },

    async listSessions(params) {
      const qs = new URLSearchParams();
      qs.set("project_id", params.project_id);
      if (params.status) qs.set("status", params.status);
      if (params.limit) qs.set("limit", String(params.limit));
      return request<Array<{ session_id: string; status: string; bundle_count: number; submitted_at: string | null }>>("GET", `/api/v1/sessions?${qs}`);
    },

    async searchBundles(params) {
      const qs = new URLSearchParams();
      qs.set("project_id", params.project_id);
      qs.set("q", params.query);
      if (params.limit) qs.set("limit", String(params.limit));
      return request<{ bundles: AgentDTO[]; total: number }>("GET", `/api/v1/bundles/search?${qs}`);
    },

    async getAcceptanceCriteria(bundleId) {
      try {
        return await request<{ bundle_id: string; acceptance_criteria: string[]; validation_steps: string[] }>("GET", `/api/v1/bundles/${bundleId}/acceptance-criteria`);
      } catch {
        return null;
      }
    },

    async submitValidationResults(bundleId, results) {
      return request<{ success: boolean; error?: string }>("POST", `/api/v1/bundles/${bundleId}/validate`, { validation_results: results });
    },
  };
}
