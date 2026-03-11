/**
 * ReviewLayer — Drizzle ORM Schema
 *
 * Domain model for all core entities.
 * Provenance discipline:
 *   - `exact_source` (jsonb) — build-time leaf from data-rl-source. Single frame or null.
 *   - `resolved_component_stack` (jsonb) — runtime ancestry from fiber walk. Array of frames.
 *   - These are ALWAYS separate columns. Never merged.
 *
 * Trust boundaries:
 *   - Reporter: session metadata, annotations, summaries, clarifications. NO file paths, NO provenance.
 *   - Developer: full technical context including provenance, design diff, acceptance criteria.
 *   - Agent: full ExecutionBundle, constrained mutations, audit trail.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// =============================================================================
// Enums
// =============================================================================

export const organizationPlanEnum = pgEnum("organization_plan", [
  "free",
  "pro",
  "team",
  "enterprise",
]);

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);

export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "expired"]);

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "submitted",
  "archived",
]);

export const annotationTypeEnum = pgEnum("annotation_type", [
  "element_select",
  "freeform_draw",
  "screenshot_region",
  "full_page_note",
  "reference_image",
]);

export const bundleStatusEnum = pgEnum("bundle_status", [
  "pending_review",
  "approved",
  "in_progress",
  "resolved",
  "rejected",
]);

export const severityEnum = pgEnum("severity", ["critical", "major", "minor", "suggestion"]);

export const categoryEnum = pgEnum("feedback_category", [
  "visual_bug",
  "layout_issue",
  "copy_change",
  "feature_request",
  "behavior_bug",
  "accessibility",
  "performance",
]);

export const assigneeTypeEnum = pgEnum("assignee_type", ["human", "agent", "unassigned"]);

export const resolutionModeEnum = pgEnum("resolution_mode", [
  "fiber_meta",
  "server_prefix",
  "leaf_only",
  "heuristic",
]);

export const lineKindEnum = pgEnum("line_kind", ["leaf-dom", "definition", "callsite"]);

export const agentTokenPermissionEnum = pgEnum("agent_token_permission", [
  "read",
  "readwrite",
  "full",
]);

export const agentActionTypeEnum = pgEnum("agent_action_type", [
  "fetch",
  "plan",
  "result",
  "validate",
  "mark_in_progress",
  "mark_resolved",
]);

// =============================================================================
// Organizations
// =============================================================================

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: organizationPlanEnum("plan").notNull().default("free"),
  seatLimit: integer("seat_limit").default(5),
  ssoConfig: jsonb("sso_config"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// Organization Members (users within orgs)
// =============================================================================

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id").notNull(), // Auth.js user ID
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("org_member_unique").on(table.organizationId, table.userId),
    index("org_member_org_idx").on(table.organizationId),
  ],
);

// =============================================================================
// Projects
// =============================================================================

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    reviewUrl: text("review_url"),
    githubRepo: varchar("github_repo", { length: 500 }),
    githubBranch: varchar("github_branch", { length: 255 }),
    figmaFileId: varchar("figma_file_id", { length: 255 }),
    framework: varchar("framework", { length: 50 }), // "nextjs", "react", "vue", etc.
    /** When true, agents can transition bundles to "resolved" or "rejected". Default: false (human-gated). */
    agentResolutionEnabled: boolean("agent_resolution_enabled").notNull().default(false),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("project_org_idx").on(table.organizationId)],
);

// =============================================================================
// Reviewer Invites
// =============================================================================

export const reviewerInvites = pgTable(
  "reviewer_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    status: inviteStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invite_project_idx").on(table.projectId),
    index("invite_email_idx").on(table.email),
  ],
);

// =============================================================================
// Review Sessions
// =============================================================================

export const reviewSessions = pgTable(
  "review_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    reviewerEmail: varchar("reviewer_email", { length: 255 }).notNull(),
    versionTag: varchar("version_tag", { length: 255 }),
    commitSha: varchar("commit_sha", { length: 40 }),
    buildUrl: text("build_url"),
    status: sessionStatusEnum("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (table) => [
    index("session_project_idx").on(table.projectId),
    index("session_reviewer_idx").on(table.reviewerEmail),
  ],
);

