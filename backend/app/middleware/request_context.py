"""Request correlation IDs for log/Sentry joining across the AI pipeline."""

from __future__ import annotations

import logging
import re
import uuid
from contextvars import ContextVar

import sentry_sdk
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-Id"
_CORRELATION_HEADERS = (REQUEST_ID_HEADER, "X-Correlation-Id")

# Clients may send UUIDs or opaque tokens; keep length bounded.
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{8,128}$")

_request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    """Return the active request correlation id, if any."""
    return _request_id_var.get()


def set_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def clear_request_id() -> None:
    _request_id_var.set(None)


def new_request_id() -> str:
    return str(uuid.uuid4())


def _sanitize_incoming_id(raw: str | None) -> str | None:
    if not raw:
        return None
    candidate = raw.strip()
    if not candidate or not _REQUEST_ID_RE.match(candidate):
        return None
    return candidate


def resolve_request_id(request: Request) -> str:
    for header in _CORRELATION_HEADERS:
        found = _sanitize_incoming_id(request.headers.get(header))
        if found:
            return found
    return new_request_id()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Bind a correlation id for the request lifetime and echo it on the response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = resolve_request_id(request)
        token = _request_id_var.set(request_id)
        request.state.request_id = request_id
        sentry_sdk.set_tag("request_id", request_id)
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "unhandled_request_error path=%s method=%s request_id=%s",
                request.url.path,
                request.method,
                request_id,
            )
            raise
        finally:
            _request_id_var.reset(token)

        response.headers[REQUEST_ID_HEADER] = request_id
        return response
