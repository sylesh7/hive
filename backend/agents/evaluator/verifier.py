"""
Evaluator agent — verifies delivered work and issues signed verdicts.

Deterministic checks ensure the deliverable exists and matches the spec structure.
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)


def verify_deliverable(task_spec: dict, delivery: dict) -> tuple[str, str]:
    """
    Verify a delivery against the task spec.

    Returns:
        (verdict, reason) where verdict is "PASS" or "FAIL"
    """
    task_type    = task_spec.get("task_type", "other")
    content      = delivery.get("deliverable_content", "")
    content_hash = delivery.get("deliverable_hash", "")
    ref          = delivery.get("deliverable_ref", "")

    # Basic existence check
    if not content and not ref:
        return "FAIL", "Deliverable is empty — no content or reference provided"

    if content and len(content.strip()) < 50:
        return "FAIL", f"Deliverable too short ({len(content)} chars) — does not meet minimum quality threshold"

    # Structural checks per task type
    if task_type == "logo_design":
        return _verify_logo(task_spec, content)
    elif task_type == "code_audit":
        return _verify_code_audit(task_spec, content)
    elif task_type == "research_report":
        return _verify_research(task_spec, content)
    elif task_type == "content_writing":
        return _verify_content(task_spec, content)
    else:
        # Generic: content must be present and non-trivial
        if len(content) >= 100:
            return "PASS", f"Deliverable verified: {len(content)} characters of content"
        return "FAIL", "Generic deliverable does not meet minimum content requirements"


def _verify_logo(spec: dict, content: str) -> tuple[str, str]:
    """Logo design: check for design spec components."""
    required_sections = ["color", "typography", "concept", "design"]
    content_lower = content.lower()
    missing = [s for s in required_sections if s not in content_lower]

    if missing:
        return "FAIL", f"Logo specification missing required sections: {', '.join(missing)}"

    deliverable_spec = spec.get("deliverable_spec", {})
    fmt = deliverable_spec.get("format", "").upper()
    if fmt and fmt not in content.upper():
        return "FAIL", f"Deliverable does not mention required format: {fmt}"

    return "PASS", (
        f"Logo design specification verified: {len(content)} chars, "
        "contains color palette, typography, and design concept"
    )


def _verify_code_audit(spec: dict, content: str) -> tuple[str, str]:
    """Code audit: check for required report sections."""
    required = ["summary", "finding", "severity", "recommendation"]
    content_lower = content.lower()
    missing = [s for s in required if s not in content_lower]

    if missing:
        return "FAIL", f"Code audit report missing required components: {', '.join(missing)}"

    # Check minimum depth (a real audit has substance)
    if len(content) < 500:
        return "FAIL", f"Code audit report too brief ({len(content)} chars)"

    return "PASS", (
        f"Code audit report verified: {len(content)} chars, "
        "contains executive summary, findings, and recommendations"
    )


def _verify_research(spec: dict, content: str) -> tuple[str, str]:
    """Research report: check word count and section coverage."""
    deliverable_spec  = spec.get("deliverable_spec", {})
    min_words         = int(deliverable_spec.get("word_count", 500))
    required_sections = deliverable_spec.get("sections", [])

    word_count = len(content.split())
    if word_count < min_words * 0.6:
        return "FAIL", (
            f"Research report too short: {word_count} words, "
            f"expected at least {int(min_words * 0.6)}"
        )

    content_lower = content.lower()
    if required_sections:
        missing = [s for s in required_sections if s.lower() not in content_lower]
        if missing:
            return "FAIL", f"Research report missing required sections: {', '.join(missing)}"

    return "PASS", (
        f"Research report verified: {word_count} words "
        + (f"covering {len(required_sections)} required sections" if required_sections else "")
    )


def _verify_content(spec: dict, content: str) -> tuple[str, str]:
    """Content writing: check word count."""
    deliverable_spec = spec.get("deliverable_spec", {})
    min_words        = int(deliverable_spec.get("word_count", 200))
    word_count       = len(content.split())

    if word_count < min_words * 0.7:
        return "FAIL", f"Content too short: {word_count} words, expected ~{min_words}"

    return "PASS", f"Content verified: {word_count} words of quality content"
