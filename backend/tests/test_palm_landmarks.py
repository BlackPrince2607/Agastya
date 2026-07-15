"""Palm landmark detection endpoint."""

import base64

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.palm_landmarks import detect_hand_landmarks_from_bytes

# 1x1 white JPEG
_TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA"
    "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB"
    "AQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=="
)


@pytest.fixture
def client():
    return TestClient(create_app())


def test_landmarks_endpoint_rejects_bad_image(client):
    res = client.post(
        "/v1/palm/landmarks",
        json={"imageBase64": "not-valid-base64!!!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["landmarks"] is None
    assert data["source"] == "not_found"


def test_detect_hand_landmarks_from_bytes_tiny_image():
    raw = base64.b64decode(_TINY_JPEG_B64)
    landmarks, source = detect_hand_landmarks_from_bytes(raw, "right")
    assert source in {"not_found", "unavailable", "mediapipe"}
    if source == "mediapipe":
        assert landmarks is not None
        assert len(landmarks) == 21


@pytest.mark.skipif(
    detect_hand_landmarks_from_bytes(base64.b64decode(_TINY_JPEG_B64))[1] == "unavailable",
    reason="mediapipe not installed",
)
def test_landmarks_endpoint_accepts_jpeg(client):
    res = client.post(
        "/v1/palm/landmarks",
        json={"imageBase64": _TINY_JPEG_B64, "dominantHand": "right"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["source"] in {"not_found", "mediapipe", "unavailable"}