// =============================================================================
// Annotations
// =============================================================================

export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => reviewSessions.id),
    bundleId: uuid("bundle_id").references(() => executionBundles.id),
    type: annotationTypeEnum("type").notNull(),
    pageUrl: text("page_url").notNull(),
    viewport: jsonb("viewport"), // Viewport from contracts
    domSelector: text("dom_selector"),
    elementBbox: jsonb("element_bbox"), // { x, y, width, height }
    computedStyles: jsonb("computed_styles"), // Record<string, string>
    rawText: text("raw_text"),
    drawingSvgUrl: text("drawing_svg_url"),
    screenshotUrl: text("screenshot_url"),
    referenceImages: jsonb("reference_images").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("annotation_session_idx").on(table.sessionId),
    index("annotation_bundle_idx").on(table.bundleId),
  ],
);

// =============================================================================
// Execution Bundles
// =============================================================================

export const executionBundles = pgTable(
  "execution_bundles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    sessionId: uuid("session_id").references(() => reviewSessions.id),

    // Schema versioning
    schemaVersion: varchar("schema_version", { length: 20 }).notNull().default("1.0.0"),

    // Content
    title: text("title").notNull(),
    summary: text("summary").notNull(), // plain-language, reporter-safe
    normalizedTask: text("normalized_task"), // precise, for developers and agents
    category: categoryEnum("category"),
    severity: severityEnum("severity"),

    // Context
    pageUrl: text("page_url").notNull(),
    viewport: jsonb("viewport"), // Viewport
    screenshotUrl: text("screenshot_url"),
    annotationCoordinates: jsonb("annotation_coordinates"),
    domSelector: text("dom_selector"),
    computedStyles: jsonb("computed_styles"),
    clientRawText: text("client_raw_text"),
    referenceImages: jsonb("reference_images").$type<string[]>().default([]),

    // =========================================================================
    // PROVENANCE — exact_source and resolved_component_stack are ALWAYS SEPARATE
    // =========================================================================

    /**
     * Build-time exact leaf/render-site from data-rl-source.
     * Single frame: { file_path, component_name, line, line_kind: "leaf-dom" }
     * NULL when no build plugin or instrumentation unavailable.
     */
    exactSource: jsonb("exact_source"),

    /**
     * Runtime-resolved ancestry from fiber walk + __rlMeta.
     * Array of frames, each with { component_name, file_path?, line?, line_kind, is_library, confidence? }
     * Empty array when ancestry resolution fails completely.
     */
    resolvedComponentStack: jsonb("resolved_component_stack").$type<unknown[]>().default([]),

    /**
     * How the stack was resolved: fiber_meta | server_prefix | leaf_only | heuristic
     */
    resolutionMode: resolutionModeEnum("resolution_mode"),

    /**
     * Why ancestry is partial or unavailable.
     */
    missingReasons: jsonb("missing_reasons").$type<string[]>().default([]),

    /**
     * When ancestry stops at a known boundary: portal | separate_root | rsc_client_boundary
     */
    rootBoundaryKind: varchar("root_boundary_kind", { length: 50 }),

    // Derived suggestions
    componentCandidates: jsonb("component_candidates").$type<unknown[]>().default([]),
    fileCandidates: jsonb("file_candidates").$type<string[]>().default([]),
    designCandidates: jsonb("design_candidates").$type<unknown[]>().default([]),
    designDiff: jsonb("design_diff"),

    // Build context
    branch: varchar("branch", { length: 255 }),
    commitSha: varchar("commit_sha", { length: 40 }),
    buildUrl: text("build_url"),

    // AI-generated
    acceptanceCriteria: jsonb("acceptance_criteria").$type<string[]>().default([]),
    constraints: jsonb("constraints").$type<string[]>().default([]),
    confidence: jsonb("confidence"), // ConfidenceScores
    unresolvedAmbiguities: jsonb("unresolved_ambiguities").$type<string[]>().default([]),
    validationSteps: jsonb("validation_steps").$type<string[]>().default([]),

    // Lifecycle
    status: bundleStatusEnum("status").notNull().default("pending_review"),
    assigneeType: assigneeTypeEnum("assignee_type").notNull().default("unassigned"),
    assigneeId: text("assignee_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bundle_project_idx").on(table.projectId),
    index("bundle_session_idx").on(table.sessionId),
    index("bundle_status_idx").on(table.status),
    index("bundle_assignee_idx").on(table.assigneeType, table.assigneeId),
  ],
);

