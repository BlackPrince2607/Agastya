"""Safe LLM JSON parsing — light repair before callers fall back to heuristics."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.utils.ai_logging import log_ai_event

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"```(?:json|JSON)?\s*\n?(.*?)```", re.DOTALL)
_TRAILING_COMMA_RE = re.compile(r",\s*([}\]])")


def _strip_trailing_commas(text: str) -> str:
    """Remove trailing commas before } or ] — common LLM slip, semantics-preserving."""
    prev = None
    out = text
    while prev != out:
        prev = out
        out = _TRAILING_COMMA_RE.sub(r"\1", out)
    return out


def _extract_balanced_blob(text: str) -> str | None:
    """Return the first balanced {...} or [...] substring, respecting JSON strings."""
    start = -1
    opener = ""
    closer = ""
    for i, ch in enumerate(text):
        if ch in "{[":
            start = i
            opener = ch
            closer = "}" if ch == "{" else "]"
            break
    if start < 0:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _candidate_texts(raw: str) -> list[str]:
    text = raw.strip().lstrip("\ufeff")
    if not text:
        return []

    candidates: list[str] = [text]

    fence = _FENCE_RE.search(text)
    if fence:
        fenced = fence.group(1).strip()
        if fenced and fenced not in candidates:
            candidates.append(fenced)

    blob = _extract_balanced_blob(text)
    if blob and blob not in candidates:
        candidates.append(blob)
    if fence:
        fenced_blob = _extract_balanced_blob(fence.group(1))
        if fenced_blob and fenced_blob not in candidates:
            candidates.append(fenced_blob)

    repaired: list[str] = []
    for c in candidates:
        fixed = _strip_trailing_commas(c)
        if fixed != c:
            repaired.append(fixed)
    candidates.extend(repaired)
    return candidates


def loads_llm_json(raw: str, *, feature: str = "llm_json") -> Any:
    """
    Parse model JSON output with safe, local repairs.

    Order: direct loads → markdown fence strip → balanced blob extract →
    trailing-comma strip. Does not invent keys or rewrite string contents.
    Raises json.JSONDecodeError when repair is unsafe or insufficient.
    """
    if raw is None:
        raise json.JSONDecodeError("Empty LLM JSON", "", 0)

    last_error: json.JSONDecodeError | None = None
    for candidate in _candidate_texts(raw):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
            continue

    log_ai_event(
        logger,
        "json_parse_failed",
        feature=feature,
        level=logging.WARNING,
        reason="unrepairable",
        raw_len=len(raw) if isinstance(raw, str) else 0,
    )
    if last_error is not None:
        raise last_error
    raise json.JSONDecodeError("Empty LLM JSON", raw if isinstance(raw, str) else "", 0)
