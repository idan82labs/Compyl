/**
 * Internal worker integration routes.
 *
 * These endpoints are called by internal services to submit AI jobs.
 * Not exposed to external clients.
 */

import type { FastifyInstance } from "fastify";
import type { WorkerJobRequest } from "@compyl/contracts";
import { WorkerClient } from "../worker-client.js";
import { randomUUID } from "node:crypto";

const workerClient = new WorkerClient({
  baseUrl: process.env["WORKER_AI_URL"] ?? "http://localhost:8001",
});

export async function workerRoutes(app: FastifyInstance) {
  /**
   * Submit a worker job.
   * The API server acts as the only client of the worker.
   */
  app.post<{
    Body: {
      job_type: WorkerJobRequest["job_type"];
      payload: unknown;
      idempotency_key?: string;
    };
  }>("/jobs", async (request, reply) => {
    const { job_type, payload, idempotency_key } = request.body;

    const jobRequest: WorkerJobRequest = {
      job_id: randomUUID(),
      job_type,
      payload,
      idempotency_key: idempotency_key ?? randomUUID(),
      created_at: new Date().toISOString(),
    };

    const result = await workerClient.submitJob(jobRequest);
    return reply.send(result);
  });
}
