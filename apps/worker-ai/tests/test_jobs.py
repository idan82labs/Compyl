"""
Integration tests for the worker job handler.

WHAT THESE TESTS PROVE:
- Valid job types return completed status with structured results
- Invalid job types return failed with retryable=False
- Idempotency: duplicate keys return cached result
- All 6 contract job types are accepted
- summarize_annotation returns title, summary, category, severity
- compile_bundle returns ExecutionBundle-shaped output per annotation
- compile_bundle output preserves provenance separation (exact_source != resolved_component_stack)
- compile_bundle output includes AI-generated fields (acceptance_criteria, validation_steps)
- Category inference produces valid enum values

WHAT THESE TESTS CANNOT PROVE:
- Real Claude API classification quality
- Production Redis-based idempotency
- End-to-end API → worker → DB persistence (requires API integration test)
"""

import sys
import os

# Add parent dir to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.jobs import JobRequest, handle_job, VALID_JOB_TYPES


VALID_CATEGORIES = {
    "visual_bug",
    "layout_issue",
    "copy_change",
    "feature_request",
    "behavior_bug",
    "accessibility",
    "performance",
}

VALID_SEVERITIES = {"critical", "major", "minor", "suggestion"}

VALID_RESOLUTION_MODES = {"fiber_meta", "server_prefix", "leaf_only", "heuristic"}


def test_valid_job() -> None:
    req = JobRequest(
        job_id="test-1",
        job_type="summarize_annotation",
        payload={"raw_text": "Button is misaligned", "type": "element_select"},
        idempotency_key="idem-1",
        created_at="2026-03-10T00:00:00Z",
    )
    resp = handle_job(req)
    assert resp.status == "completed", f"Expected completed, got {resp.status}"
    assert resp.error is None
    assert resp.duration_ms >= 0
    print("PASS: valid job returns completed")


def test_invalid_job_type() -> None:
    req = JobRequest(
        job_id="test-2",
        job_type="nonexistent_job",
        payload={},
        idempotency_key="idem-2",
        created_at="2026-03-10T00:00:00Z",
    )
    resp = handle_job(req)
    assert resp.status == "failed", f"Expected failed, got {resp.status}"
    assert resp.error is not None
    assert resp.error.retryable is False
    print("PASS: invalid job type returns failed with retryable=False")


def test_idempotency() -> None:
    req = JobRequest(
        job_id="test-3",
        job_type="enrich_bundle",
        payload={"bundle_id": "b-1"},
        idempotency_key="idem-3",
        created_at="2026-03-10T00:00:00Z",
    )
    resp1 = handle_job(req)
    resp2 = handle_job(req)
    assert resp1.job_id == resp2.job_id
    assert resp1.duration_ms == resp2.duration_ms  # exact same cached object
    print("PASS: idempotency returns cached result")


def test_all_job_types_accepted() -> None:
    expected = {
        "summarize_annotation",
        "generate_clarification",
        "enrich_bundle",
        "compute_design_diff",
        "compile_bundle",
        "generate_acceptance_criteria",
    }
    assert VALID_JOB_TYPES == expected, f"Job types mismatch: {VALID_JOB_TYPES} != {expected}"

    for i, job_type in enumerate(expected):
        req = JobRequest(
            job_id=f"type-test-{i}",
            job_type=job_type,
            payload={},
            idempotency_key=f"type-idem-{job_type}",
            created_at="2026-03-10T00:00:00Z",
        )
        resp = handle_job(req)
        assert resp.status == "completed", f"{job_type} failed: {resp.status}"

    print(f"PASS: all {len(expected)} job types accepted")


# =============================================================================
# Structured result tests
# =============================================================================


