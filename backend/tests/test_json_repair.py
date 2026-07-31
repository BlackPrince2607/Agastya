"""Safe LLM JSON repair tests."""

import json

import pytest

from app.utils.json_repair import loads_llm_json


def test_loads_direct_object():
    assert loads_llm_json('{"a": 1}') == {"a": 1}


def test_loads_markdown_fence():
    raw = '```json\n{"title": "Hello", "body": "World"}\n```'
    assert loads_llm_json(raw) == {"title": "Hello", "body": "World"}


def test_loads_fence_with_preamble():
    raw = 'Here you go:\n```json\n{"items": [1, 2]}\n```\nThanks!'
    assert loads_llm_json(raw) == {"items": [1, 2]}


def test_loads_trailing_comma():
    raw = '{"tasks": [{"id": "a"},],}'
    assert loads_llm_json(raw) == {"tasks": [{"id": "a"}]}


def test_loads_array_blob():
    assert loads_llm_json('chips: ["a", "b"] trailing') == ["a", "b"]


def test_loads_empty_raises():
    with pytest.raises(json.JSONDecodeError):
        loads_llm_json("   ")


def test_loads_unrepairable_raises():
    with pytest.raises(json.JSONDecodeError):
        loads_llm_json("not json at all")
