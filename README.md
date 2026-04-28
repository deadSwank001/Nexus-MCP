# Foundry-Reverse

Newer Foundry MCP reverse-engineered to work on Ollama

---

A **fully local, open-source alternative** to the [Azure AI Foundry MCP Server](https://github.com/microsoft-foundry/mcp-foundry), powered entirely by [Ollama](https://ollama.com).  
No Azure subscription, no API keys, no cloud required.

## Features

| Category | Tools |
|---|---|
| **Health** | `health_check` |
| **Model Management** | `list_models`, `get_model_info`, `pull_model`, `delete_model`, `list_running_models`, `compare_models` |
| **Inference** | `generate`, `chat` |
| **Evaluation** | `evaluate_response`, `evaluate_agent` |
| **Knowledge / RAG** | `create_index`, `list_indexes`, `add_document`, `query_knowledge`, `delete_index` |

Plus MCP **Resources** (`ollama://models`, `ollama://running`, `ollama://indexes`) and reusable **Prompts** (`summarize`, `rag_answer`, `code_review`).

## Requirements

- Python 3.12+
- [Ollama](https://ollama.com) running locally (`ollama serve`)
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

## Quick Start

```bash
# 1. Clone
git clone https://github.com/deadSwank001/Foundry-Reverse.git
cd Foundry-Reverse

# 2. Copy and edit configuration
cp .env.example .env

# 3. Run the MCP server (stdio transport)
uv run foundry-reverse
```

## VS Code / Copilot Integration

Copy `mcp.json` to your VS Code workspace `.vscode/mcp.json` (or user-level MCP config), then restart VS Code.

```json
{
  "mcpServers": {
    "foundry-reverse": {
      "command": "uv",
      "args": ["run", "foundry-reverse"],
      "env": {
        "OLLAMA_BASE_URL": "http://localhost:11434"
      }
    }
  }
}
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_TIMEOUT` | `120` | Request timeout in seconds |
| `EMBED_MODEL` | `nomic-embed-text` | Ollama model used for embeddings |
| `JUDGE_MODEL` | *(first available)* | Ollama model used as evaluator |
| `KNOWLEDGE_STORE_PATH` | `.foundry_knowledge.json` | Path for the local RAG store |

## Development

```bash
# Install deps (including dev)
uv sync --all-groups

# Run tests
uv run pytest
```

## Architecture

```
src/foundry_reverse/
├── __init__.py          # Package version
├── server.py            # FastMCP server – all tools, resources, prompts
├── ollama_client.py     # Async Ollama REST API client
├── evaluation.py        # LLM-as-judge evaluation helpers
└── knowledge.py         # In-memory vector store (cosine similarity + Ollama embeddings)
```

## Comparison with Azure AI Foundry MCP

| Feature | Azure Foundry MCP | Foundry-Reverse |
|---|---|---|
| Model catalog | Azure AI model registry | Local Ollama models |
| Inference | Azure OpenAI / serverless | Ollama (`/api/generate`, `/api/chat`) |
| Embeddings | Azure OpenAI embeddings | Ollama (`/api/embeddings`) |
| Vector search | Azure AI Search | In-memory cosine similarity |
| Evaluation | Azure AI Evaluation SDK | Local LLM-as-judge |
| Auth | Azure Service Principal / keys | None (local only) |
| Cost | Pay-per-token | Free |
