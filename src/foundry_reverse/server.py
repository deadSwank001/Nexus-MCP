"""
Foundry-Reverse MCP Server
==========================
An open-source, local equivalent of Azure AI Foundry MCP Server, powered by
Ollama.  Exposes model management, text generation, evaluation, and knowledge
(RAG) tools via the Model Context Protocol.

Run:
    uv run python -m foundry_reverse.server
  or
    uv run foundry-reverse
"""

from __future__ import annotations

import json
from typing import Any

from mcp.server.fastmcp import FastMCP

from foundry_reverse import ollama_client as oc
from foundry_reverse import evaluation as ev
from foundry_reverse import knowledge as kn

mcp = FastMCP(
    name="foundry-reverse",
    instructions=(
        "Foundry-Reverse – a local AI Foundry MCP server backed by Ollama.\n"
        "Use the tools below to manage models, run inference, evaluate outputs, "
        "and build local RAG pipelines without any cloud dependencies."
    ),
)


# ────────────────────────────────────────────────────────────────────────────
# HEALTH
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool(
    name="health_check",
    description="Check whether the local Ollama service is reachable.",
)
async def health_check() -> dict[str, Any]:
    ok = await oc.health_check()
    return {"ollama_reachable": ok, "ollama_base_url": oc.OLLAMA_BASE_URL}


# ────────────────────────────────────────────────────────────────────────────
# MODEL MANAGEMENT  (analogous to Foundry's Models category)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool(
    name="list_models",
    description="List all locally available Ollama models.",
)
async def list_models() -> list[dict[str, Any]]:
    models = await oc.list_models()
    return [
        {
            "name": m.get("name"),
            "size_gb": round(m.get("size", 0) / 1_073_741_824, 2),
            "modified_at": m.get("modified_at"),
            "digest": m.get("digest", "")[:12],
        }
        for m in models
    ]


@mcp.tool(
    name="get_model_info",
    description="Get detailed information about a specific Ollama model.",
)
async def get_model_info(model_name: str) -> dict[str, Any]:
    """
    Args:
        model_name: The name of the model (e.g. 'llama3', 'mistral:7b').
    """
    info = await oc.get_model_info(model_name)
    # Trim the modelfile to avoid huge outputs
    modelfile = info.get("modelfile", "")
    if len(modelfile) > 500:
        info["modelfile"] = modelfile[:500] + "..."
    return info


@mcp.tool(
    name="pull_model",
    description=(
        "Download / update an Ollama model from the Ollama registry. "
        "Returns streaming status lines summarising the download progress."
    ),
)
async def pull_model(model_name: str) -> dict[str, Any]:
    """
    Args:
        model_name: The name of the model to pull (e.g. 'llama3', 'phi3').
    """
    lines = await oc.pull_model(model_name)
    return {"model": model_name, "status_lines": lines[-10:], "total_lines": len(lines)}


@mcp.tool(
    name="delete_model",
    description="Delete a locally stored Ollama model to free disk space.",
)
async def delete_model(model_name: str) -> dict[str, Any]:
    """
    Args:
        model_name: The exact name of the model to delete.
    """
    return await oc.delete_model(model_name)


@mcp.tool(
    name="list_running_models",
    description="List models currently loaded in memory (running in Ollama).",
)
async def list_running_models() -> list[dict[str, Any]]:
    return await oc.running_models()


@mcp.tool(
    name="compare_models",
    description=(
        "Run the same prompt against multiple models and return all responses "
        "side-by-side for comparison."
    ),
)
async def compare_models(
    prompt: str,
    model_names: list[str],
    system_prompt: str | None = None,
) -> dict[str, Any]:
    """
    Args:
        prompt: The prompt to send to each model.
        model_names: List of model names to compare.
        system_prompt: Optional system instruction applied to all models.
    """
    results: dict[str, str] = {}
    for name in model_names:
        try:
            results[name] = await oc.generate(model=name, prompt=prompt, system=system_prompt)
        except Exception as exc:  # noqa: BLE001
            results[name] = f"ERROR: {exc}"
    return {"prompt": prompt, "results": results}


