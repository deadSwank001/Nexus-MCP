"""Async Ollama API client."""

from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120"))


def _client(timeout: float = DEFAULT_TIMEOUT) -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=timeout)


async def list_models() -> list[dict[str, Any]]:
    async with _client() as c:
        r = await c.get("/api/tags")
        r.raise_for_status()
        return r.json().get("models", [])


async def get_model_info(name: str) -> dict[str, Any]:
    async with _client() as c:
        r = await c.post("/api/show", json={"name": name})
        r.raise_for_status()
        return r.json()


async def pull_model(name: str) -> list[str]:
    """Pull a model, streaming status lines."""
    lines: list[str] = []
    async with _client(timeout=600) as c:
        async with c.stream("POST", "/api/pull", json={"name": name, "stream": True}) as resp:
            resp.raise_for_status()
            async for raw in resp.aiter_lines():
                if raw.strip():
                    lines.append(raw)
    return lines


async def delete_model(name: str) -> dict[str, Any]:
    async with _client() as c:
        r = await c.request("DELETE", "/api/delete", json={"name": name})
        r.raise_for_status()
        return {"deleted": name, "status": "ok"}


async def generate(
    model: str,
    prompt: str,
    system: str | None = None,
    options: dict[str, Any] | None = None,
) -> str:
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system
    if options:
        payload["options"] = options
    async with _client() as c:
        r = await c.post("/api/generate", json=payload)
        r.raise_for_status()
        return r.json().get("response", "")


async def chat(
    model: str,
    messages: list[dict[str, str]],
    options: dict[str, Any] | None = None,
) -> str:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    if options:
        payload["options"] = options
    async with _client() as c:
        r = await c.post("/api/chat", json=payload)
        r.raise_for_status()
        return r.json().get("message", {}).get("content", "")


async def embeddings(model: str, prompt: str) -> list[float]:
    async with _client() as c:
        r = await c.post("/api/embeddings", json={"model": model, "prompt": prompt})
        r.raise_for_status()
        return r.json().get("embedding", [])


async def running_models() -> list[dict[str, Any]]:
    async with _client() as c:
        r = await c.get("/api/ps")
        r.raise_for_status()
        return r.json().get("models", [])


async def health_check() -> bool:
    try:
        async with _client(timeout=5) as c:
            r = await c.get("/")
            return r.status_code == 200
    except Exception:
        return False
