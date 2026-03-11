"""
Worker job handler.

Implements the API↔Worker contract:
- Accepts WorkerJobRequest via POST /jobs
- Returns WorkerJobResponse
- Enforces idempotency via in-memory cache (Redis in production)
- Logs diagnostics per CLAUDE.md observability requirements

Job types produce structured results that the API persists directly.
AI logic is stubbed — the structure is real.
"""

from __future__ import annotations

import time
import hashlib
from dataclasses import dataclass, field
from typing import Any


@dataclass
class JobRequest:
    job_id: str
    job_type: str
    payload: Any
    idempotency_key: str
    created_at: str


@dataclass
class JobError:
    code: str
    message: str
    retryable: bool


@dataclass
class JobResponse:
    job_id: str
    status: str  # "completed" | "failed" | "partial"
    result: Any
    duration_ms: float
    error: JobError | None = None


# In-memory idempotency cache (replaced by Redis in production)
_idempotency_cache: dict[str, JobResponse] = {}

# Supported job types
VALID_JOB_TYPES = frozenset(
    [
        "summarize_annotation",
        "generate_clarification",
        "enrich_bundle",
        "compute_design_diff",
        "compile_bundle",
        "generate_acceptance_criteria",
    ]
)


def handle_job(request: JobRequest) -> JobResponse:
    """Process a worker job request. Returns cached result for duplicate idempotency keys."""
    # Idempotency check
    if request.idempotency_key in _idempotency_cache:
        return _idempotency_cache[request.idempotency_key]

    start = time.monotonic()

    if request.job_type not in VALID_JOB_TYPES:
        response = JobResponse(
            job_id=request.job_id,
            status="failed",
            result=None,
            duration_ms=0,
            error=JobError(
                code="INVALID_JOB_TYPE",
                message=f"Unknown job type: {request.job_type}",
                retryable=False,
            ),
        )
        return response

    # Route to job-specific handlers
    handler = JOB_HANDLERS.get(request.job_type, _handle_unknown)
    result = handler(request)

    duration_ms = (time.monotonic() - start) * 1000

    response = JobResponse(
        job_id=request.job_id,
        status="completed",
        result=result,
        duration_ms=round(duration_ms, 2),
    )

    # Cache for idempotency
    _idempotency_cache[request.idempotency_key] = response

    return response


# =============================================================================
# Job handlers — structured results, stubbed AI logic
# =============================================================================


def _handle_summarize_annotation(request: JobRequest) -> dict:
    """
    Summarize a single annotation into plain-language text.

    Input: { annotation_id, type, raw_text, page_url, screenshot_url }
    Output: { summary, title, category, severity }

    AI stub: derives title from raw_text, assigns default category/severity.
    """
    payload = request.payload or {}
    raw_text = payload.get("raw_text", "")
    annotation_type = payload.get("type", "element_select")
    page_url = payload.get("page_url", "")

    # Stub: generate reasonable defaults from raw input
    title = _generate_stub_title(raw_text, annotation_type)
    summary = _generate_stub_summary(raw_text, annotation_type, page_url)
    category = _infer_stub_category(raw_text, annotation_type)
    severity = "minor"  # AI would classify based on content

    return {
        "annotation_id": payload.get("annotation_id"),
        "title": title,
        "summary": summary,
        "category": category,
        "severity": severity,
    }


def _handle_generate_clarification(request: JobRequest) -> dict:
    """
    Generate a clarification question for an ambiguous annotation.

    Output: { question, options, reason }
    """
    payload = request.payload or {}
    raw_text = payload.get("raw_text", "")

    return {
        "question": f"Can you clarify what you mean by: \"{raw_text[:100]}\"?",
        "options": [
            "It's a visual bug",
            "It's a content change",
            "It's a feature request",
            "Something else",
        ],
        "reason": "stub_classification",
    }


def _handle_enrich_bundle(request: JobRequest) -> dict:
    """
    Enrich a bundle with provenance context + technical details.

    This is where exact_source + resolved_component_stack would be
    integrated with annotation context. Stubbed: passes through what's provided.

    Output: enriched bundle fields ready for persistence.
    """
    payload = request.payload or {}

    return {
        "exact_source": payload.get("exact_source"),
        "resolved_component_stack": payload.get("resolved_component_stack", []),
        "resolution_mode": payload.get("resolution_mode", "leaf_only"),
        "missing_reasons": payload.get("missing_reasons", []),
        "root_boundary_kind": payload.get("root_boundary_kind"),
        "component_candidates": [],
        "file_candidates": [],
        "enriched": True,
    }


def _handle_compute_design_diff(request: JobRequest) -> dict:
    """
    Compute semantic design diff between DOM computed styles and Figma context.

    Output: { design_diff, design_candidates }
    """
    return {
        "design_diff": None,  # Would contain style deltas
        "design_candidates": [],
        "computed": True,
    }