# ────────────────────────────────────────────────────────────────────────────
# INFERENCE  (generate / chat)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool(
    name="generate",
    description=(
        "Run text generation with an Ollama model.  Returns the model's "
        "raw completion for a given prompt."
    ),
)
async def generate(
    model: str,
    prompt: str,
    system_prompt: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """
    Args:
        model: Ollama model name (e.g. 'llama3').
        prompt: The input prompt.
        system_prompt: Optional system message to guide the model.
        temperature: Sampling temperature (0.0–2.0). Lower is more deterministic.
        max_tokens: Maximum tokens to generate.
    """
    options: dict[str, Any] = {}
    if temperature is not None:
        options["temperature"] = temperature
    if max_tokens is not None:
        options["num_predict"] = max_tokens
    response = await oc.generate(
        model=model,
        prompt=prompt,
        system=system_prompt,
        options=options or None,
    )
    return {"model": model, "response": response}


@mcp.tool(
    name="chat",
    description=(
        "Send a multi-turn conversation to an Ollama model.  Messages should "
        "follow the format [{'role': 'user'|'assistant'|'system', 'content': '...'}]."
    ),
)
async def chat(
    model: str,
    messages: list[dict[str, str]],
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """
    Args:
        model: Ollama model name.
        messages: Conversation history as a list of role/content dicts.
        temperature: Sampling temperature (0.0–2.0).
        max_tokens: Maximum tokens to generate.
    """
    options: dict[str, Any] = {}
    if temperature is not None:
        options["temperature"] = temperature
    if max_tokens is not None:
        options["num_predict"] = max_tokens
    response = await oc.chat(
        model=model,
        messages=messages,
        options=options or None,
    )
    return {"model": model, "response": response}


# ────────────────────────────────────────────────────────────────────────────
# EVALUATION  (analogous to Foundry's Evaluation category)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool(
    name="evaluate_response",
    description=(
        "Use a local judge model to score an LLM response on relevance, "
        "coherence, correctness, and completeness (1-5 each)."
    ),
)
async def evaluate_response(
    question: str,
    response: str,
    judge_model: str | None = None,
) -> dict[str, Any]:
    """
    Args:
        question: The original question or prompt.
        response: The model response to evaluate.
        judge_model: Which Ollama model acts as judge. Defaults to first available.
    """
    return await ev.evaluate_response(
        question=question,
        response=response,
        judge_model=judge_model,
    )


@mcp.tool(
    name="evaluate_agent",
    description=(
        "Evaluate a multi-turn agent conversation on task completion, tool use, "
        "safety, and efficiency using a local judge model."
    ),
)
async def evaluate_agent(
    conversation: list[dict[str, str]],
    judge_model: str | None = None,
) -> dict[str, Any]:
    """
    Args:
        conversation: Full conversation as [{'role': '...', 'content': '...'}].
        judge_model: Ollama model to use as judge. Defaults to first available.
    """
    return await ev.evaluate_agent(
        conversation=conversation,
        judge_model=judge_model,
    )


# ────────────────────────────────────────────────────────────────────────────
# KNOWLEDGE / RAG  (analogous to Foundry's Knowledge category)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool(
    name="create_index",
    description=(
        "Create a named local vector index for RAG (Retrieval-Augmented Generation). "
        "Documents added to this index are embedded via Ollama."
    ),
)
def create_index(
    index_name: str,
    embed_model: str = "nomic-embed-text",
) -> dict[str, Any]:
    """
    Args:
        index_name: Unique name for the index.
        embed_model: Ollama embedding model to use (must support /api/embeddings).
    """
    return kn.create_index(name=index_name, embed_model=embed_model)


@mcp.tool(
    name="list_indexes",
    description="List all local knowledge indexes.",
)
def list_indexes() -> list[dict[str, Any]]:
    return kn.list_indexes()


@mcp.tool(
    name="add_document",
    description=(
        "Add a text document to a knowledge index. "
        "The text is embedded automatically using the index's embedding model."
    ),
)
async def add_document(
    index_name: str,
    text: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Args:
        index_name: The target index name (must be created first).
        text: Document text to store and embed.
        metadata: Optional key-value metadata to attach to the document.
    """
    return await kn.add_document(
        index_name=index_name,
        text=text,
        metadata=metadata,
    )


@mcp.tool(
    name="query_knowledge",
    description=(
        "Semantic search over a knowledge index. "
        "Returns the top-k most relevant documents for a natural language query."
    ),
)
async def query_knowledge(
    index_name: str,
    query: str,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """
    Args:
        index_name: The index to search.
        query: Natural language search query.
        top_k: Number of results to return (default 5).
    """
    return await kn.query_index(
        index_name=index_name,
        query=query,
        top_k=top_k,
    )


@mcp.tool(
    name="delete_index",
    description="Delete a knowledge index and all its documents.",
)
def delete_index(index_name: str) -> dict[str, Any]:
    """
    Args:
        index_name: The name of the index to delete.
    """
    return kn.delete_index(index_name)


# ────────────────────────────────────────────────────────────────────────────
# RESOURCES  (expose model list as a readable resource)
# ────────────────────────────────────────────────────────────────────────────

@mcp.resource("ollama://models")
async def models_resource() -> str:
    """Returns JSON list of all locally available Ollama models."""
    models = await oc.list_models()
    return json.dumps(models, indent=2)


@mcp.resource("ollama://running")
async def running_resource() -> str:
    """Returns JSON list of models currently loaded in Ollama memory."""
    running = await oc.running_models()
    return json.dumps(running, indent=2)


@mcp.resource("ollama://indexes")
async def indexes_resource() -> str:
    """Returns JSON list of all local knowledge indexes."""
    return json.dumps(kn.list_indexes(), indent=2)


# ────────────────────────────────────────────────────────────────────────────
# PROMPTS  (reusable prompt templates)
# ────────────────────────────────────────────────────────────────────────────

@mcp.prompt(name="summarize", description="Summarize a piece of text.")
def prompt_summarize(text: str) -> str:
    return f"Please provide a concise summary of the following text:\n\n{text}"


@mcp.prompt(name="rag_answer", description="Answer a question using retrieved context.")
def prompt_rag_answer(question: str, context: str) -> str:
    return (
        f"Use only the context below to answer the question. "
        f"If the context does not contain enough information, say so.\n\n"
        f"Context:\n{context}\n\nQuestion: {question}"
    )


@mcp.prompt(name="code_review", description="Review and critique a code snippet.")
def prompt_code_review(code: str, language: str = "python") -> str:
    return (
        f"Review the following {language} code for correctness, style, "
        f"security issues, and suggest improvements:\n\n```{language}\n{code}\n```"
    )


# ────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ────────────────────────────────────────────────────────────────────────────

def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
