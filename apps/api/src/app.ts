/**
 * Fastify application factory.
 *
 * Creates and configures the Compyl API server.
 * All routes use typed contracts from @reviewlayer/contracts.
 * DB instance is decorated onto the Fastify instance for route access.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Database } from "@reviewlayer/db";
import { createDb } from "@reviewlayer/db";
import { getEnv } from "@reviewlayer/config";

import { projectRoutes } from "./routes/projects.js";
import { inviteRoutes } from "./routes/invites.js";
import { sessionRoutes } from "./routes/sessions.js";
import { annotationRoutes } from "./routes/annotations.js";
import { bundleRoutes } from "./routes/bundles.js";
import { workerRoutes } from "./routes/worker.js";
import { activityRoutes } from "./routes/activity.js";
import { designCandidateRoutes } from "./routes/design-candidates.js";

// Extend Fastify types to include our db instance
declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export interface AppOptions {
  /** Override DATABASE_URL (for testing). */
  databaseUrl?: string;
}

export async function buildApp(opts?: AppOptions) {
  const app = Fastify({ logger: true });

  // Database
  const databaseUrl = opts?.databaseUrl ?? getEnv().DATABASE_URL;
  const db = createDb(databaseUrl);
  app.decorate("db", db);

  await app.register(cors, { origin: true });

  // Health check
  app.get("/health", async () => ({ status: "ok", service: "reviewlayer-api" }));

  // Routes
  await app.register(projectRoutes, { prefix: "/api/v1" });
  await app.register(inviteRoutes, { prefix: "/api/v1" });
  await app.register(sessionRoutes, { prefix: "/api/v1" });
  await app.register(annotationRoutes, { prefix: "/api/v1" });
  await app.register(bundleRoutes, { prefix: "/api/v1" });
  await app.register(workerRoutes, { prefix: "/api/v1/internal" });
  await app.register(activityRoutes, { prefix: "/api/v1" });
  await app.register(designCandidateRoutes, { prefix: "/api/v1" });

  return app;
}
