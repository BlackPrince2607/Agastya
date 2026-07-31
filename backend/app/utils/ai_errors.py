"""Consistent AI endpoint error reporting without changing API detail contracts."""

from __future__ import annotations

import logging
from typing import Any, NoReturn

import sentry_sdk
from fastapi import HTTPException

from app.middleware.request_context import get_request_id
from app.utils.ai_logging import log_ai_event

logger = logging.getLogger(__name__)


def raise_ai_http_error(
    status_code: int,
    detail: Any,
    *,
    feature: str,
    reason: str,
    exc: BaseException | None = None,
) -> NoReturn:
    """
    Log + Sentry-tag an AI HTTP failure, then raise with the original detail shape.

    ``detail`` must remain API-contract-compatible (string or structured palm codes).
    Correlation is carried via ``X-Request-Id`` response header, not the body.
    """
    request_id = get_request_id()
    detail_code = detail if isinstance(detail, str) else (
        detail.get("code") if isinstance(detail, dict) else type(detail).__name__
    )
    log_ai_event(
        logger,
        "ai_http_error",
        feature=feature,
        level=logging.ERROR,
        reason=reason,
        status_code=status_code,
        detail_code=detail_code,
        error_type=type(exc).__name__ if exc else None,
    )
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("feature", feature)
        scope.set_tag("ai_reason", reason)
        if request_id:
            scope.set_tag("request_id", request_id)
        scope.set_extra("status_code", status_code)
        scope.set_extra("detail_code", detail_code)
        if exc is not None:
            scope.capture_exception(exc)
        else:
            scope.capture_message(f"ai_http_error:{feature}:{reason}", level="error")

    raise HTTPException(status_code=status_code, detail=detail) from exc


def log_ai_fallback(
    feature: str,
    reason: str,
    *,
    level: int = logging.WARNING,
    **fields: Any,
) -> None:
    """Uniform fallback signal when an AI path degrades without raising."""
    log_ai_event(
        logger,
        "llm_fallback",
        feature=feature,
        level=level,
        reason=reason,
        **fields,
    )
