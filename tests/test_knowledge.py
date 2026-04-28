"""Tests for the knowledge module (no Ollama required)."""

from __future__ import annotations

import os
import tempfile
import pytest

# Point knowledge store at a temp file so tests don't pollute the workspace
os.environ["KNOWLEDGE_STORE_PATH"] = os.path.join(tempfile.gettempdir(), "test_knowledge.json")

from foundry_reverse import knowledge as kn  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_indexes():
    """Reset in-memory indexes before each test."""
    kn._indexes.clear()
    yield
    kn._indexes.clear()


def test_create_index():
    result = kn.create_index("my-index")
    assert result["status"] == "created"
    assert result["name"] == "my-index"


def test_create_index_duplicate():
    kn.create_index("dup")
    result = kn.create_index("dup")
    assert result["status"] == "already_exists"


def test_list_indexes_empty():
    assert kn.list_indexes() == []


def test_list_indexes():
    kn.create_index("a", embed_model="test-model")
    kn.create_index("b", embed_model="other-model")
    indexes = kn.list_indexes()
    names = {i["name"] for i in indexes}
    assert names == {"a", "b"}


def test_delete_index():
    kn.create_index("to-delete")
    result = kn.delete_index("to-delete")
    assert result["status"] == "deleted"
    assert kn.list_indexes() == []


def test_delete_nonexistent_index():
    with pytest.raises(ValueError, match="not found"):
        kn.delete_index("ghost")


def test_cosine_similarity():
    a = [1.0, 0.0]
    b = [1.0, 0.0]
    assert kn._cosine(a, b) == pytest.approx(1.0)
    c = [0.0, 1.0]
    assert kn._cosine(a, c) == pytest.approx(0.0)


def test_cosine_zero_vector():
    assert kn._cosine([0.0, 0.0], [1.0, 1.0]) == 0.0
