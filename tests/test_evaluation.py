"""Tests for the evaluation module (mocks Ollama)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from foundry_reverse import evaluation as ev


MOCK_EVAL_RESPONSE_JSON = json.dumps(
    {
        "scores": {
            "relevance": 5,
            "coherence": 4,
            "correctness": 4,
            "completeness": 5,
        },
        "rationale": {
            "relevance": "Directly answers the question.",
            "coherence": "Logically structured.",
            "correctness": "Factually plausible.",
            "completeness": "Covers all aspects.",
        },
        "overall": 4.5,
    }
)


@pytest.mark.asyncio
async def test_evaluate_response_parses_json():
    with patch("foundry_reverse.ollama_client.generate", new=AsyncMock(return_value=MOCK_EVAL_RESPONSE_JSON)):
        result = await ev.evaluate_response(
            question="What is Python?",
            response="Python is a high-level programming language.",
            judge_model="mock-model",
        )
    assert result["scores"]["relevance"] == 5
    assert result["overall"] == 4.5
    assert result["judge_model"] == "mock-model"


@pytest.mark.asyncio
async def test_evaluate_response_handles_fenced_json():
    fenced = f"```json\n{MOCK_EVAL_RESPONSE_JSON}\n```"
    with patch("foundry_reverse.ollama_client.generate", new=AsyncMock(return_value=fenced)):
        result = await ev.evaluate_response(
            question="q",
            response="r",
            judge_model="mock-model",
        )
    assert "scores" in result


@pytest.mark.asyncio
async def test_evaluate_response_handles_bad_json():
    with patch("foundry_reverse.ollama_client.generate", new=AsyncMock(return_value="not json at all")):
        result = await ev.evaluate_response(
            question="q",
            response="r",
            judge_model="mock-model",
        )
    assert "error" in result


MOCK_AGENT_EVAL_RESPONSE_JSON = json.dumps(
    {
        "scores": {
            "task_completion": 5,
            "tool_use": 4,
            "safety": 5,
            "efficiency": 4,
        },
        "rationale": {
            "task_completion": "Task completed.",
            "tool_use": "Used tools appropriately.",
            "safety": "No harmful outputs.",
            "efficiency": "Reasonable steps.",
        },
        "overall": 4.5,
    }
)


@pytest.mark.asyncio
async def test_evaluate_agent():
    conv = [
        {"role": "user", "content": "What is 2+2?"},
        {"role": "assistant", "content": "4"},
    ]
    with patch("foundry_reverse.ollama_client.generate", new=AsyncMock(return_value=MOCK_AGENT_EVAL_RESPONSE_JSON)):
        result = await ev.evaluate_agent(conversation=conv, judge_model="mock-model")
    assert result["scores"]["task_completion"] == 5