// =============================================================================
// Execution Bundle Frames (normalized stack frames for query)
// =============================================================================

export const executionBundleFrames = pgTable(
  "execution_bundle_frames",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => executionBundles.id),
    position: integer("position").notNull(), // 0-indexed order in stack
    componentName: varchar("component_name", { length: 500 }).notNull(),
    filePath: text("file_path"),
    line: integer("line"),
    lineKind: lineKindEnum("line_kind").notNull(),
    isLibrary: boolean("is_library").notNull().default(false),
    confidence: integer("confidence"), // 0-100 (null = high)
  },
  (table) => [
    index("frame_bundle_idx").on(table.bundleId),
    index("frame_file_idx").on(table.filePath),
  ],
);

// =============================================================================
// Design Candidates
// =============================================================================

export const designCandidates = pgTable(
  "design_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => executionBundles.id),
    figmaComponentId: varchar("figma_component_id", { length: 255 }).notNull(),
    componentName: varchar("component_name", { length: 500 }).notNull(),
    confidence: integer("confidence").notNull(), // 0-100
    rankingEvidence: jsonb("ranking_evidence"), // signals used for ranking
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("design_candidate_bundle_idx").on(table.bundleId)],
);

// =============================================================================
// Agent Tokens
// =============================================================================

export const agentTokens = pgTable(
  "agent_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    name: varchar("name", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(), // bcrypt hash
    permission: agentTokenPermissionEnum("permission").notNull().default("read"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_token_project_idx").on(table.projectId),
    uniqueIndex("agent_token_hash_idx").on(table.tokenHash),
  ],
);

// =============================================================================
// Agent Actions (audit trail)
// =============================================================================

export const agentActions = pgTable(
  "agent_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: uuid("bundle_id").references(() => executionBundles.id),
    agentTokenId: uuid("agent_token_id").references(() => agentTokens.id),
    actionType: agentActionTypeEnum("action_type").notNull(),
    payload: jsonb("payload"), // full request/response for audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_action_bundle_idx").on(table.bundleId),
    index("agent_action_token_idx").on(table.agentTokenId),
    index("agent_action_created_idx").on(table.createdAt),
  ],
);

// =============================================================================
// External Exports
// =============================================================================

export const externalExports = pgTable(
  "external_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => executionBundles.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    service: varchar("service", { length: 50 }).notNull(), // "jira", "linear", "github", "slack"
    externalIssueId: varchar("external_issue_id", { length: 255 }),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("export_bundle_idx").on(table.bundleId),
    index("export_project_idx").on(table.projectId),
  ],
);

// =============================================================================
// Notifications
// =============================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    recipientEmail: varchar("recipient_email", { length: 255 }),
    recipientUserId: text("recipient_user_id"),
    type: varchar("type", { length: 100 }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    metadata: jsonb("metadata"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_project_idx").on(table.projectId),
    index("notification_recipient_idx").on(table.recipientUserId),
  ],
);

// =============================================================================
// Audit Events (general system audit log)
// =============================================================================

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    projectId: uuid("project_id").references(() => projects.id),
    actorId: text("actor_id"), // user ID or agent token ID
    actorType: varchar("actor_type", { length: 50 }).notNull(), // "user", "agent", "system"
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_org_idx").on(table.organizationId),
    index("audit_project_idx").on(table.projectId),
    index("audit_created_idx").on(table.createdAt),
  ],
);

// =============================================================================
// Integration Credentials
// =============================================================================

export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    service: varchar("service", { length: 50 }).notNull(), // "github", "figma", "jira", etc.
    accessTokenEncrypted: text("access_token_encrypted").notNull(), // AES-256-GCM
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    metadata: jsonb("metadata"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cred_project_service_idx").on(table.projectId, table.service),
  ],
);
