"""Shared request validators."""

from __future__ import annotations

import uuid

from fastapi import HTTPException


def _parse_uuid(value: str, field_name: str = "sessionId") -> str:
    s = value.strip()
    if not s or len(s) > 64:
        raise ValueError(f"Invalid {field_name}")
    if "/" in s or "\\" in s or ".." in s:
        raise ValueError(f"Invalid {field_name}")
    try:
        uuid.UUID(s)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a UUID") from exc
    return s


def validate_session_id(session_id: str) -> str:
    """Reject malformed or path-traversal session IDs (HTTP layer)."""
    try:
        return _parse_uuid(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def validate_device_install_id(device_install_id: str | None) -> str | None:
    if device_install_id is None:
        return None
    s = device_install_id.strip()
    if not s or len(s) > 128:
        raise HTTPException(status_code=400, detail="Invalid deviceInstallId")
    if "/" in s or "\\" in s:
        raise HTTPException(status_code=400, detail="Invalid deviceInstallId")
    return s


def assert_device_binding(
    *,
    session_id: str,
    device_install_id: str | None,
    stored_device_id: str | None,
    allow_first_bind: bool = True,
) -> None:
    """Ensure mutating requests come from the device that registered the session."""
    validate_session_id(session_id)
    incoming = validate_device_install_id(device_install_id)
    if incoming is None:
        return
    if stored_device_id is None:
        if allow_first_bind:
            return
        raise HTTPException(status_code=403, detail="Session not registered on this device")
    if stored_device_id != incoming:
        raise HTTPException(status_code=403, detail="deviceInstallId does not match session owner")