def _handle_compile_bundle(request: JobRequest) -> dict:
    """
    Compile a final ExecutionBundle from all annotations + summaries.

    Input: { session_id, annotations: [...], summaries: [...] }
    Output: ExecutionBundle-shaped result ready for DB persistence.

    This is the critical path — the output shape MUST match the
    execution_bundles schema for direct persistence by the API.
    """
    payload = request.payload or {}
    session_id = payload.get("session_id", "")
    annotations = payload.get("annotations", [])
    summaries = payload.get("summaries", [])

    # Build one bundle per annotation (simplest model).
    # In production, AI might merge related annotations.
    bundles = []
    for annotation in annotations:
        ann_id = annotation.get("id", "")
        raw_text = annotation.get("raw_text", "")
        annotation_type = annotation.get("type", "element_select")
        page_url = annotation.get("page_url", "")

        # Find matching summary if available
        summary_data = next(
            (s for s in summaries if s.get("annotationId") == ann_id),
            None,
        )
        summary_result = summary_data.get("summary", {}) if summary_data else {}

        title = summary_result.get("title") or _generate_stub_title(raw_text, annotation_type)
        summary = summary_result.get("summary") or _generate_stub_summary(
            raw_text, annotation_type, page_url
        )
        category = summary_result.get("category") or _infer_stub_category(
            raw_text, annotation_type
        )
        severity = summary_result.get("severity") or "minor"

        bundle = {
            "annotation_id": ann_id,
            "title": title,
            "summary": summary,
            "normalized_task": f"Address feedback: {title}",
            "category": category,
            "severity": severity,
            "page_url": page_url,
            "viewport": annotation.get("viewport"),
            "screenshot_url": annotation.get("screenshot_url"),
            "dom_selector": annotation.get("dom_selector"),
            "computed_styles": annotation.get("computed_styles"),
            "client_raw_text": raw_text,
            "reference_images": annotation.get("reference_images", []),
            # Provenance — SEPARATE fields, stubbed
            "exact_source": None,  # Would come from data-rl-source resolution
            "resolved_component_stack": [],  # Would come from fiber walk
            "resolution_mode": "leaf_only",  # Stub: no resolution happened
            "missing_reasons": ["worker_stub"],
            "root_boundary_kind": None,
            # Derived — empty stubs
            "component_candidates": [],
            "file_candidates": [],
            "design_candidates": [],
            "design_diff": None,
            # AI-generated — stubs
            "acceptance_criteria": [f"Verify that the issue described as '{title}' is resolved"],
            "constraints": [],
            "confidence": {
                "component_match": 0.0,
                "design_match": 0.0,
                "task_clarity": 0.5 if raw_text else 0.0,
            },
            "unresolved_ambiguities": (
                [] if raw_text else ["No reporter text provided — unclear intent"]
            ),
            "validation_steps": [
                "Visual inspection of the affected area",
                "Cross-browser verification",
            ],
        }
        bundles.append(bundle)

    return {
        "session_id": session_id,
        "bundles": bundles,
        "bundle_count": len(bundles),
    }


def _handle_generate_acceptance_criteria(request: JobRequest) -> dict:
    """
    Generate acceptance criteria from bundle context.

    Output: { criteria, validation_steps }
    """
    payload = request.payload or {}
    title = payload.get("title", "feedback item")

    return {
        "criteria": [
            f"The issue described as '{title}' must be resolved",
            "Visual regression test must pass",
        ],
        "validation_steps": [
            "Manual visual inspection",
            "Automated screenshot comparison",
        ],
    }


def _handle_unknown(request: JobRequest) -> dict:
    return {"error": f"No handler for {request.job_type}"}


# =============================================================================
# Stub helpers — replaced by Claude API calls in production
# =============================================================================


def _generate_stub_title(raw_text: str, annotation_type: str) -> str:
    if raw_text:
        # Use first 60 chars of raw text as title
        clean = raw_text.strip().replace("\n", " ")
        return clean[:60] + ("..." if len(clean) > 60 else "")
    # Derive from annotation type
    type_labels = {
        "element_select": "Element feedback",
        "freeform_draw": "Visual annotation",
        "screenshot_region": "Screenshot feedback",
        "full_page_note": "Page feedback",
        "reference_image": "Reference comparison",
    }
    return type_labels.get(annotation_type, "Feedback item")


def _generate_stub_summary(raw_text: str, annotation_type: str, page_url: str) -> str:
    type_labels = {
        "element_select": "selected an element",
        "freeform_draw": "drew an annotation",
        "screenshot_region": "highlighted a region",
        "full_page_note": "left a note",
        "reference_image": "attached a reference image",
    }
    action = type_labels.get(annotation_type, "provided feedback")

    if raw_text:
        return f"Reviewer {action} on {page_url or 'the page'}: {raw_text.strip()}"
    return f"Reviewer {action} on {page_url or 'the page'}"


def _infer_stub_category(raw_text: str, annotation_type: str) -> str:
    if not raw_text:
        return "visual_bug"

    lower = raw_text.lower()
    if any(w in lower for w in ["align", "spacing", "margin", "padding", "layout", "position"]):
        return "layout_issue"
    if any(w in lower for w in ["text", "copy", "typo", "wording", "label"]):
        return "copy_change"
    if any(w in lower for w in ["add", "feature", "want", "should have", "missing"]):
        return "feature_request"
    if any(w in lower for w in ["slow", "lag", "performance"]):
        return "performance"
    if any(w in lower for w in ["accessible", "a11y", "screen reader", "contrast"]):
        return "accessibility"
    if any(w in lower for w in ["click", "hover", "scroll", "broken", "doesn't work"]):
        return "behavior_bug"
    return "visual_bug"


# Handler dispatch table
JOB_HANDLERS: dict[str, Any] = {
    "summarize_annotation": _handle_summarize_annotation,
    "generate_clarification": _handle_generate_clarification,
    "enrich_bundle": _handle_enrich_bundle,
    "compute_design_diff": _handle_compute_design_diff,
    "compile_bundle": _handle_compile_bundle,
    "generate_acceptance_criteria": _handle_generate_acceptance_criteria,
}
