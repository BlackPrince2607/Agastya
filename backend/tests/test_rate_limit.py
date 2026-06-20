"""Rate limit smoke tests."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_bootstrap_rate_limit_eventually_trips(client):
    session_id = str(uuid.uuid4())
    last_status = 200
    for _ in range(25):
        res = client.get(f"/v1/sessions/bootstrap?sessionId={session_id}")
        last_status = res.status_code
        if res.status_code == 429:
            break
    assert last_status == 429
