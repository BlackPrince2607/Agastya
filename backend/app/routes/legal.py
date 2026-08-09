"""Public legal/support HTML pages (Play Console deletion URL, privacy, terms)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(tags=["legal"])

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_LEGAL = _BACKEND_ROOT.parent / "legal"
_DOCKER_LEGAL = Path("/app/legal")


def _legal_dir() -> Path:
    if _DOCKER_LEGAL.is_dir():
        return _DOCKER_LEGAL
    if _REPO_LEGAL.is_dir():
        return _REPO_LEGAL
    raise HTTPException(status_code=503, detail="Legal pages are not available on this host")


def _legal_page(filename: str) -> FileResponse:
    path = _legal_dir() / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Page not found")
    return FileResponse(path, media_type="text/html; charset=utf-8")


@router.get("/delete-account")
async def delete_account_page() -> FileResponse:
    return _legal_page("delete-account.html")


@router.get("/privacy")
async def privacy_page() -> FileResponse:
    return _legal_page("privacy.html")


@router.get("/terms")
async def terms_page() -> FileResponse:
    return _legal_page("terms.html")


@router.get("/support")
async def support_page() -> FileResponse:
    return _legal_page("support.html")