def test_summarize_annotation_shape() -> None:
    """summarize_annotation must return title, summary, category, severity."""
    req = JobRequest(
        job_id="sum-1",
        job_type="summarize_annotation",
        payload={
            "annotation_id": "ann-001",
            "type": "element_select",
            "raw_text": "The spacing between the header and body is too large",
            "page_url": "https://example.com/dashboard",
            "screenshot_url": "https://storage.example.com/shot.png",
        },
        idempotency_key="sum-shape-1",
        created_at="2026-03-10T00:00:00Z",
    )
    resp = handle_job(req)
    result = resp.result

    assert "title" in result, "Missing title"
    assert "summary" in result, "Missing summary"
    assert "category" in result, "Missing category"
    assert "severity" in result, "Missing severity"

    assert isinstance(result["title"], str) and len(result["title"]) > 0, "Title must be non-empty string"
    assert isinstance(result["summary"], str) and len(result["summary"]) > 0, "Summary must be non-empty string"
    assert result["category"] in VALID_CATEGORIES, f"Invalid category: {result['category']}"
    assert result["severity"] in VALID_SEVERITIES, f"Invalid severity: {result['severity']}"
    assert result["annotation_id"] == "ann-001", "annotation_id must pass through"

    print("PASS: summarize_annotation returns structured title/summary/category/severity")


def test_compile_bundle_shape() -> None:
    """compile_bundle must return ExecutionBundle-shaped output per annotation."""
    req = JobRequest(
        job_id="compile-1",
        job_type="compile_bundle",
        payload={
            "session_id": "session-001",
            "annotations": [
                {
                    "id": "ann-001",
                    "type": "element_select",
                    "raw_text": "Button looks wrong",
                    "page_url": "https://example.com",
                    "viewport": {"width": 1920, "height": 1080, "scroll_x": 0, "scroll_y": 0},
                    "dom_selector": "#submit-btn",
                    "computed_styles": {"color": "red"},
                    "screenshot_url": "https://storage.example.com/shot.png",
                    "reference_images": [],
                },
                {
                    "id": "ann-002",
                    "type": "full_page_note",
                    "raw_text": "The alignment on the left side needs fixing",
                    "page_url": "https://example.com/settings",
                },
            ],
            "summaries": [
                {
                    "annotationId": "ann-001",
                    "summary": {
                        "title": "Button looks wrong",
                        "summary": "Reporter selected a button element that appears incorrect",
                        "category": "visual_bug",
                        "severity": "minor",
                    },
                },
            ],
        },
        idempotency_key="compile-shape-1",
        created_at="2026-03-10T00:00:00Z",
    )
    resp = handle_job(req)
    result = resp.result

    assert result["session_id"] == "session-001"
    assert result["bundle_count"] == 2
    assert len(result["bundles"]) == 2

    # Verify each bundle has the required ExecutionBundle-shaped fields
    required_fields = [
        "title", "summary", "normalized_task", "category", "severity",
        "page_url", "client_raw_text",
        # Provenance — MUST be separate
        "exact_source", "resolved_component_stack",
        "resolution_mode", "missing_reasons", "root_boundary_kind",
        # Derived
        "component_candidates", "file_candidates", "design_candidates", "design_diff",
        # AI-generated
        "acceptance_criteria", "confidence", "validation_steps",
    ]

    for i, bundle in enumerate(result["bundles"]):
        for field in required_fields:
            assert field in bundle, f"Bundle {i} missing field: {field}"

    print("PASS: compile_bundle returns ExecutionBundle-shaped output (2 bundles)")


