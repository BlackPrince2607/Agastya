"""Pytest configuration — force DEBUG mode so production validation does not block tests."""

import os

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("APP_NAME", "Agastya API Test")
