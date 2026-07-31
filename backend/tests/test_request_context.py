"""Request correlation + structured AI logging tests."""

from __future__ import annotations

import json
import logging

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.middleware.request_context import (
    REQUEST_ID_HEADER,
    RequestContextMiddleware,
    get_request_id,
    set_request_id,
    clear_request_id,
)
from app.utils.ai_logging import log_ai_event


async def _echo(request: Request):
    return JSONResponse({"request_id": get_request_id(), "state": getattr(request.state, "request_id", None)})


def _app() -> Starlette:
    app = Starlette(routes=[Route("/echo", _echo)])
    app.add_middleware(RequestContextMiddleware)
    return app


def test_middleware_generates_and_echoes_request_id():
    client = TestClient(_app())
    res = client.get("/echo")
    assert res.status_code == 200
    rid = res.headers.get(REQUEST_ID_HEADER)
    assert rid
    assert res.json()["request_id"] == rid
    assert res.json()["state"] == rid


def test_middleware_honors_incoming_request_id():
    client = TestClient(_app())
    res = client.get("/echo", headers={REQUEST_ID_HEADER: "client-req-12345678"})
    assert res.headers.get(REQUEST_ID_HEADER) == "client-req-12345678"
    assert res.json()["request_id"] == "client-req-12345678"


def test_middleware_rejects_malformed_incoming_id():
    client = TestClient(_app())
    res = client.get("/echo", headers={REQUEST_ID_HEADER: "bad id with spaces"})
    rid = res.headers.get(REQUEST_ID_HEADER)
    assert rid
    assert rid != "bad id with spaces"


def test_log_ai_event_strips_sensitive_fields(caplog):
    clear_request_id()
    set_request_id("corr-test-0001")
    try:
        with caplog.at_level(logging.INFO):
            log_ai_event(
                logging.getLogger("test.ai"),
                "llm_fallback",
                feature="chat",
                reason="no_completion",
                content="SECRET USER MESSAGE",
                image_base64="iVBORw0KGgo=",
                model="openai/gpt-4o-mini",
            )
        assert len(caplog.records) == 1
        payload = json.loads(caplog.records[0].getMessage())
        assert payload["msg"] == "ai_event"
        assert payload["event"] == "llm_fallback"
        assert payload["feature"] == "chat"
        assert payload["request_id"] == "corr-test-0001"
        assert payload["model"] == "openai/gpt-4o-mini"
        assert "content" not in payload
        assert "image_base64" not in payload
        assert "SECRET" not in caplog.records[0].getMessage()
    finally:
        clear_request_id()
