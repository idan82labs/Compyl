/**
 * API server entry point.
 *
 * Validates environment, creates DB connection, starts Fastify.
 */

import { validateEnv } from "@compyl/config";
import { buildApp } from "./app.js";

async function main() {
  const env = validateEnv();

  const app = await buildApp();

  await app.listen({
    port: parseInt(env.PORT, 10),
    host: env.HOST,
  });
}

main().catch((err) => {
  console.error("Failed to start API server:", err);
  process.exit(1);
});
