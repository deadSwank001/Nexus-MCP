"""
In-memory knowledge store backed by Ollama embeddings.

Documents are stored as (text, embedding) pairs.  Retrieval uses cosine
similarity, making this a zero-dependency local RAG store.
"""

from __future__ import annotations

import json
import math
import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from foundry_reverse import ollama_client as oc

DEFAULT_EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
STORE_PATH = Path(os.getenv("KNOWLEDGE_STORE_PATH", ".foundry_knowledge.json"))


@dataclass
class Document:
    id: str
    text: str
    metadata: dict[str, Any]
    embedding: list[float]


@dataclass
class Index:
    name: str
    embed_model: str
    documents: list[Document] = field(default_factory=list)


_indexes: dict[str, Index] = {}


# ── persistence ──────────────────────────────────────────────────────────────

def _save() -> None:
    data = {}
    for idx_name, idx in _indexes.items():
        data[idx_name] = {
            "embed_model": idx.embed_model,
            "documents": [
                {
                    "id": d.id,
                    "text": d.text,
                    "metadata": d.metadata,
                    "embedding": d.embedding,
                }
                for d in idx.documents
            ],
        }
    STORE_PATH.write_text(json.dumps(data))


def _load() -> None:
    if not STORE_PATH.exists():
        return
    data = json.loads(STORE_PATH.read_text())
    for idx_name, idx_data in data.items():
        docs = [
            Document(
                id=d["id"],
                text=d["text"],
                metadata=d["metadata"],
                embedding=d["embedding"],
            )
            for d in idx_data["documents"]
        ]
        _indexes[idx_name] = Index(
            name=idx_name,
            embed_model=idx_data["embed_model"],
            documents=docs,
        )


_load()


# ── helpers ───────────────────────────────────────────────────────────────────

def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── public API ────────────────────────────────────────────────────────────────

def create_index(name: str, embed_model: str = DEFAULT_EMBED_MODEL) -> dict[str, Any]:
    if name in _indexes:
        return {"status": "already_exists", "name": name}
    _indexes[name] = Index(name=name, embed_model=embed_model)
    _save()
    return {"status": "created", "name": name, "embed_model": embed_model}


def list_indexes() -> list[dict[str, Any]]:
    return [
        {"name": n, "embed_model": i.embed_model, "document_count": len(i.documents)}
        for n, i in _indexes.items()
    ]


async def add_document(
    index_name: str,
    text: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    idx = _indexes.get(index_name)
    if idx is None:
        raise ValueError(f"Index '{index_name}' not found. Create it first.")
    embedding = await oc.embeddings(idx.embed_model, text)
    doc = Document(
        id=str(uuid.uuid4()),
        text=text,
        metadata=metadata or {},
        embedding=embedding,
    )
    idx.documents.append(doc)
    _save()
    return {"status": "added", "id": doc.id, "index": index_name}


async def query_index(
    index_name: str,
    query: str,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    idx = _indexes.get(index_name)
    if idx is None:
        raise ValueError(f"Index '{index_name}' not found.")
    q_emb = await oc.embeddings(idx.embed_model, query)
    scored = sorted(
        idx.documents,
        key=lambda d: _cosine(q_emb, d.embedding),
        reverse=True,
    )
    return [
        {
            "id": d.id,
            "score": round(_cosine(q_emb, d.embedding), 4),
            "text": d.text,
            "metadata": d.metadata,
        }
        for d in scored[:top_k]
    ]


def delete_index(index_name: str) -> dict[str, Any]:
    if index_name not in _indexes:
        raise ValueError(f"Index '{index_name}' not found.")
    del _indexes[index_name]
    _save()
    return {"status": "deleted", "name": index_name}
