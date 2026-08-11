"""Public legal HTML pages served at site root (no /v1 prefix)."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def test_legal_pages_served_from_repo_legal_dir():
    app = create_app()
    client = TestClient(app)
    legal_dir = Path(__file__).resolve().parents[2] / "legal"
    assert legal_dir.is_dir(), f"expected {legal_dir} in repo"

    for path in ("/", "/delete-account", "/privacy", "/terms", "/support"):
        res = client.get(path)
        assert res.status_code == 200, path
        assert "text/html" in res.headers.get("content-type", "")
        assert len(res.content) > 100
