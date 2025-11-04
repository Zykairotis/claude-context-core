"""Qdrant vector storage for crawled documents."""

from __future__ import annotations

import logging
import os
from typing import List, Optional

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams, SparseVectorParams, Modifier


LOGGER = logging.getLogger(__name__)


class QdrantVectorStore:
    """Qdrant storage with project-scoped collections."""

    def __init__(
        self,
        *,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        batch_size: int = 100,
    ):
        self.url = url or os.getenv("QDRANT_URL", "http://localhost:6333")
        self.api_key = api_key or os.getenv("QDRANT_API_KEY")
        self.batch_size = batch_size
        self.client: Optional[AsyncQdrantClient] = None

    async def initialize(self) -> None:
        """Initialize Qdrant client."""
        if self.client is None:
            self.client = AsyncQdrantClient(url=self.url, api_key=self.api_key)
            LOGGER.info("QdrantVectorStore initialized at %s", self.url)

    async def close(self) -> None:
        """Close Qdrant client."""
        if self.client:
            await self.client.close()
            self.client = None

    async def create_collection(self, collection_name: str, dimension: int) -> None:
        """Create a Qdrant collection with hybrid search support (named vectors)."""
        if not self.client:
            await self.initialize()

        try:
            # Use named vectors to match TypeScript schema: "vector" for dense, "sparse" for SPLADE
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config={
                    "vector": VectorParams(size=dimension, distance=Distance.COSINE)
                },
                sparse_vectors_config={
                    "sparse": SparseVectorParams(modifier=Modifier.IDF)
                },
            )
            LOGGER.info("Created Qdrant collection %s (%dd) with hybrid search support", collection_name, dimension)
        except Exception as exc:
            if "already exists" in str(exc).lower():
                LOGGER.debug("Collection %s already exists", collection_name)
            else:
                raise

    async def insert_documents(
        self,
        collection_name: str,
        documents: List,
    ) -> int:
        """Insert documents as points in batches."""
        if not self.client:
            await self.initialize()

        inserted = 0

        for i in range(0, len(documents), self.batch_size):
            batch = documents[i : i + self.batch_size]
            
            points = [
                PointStruct(
                    id=doc.id,
                    vector={
                        "vector": doc.vector  # Named vector to match TypeScript schema
                    },
                    payload={
                        "content": doc.content,
                        "relative_path": doc.relative_path,
                        "project_id": doc.project_id,
                        "dataset_id": doc.dataset_id,
                        "metadata": doc.metadata,
                    },
                )
                for doc in batch
            ]

            await self.client.upsert(collection_name=collection_name, points=points)
            inserted += len(batch)
            LOGGER.info("Inserted %d/%d points into %s", inserted, len(documents), collection_name)

        return inserted

    async def insert_chunks(
        self,
        collection_name: str,
        chunks: List,  # List[StoredChunk]
    ) -> int:
        """Insert chunks as points with enhanced payload in batches."""
        if not self.client:
            await self.initialize()

        inserted = 0

        for i in range(0, len(chunks), self.batch_size):
            batch = chunks[i : i + self.batch_size]
            
            points = [
                PointStruct(
                    id=chunk.id,
                    vector={
                        "vector": chunk.vector  # Named vector to match TypeScript schema
                    },
                    payload={
                        "chunk_text": chunk.chunk_text,
                        "summary": chunk.summary,
                        "is_code": chunk.is_code,
                        "language": chunk.language,
                        "relative_path": chunk.relative_path,
                        "chunk_index": chunk.chunk_index,
                        "start_char": chunk.start_char,
                        "end_char": chunk.end_char,
                        "model_used": chunk.model_used,
                        "project_id": chunk.project_id,
                        "dataset_id": chunk.dataset_id,
                        "scope": chunk.scope,
                        "metadata": chunk.metadata,
                    },
                )
                for chunk in batch
            ]

            await self.client.upsert(collection_name=collection_name, points=points)
            inserted += len(batch)
            LOGGER.info("Inserted %d/%d chunk points into %s", inserted, len(chunks), collection_name)

        return inserted


__all__ = ["QdrantVectorStore"]