def test_compile_bundle_provenance_separation() -> None:
    """exact_source and resolved_component_stack must be SEPARATE in compile output."""
    req = JobRequest(
        job_id="compile-prov-1",
        job_type="compile_bundle",
        payload={
            "session_id": "session-002",
            "annotations": [
                {
                    "id": "ann-003",
                    "type": "element_select",
                    "raw_text": "Color mismatch",
                    "page_url": "https://example.com",
                },
            ],
            "summaries": [],
        },
        idempotency_key="compile-prov-1",
        created_at="2026-03-10T00:00:00Z",
    )
    resp = handle_job(req)
    bundle = resp.result["bundles"][0]

    # exact_source and resolved_component_stack must be separate fields
    assert "exact_source" in bundle, "exact_source must exist"
    assert "resolved_component_stack" in bundle, "resolved_component_stack must exist"

    # In stub mode, exact_source is null (no build plugin ran)
    assert bundle["exact_source"] is None, "Stub exact_source should be null"
    # resolved_component_stack is an empty list (no fiber walk ran)
    assert isinstance(bundle["resolved_component_stack"], list), "resolved_component_stack must be list"
    assert bundle["resolved_component_stack"] == [], "Stub resolved_component_stack should be empty"

    # resolution_mode must be a valid enum value
    assert bundle["resolution_mode"] in VALID_RESOLUTION_MODES, (
        f"Invalid resolution_mode: {bundle['resolution_mode']}"
    )

    # missing_reasons should explain why provenance is absent
    assert isinstance(bundle["missing_reasons"], list), "missing_reasons must be list"
    assert len(bundle["missing_reasons"]) > 0, "Stub should have missing_reasons"

    # These are NEVER merged into one field
    assert "component_stack" not in bundle, "Must not have generic 'component_stack'"
    assert "source_stack" not in bundle, "Must not have generic 'source_stack'"

    print("PASS: compile_bundle keeps exact_source and resolved_component_stack SEPARATE")


def test_compile_bundle_reporter_safe_fields() -> None:
    """compile_bundle output must contain reporter-safe fields (title, summary, category)."""
    req = JobRequest(
        job_id="compile-rep-1",
        job_type="compile_bundle",
        payload={
            "session_id": "session-003",
            "annotations": [
                {
                    "id": "ann-004",
                    "type": "element_select",
                    "raw_text": "Fix the button color",
                    "page_url": "https://example.com",
                },
            ],
            "summaries": [],
        },
        idempotency_key="compile-rep-1",
        created_at="2026-03-10T00:00:00Z",
    )
    resp = handle_job(req)
    bundle = resp.result["bundles"][0]

    # Reporter-visible fields must be populated
    assert isinstance(bundle["title"], str) and len(bundle["title"]) > 0
    assert isinstance(bundle["summary"], str) and len(bundle["summary"]) > 0
    assert bundle["category"] in VALID_CATEGORIES
    assert bundle["severity"] in VALID_SEVERITIES
    assert bundle["client_raw_text"] == "Fix the button color"

    # Confidence scores must have the right shape
    conf = bundle["confidence"]
    assert "component_match" in conf
    assert "design_match" in conf
    assert "task_clarity" in conf
    assert all(0 <= conf[k] <= 1 for k in conf), f"Confidence values out of range: {conf}"

    print("PASS: compile_bundle populates reporter-safe fields correctly")


def test_category_inference() -> None:
    """Category inference must produce valid enum values for various inputs."""
    test_cases = [
        ("The spacing is too large", "layout_issue"),
        ("Fix the typo in the header", "copy_change"),
        ("I want a dark mode toggle", "feature_request"),
        ("The page loads slowly", "performance"),
        ("Button doesn't work when clicked", "behavior_bug"),
        ("", "visual_bug"),  # Default
    ]

    for i, (text, expected_category) in enumerate(test_cases):
        req = JobRequest(
            job_id=f"cat-{i}",
            job_type="summarize_annotation",
            payload={"raw_text": text, "type": "element_select"},
            idempotency_key=f"cat-idem-{i}",
            created_at="2026-03-10T00:00:00Z",
        )
        resp = handle_job(req)
        actual = resp.result["category"]
        assert actual == expected_category, (
            f"Category for '{text}': expected '{expected_category}', got '{actual}'"
        )
        assert actual in VALID_CATEGORIES, f"'{actual}' is not a valid category enum"

    print(f"PASS: category inference correct for {len(test_cases)} inputs")


if __name__ == "__main__":
    test_valid_job()
    test_invalid_job_type()
    test_idempotency()
    test_all_job_types_accepted()
    test_summarize_annotation_shape()
    test_compile_bundle_shape()
    test_compile_bundle_provenance_separation()
    test_compile_bundle_reporter_safe_fields()
    test_category_inference()
    print("\nAll worker job tests passed.")
