/**
 * Organization and project management routes.
 *
 * Organizations own projects. Projects scope all review data.
 * Trust boundary: org operations require admin/owner role.
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { organizations, projects, organizationMembers } from "@reviewlayer/db";
import { requireAuth } from "../middleware/auth.js";

export async function projectRoutes(app: FastifyInstance) {
  /**
   * Create an organization.
   * Any authenticated user can create an org (they become the owner).
   */
  app.post<{
    Body: { name: string };
  }>(
    "/organizations",
    { preHandler: requireAuth("member", "admin", "owner") },
    async (request, reply) => {
      const { name } = request.body;

      const [org] = await app.db
        .insert(organizations)
        .values({ name })
        .returning({ id: organizations.id, name: organizations.name });

      // Creator becomes owner
      if (request.auth?.userId && request.auth?.email) {
        await app.db.insert(organizationMembers).values({
          organizationId: org!.id,
          userId: request.auth.userId,
          email: request.auth.email,
          role: "owner",
        });
      }

      return reply.status(201).send({
        organization_id: org!.id,
        name: org!.name,
      });
    },
  );

  /**
   * Create a project within an organization.
   * Requires admin/owner role in the organization.
   */
  app.post<{
    Params: { orgId: string };
    Body: {
      name: string;
      review_url?: string;
      github_repo?: string;
      github_branch?: string;
      figma_file_id?: string;
      framework?: string;
    };
  }>(
    "/organizations/:orgId/projects",
    { preHandler: requireAuth("admin", "owner") },
    async (request, reply) => {
      const { orgId } = request.params;
      const body = request.body;

      // Verify org exists
      const orgs = await app.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (orgs.length === 0) {
        return reply.status(404).send({ error: "Organization not found" });
      }

      const [project] = await app.db
        .insert(projects)
        .values({
          organizationId: orgId,
          name: body.name,
          reviewUrl: body.review_url,
          githubRepo: body.github_repo,
          githubBranch: body.github_branch,
          figmaFileId: body.figma_file_id,
          framework: body.framework,
        })
        .returning({
          id: projects.id,
          name: projects.name,
        });

      return reply.status(201).send({
        project_id: project!.id,
        name: project!.name,
        organization_id: orgId,
      });
    },
  );

  /**
   * List projects in an organization.
   */
  app.get<{
    Params: { orgId: string };
  }>(
    "/organizations/:orgId/projects",
    { preHandler: requireAuth("member", "admin", "owner") },
    async (request, _reply) => {
      const { orgId } = request.params;

      const results = await app.db
        .select({
          id: projects.id,
          name: projects.name,
          reviewUrl: projects.reviewUrl,
          framework: projects.framework,
          status: projects.status,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(eq(projects.organizationId, orgId));

      return { projects: results, count: results.length };
    },
  );

  /**
   * Get project details.
   */
  app.get<{
    Params: { projectId: string };
  }>(
    "/projects/:projectId",
    { preHandler: requireAuth("member", "admin", "owner", "agent") },
    async (request, reply) => {
      const { projectId } = request.params;

      const results = await app.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      const project = results[0];
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      return project;
    },
  );
}
