CREATE TYPE "public"."agent_action_type" AS ENUM('fetch', 'plan', 'result', 'validate', 'mark_in_progress', 'mark_resolved');--> statement-breakpoint
CREATE TYPE "public"."agent_token_permission" AS ENUM('read', 'readwrite', 'full');--> statement-breakpoint
CREATE TYPE "public"."annotation_type" AS ENUM('element_select', 'freeform_draw', 'screenshot_region', 'full_page_note', 'reference_image');--> statement-breakpoint
CREATE TYPE "public"."assignee_type" AS ENUM('human', 'agent', 'unassigned');--> statement-breakpoint
CREATE TYPE "public"."bundle_status" AS ENUM('pending_review', 'approved', 'in_progress', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('visual_bug', 'layout_issue', 'copy_change', 'feature_request', 'behavior_bug', 'accessibility', 'performance');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."line_kind" AS ENUM('leaf-dom', 'definition', 'callsite');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."organization_plan" AS ENUM('free', 'pro', 'team', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."resolution_mode" AS ENUM('fiber_meta', 'server_prefix', 'leaf_only', 'heuristic');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'submitted', 'archived');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'major', 'minor', 'suggestion');--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid,
	"agent_token_id" uuid,
	"action_type" "agent_action_type" NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"permission" "agent_token_permission" DEFAULT 'read' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"bundle_id" uuid,
	"type" "annotation_type" NOT NULL,
	"page_url" text NOT NULL,
	"viewport" jsonb,
	"dom_selector" text,
	"element_bbox" jsonb,
	"computed_styles" jsonb,
	"raw_text" text,
	"drawing_svg_url" text,
	"screenshot_url" text,
	"reference_images" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"actor_id" text,
	"actor_type" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"figma_component_id" varchar(255) NOT NULL,
	"component_name" varchar(500) NOT NULL,
	"confidence" integer NOT NULL,
	"ranking_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_bundle_frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"component_name" varchar(500) NOT NULL,
	"file_path" text,
	"line" integer,
	"line_kind" "line_kind" NOT NULL,
	"is_library" boolean DEFAULT false NOT NULL,
	"confidence" integer
);
--> statement-breakpoint
CREATE TABLE "execution_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"session_id" uuid,
	"schema_version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"normalized_task" text,
	"category" "feedback_category",
	"severity" "severity",
	"page_url" text NOT NULL,
	"viewport" jsonb,
	"screenshot_url" text,
	"annotation_coordinates" jsonb,
	"dom_selector" text,
	"computed_styles" jsonb,
	"client_raw_text" text,
	"reference_images" jsonb DEFAULT '[]'::jsonb,
	"exact_source" jsonb,
	"resolved_component_stack" jsonb DEFAULT '[]'::jsonb,
	"resolution_mode" "resolution_mode",
	"missing_reasons" jsonb DEFAULT '[]'::jsonb,
	"root_boundary_kind" varchar(50),
	"component_candidates" jsonb DEFAULT '[]'::jsonb,
	"file_candidates" jsonb DEFAULT '[]'::jsonb,
	"design_candidates" jsonb DEFAULT '[]'::jsonb,
	"design_diff" jsonb,
	"branch" varchar(255),
	"commit_sha" varchar(40),
	"build_url" text,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb,
	"constraints" jsonb DEFAULT '[]'::jsonb,
	"confidence" jsonb,
	"unresolved_ambiguities" jsonb DEFAULT '[]'::jsonb,
	"validation_steps" jsonb DEFAULT '[]'::jsonb,
	"status" "bundle_status" DEFAULT 'pending_review' NOT NULL,
	"assignee_type" "assignee_type" DEFAULT 'unassigned' NOT NULL,
	"assignee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"service" varchar(50) NOT NULL,
	"external_issue_id" varchar(255),
	"external_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"service" varchar(50) NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"metadata" jsonb,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"recipient_email" varchar(255),
	"recipient_user_id" text,
	"type" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" "organization_plan" DEFAULT 'free' NOT NULL,
	"seat_limit" integer DEFAULT 5,
	"sso_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"review_url" text,
	"github_repo" varchar(500),
	"github_branch" varchar(255),
	"figma_file_id" varchar(255),
	"framework" varchar(50),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"reviewer_email" varchar(255) NOT NULL,
	"version_tag" varchar(255),
	"commit_sha" varchar(40),
	"build_url" text,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviewer_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_bundle_id_execution_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."execution_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_agent_token_id_agent_tokens_id_fk" FOREIGN KEY ("agent_token_id") REFERENCES "public"."agent_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_bundle_id_execution_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."execution_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_candidates" ADD CONSTRAINT "design_candidates_bundle_id_execution_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."execution_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_bundle_frames" ADD CONSTRAINT "execution_bundle_frames_bundle_id_execution_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."execution_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_bundles" ADD CONSTRAINT "execution_bundles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_bundles" ADD CONSTRAINT "execution_bundles_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_exports" ADD CONSTRAINT "external_exports_bundle_id_execution_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."execution_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_exports" ADD CONSTRAINT "external_exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_invites" ADD CONSTRAINT "reviewer_invites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_action_bundle_idx" ON "agent_actions" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "agent_action_token_idx" ON "agent_actions" USING btree ("agent_token_id");--> statement-breakpoint
CREATE INDEX "agent_action_created_idx" ON "agent_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_token_project_idx" ON "agent_tokens" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_token_hash_idx" ON "agent_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "annotation_session_idx" ON "annotations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "annotation_bundle_idx" ON "annotations" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_project_idx" ON "audit_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "design_candidate_bundle_idx" ON "design_candidates" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "frame_bundle_idx" ON "execution_bundle_frames" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "frame_file_idx" ON "execution_bundle_frames" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "bundle_project_idx" ON "execution_bundles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "bundle_session_idx" ON "execution_bundles" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "bundle_status_idx" ON "execution_bundles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bundle_assignee_idx" ON "execution_bundles" USING btree ("assignee_type","assignee_id");--> statement-breakpoint
CREATE INDEX "export_bundle_idx" ON "external_exports" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "export_project_idx" ON "external_exports" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cred_project_service_idx" ON "integration_credentials" USING btree ("project_id","service");--> statement-breakpoint
CREATE INDEX "notification_project_idx" ON "notifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "notification_recipient_idx" ON "notifications" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_member_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "org_member_org_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_org_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "session_project_idx" ON "review_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "session_reviewer_idx" ON "review_sessions" USING btree ("reviewer_email");--> statement-breakpoint
CREATE INDEX "invite_project_idx" ON "reviewer_invites" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invite_email_idx" ON "reviewer_invites" USING btree ("email");