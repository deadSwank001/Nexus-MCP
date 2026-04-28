"""Tests for the Ollama client (mocks HTTP)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from foundry_reverse import ollama_client as oc


def _mock_response(data: dict | list, status: int = 200):
    resp = AsyncMock()
    resp.status_code = status
    resp.json = MagicMock(return_value=data)
    resp.raise_for_status = MagicMock()
    return resp


@pytest.mark.asyncio
async def test_list_models():
    models_data = {
        "models": [
            {"name": "llama3", "size": 2_000_000_000, "modified_at": "2024-01-01", "digest": "abc123"},
        ]
    }
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=_mock_response(models_data))

    with patch("foundry_reverse.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await oc.list_models()

    assert len(result) == 1
    assert result[0]["name"] == "llama3"


@pytest.mark.asyncio
async def test_generate():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=_mock_response({"response": "Hello!"}))

    with patch("foundry_reverse.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await oc.generate(model="llama3", prompt="Say hello")

    assert result == "Hello!"


@pytest.mark.asyncio
async def test_chat():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(
        return_value=_mock_response({"message": {"content": "Hi there!", "role": "assistant"}})
    )

    with patch("foundry_reverse.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await oc.chat(
            model="llama3",
            messages=[{"role": "user", "content": "Hello"}],
        )

    assert result == "Hi there!"


@pytest.mark.asyncio
async def test_health_check_ok():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=_mock_response({}, status=200))

    with patch("foundry_reverse.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await oc.health_check()

    assert result is True


@pytest.mark.asyncio
async def test_health_check_fail():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(side_effect=Exception("Connection refused"))

    with patch("foundry_reverse.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await oc.health_check()

    assert result is False


@pytest.mark.asyncio
async def test_embeddings():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(
        return_value=_mock_response({"embedding": [0.1, 0.2, 0.3]})
    )

    with patch("foundry_reverse.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await oc.embeddings(model="nomic-embed-text", prompt="hello")

    assert result == [0.1, 0.2, 0.3]
