"""Helpers for syncing crawl artifacts into canonical Postgres tables."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional
from urllib.parse import urlparse

import asyncpg

from ..chunking.smart_chunker import Chunk
from ..strategies import PageResult


@dataclass
class WebPageIngestResult:
    """Result of upserting crawled pages."""

    project_id: uuid.UUID
    dataset_id: uuid.UUID
    page_ids: Dict[str, uuid.UUID]


class CanonicalMetadataStore:
    """Persist crawl results into claude_context.* relational tables."""

    def __init__(
        self,
        *,
        connection_string: Optional[str] = None,
        max_connections: int = 5,
    ) -> None:
        self.connection_string = connection_string or os.getenv(
            "POSTGRES_CONNECTION_STRING",
            "postgresql://postgres:code-context-secure-password@postgres:5432/claude_context"
        )
        self.max_connections = max_connections
        self.pool: Optional[asyncpg.Pool] = None
        self.schema = "claude_context"

    async def initialize(self) -> None:
        """Create a connection pool on first use."""
        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=1,
                max_size=self.max_connections,
                timeout=10.0,
            )

    async def close(self) -> None:
        """Tear down the connection pool."""
        if self.pool:
            await self.pool.close()
            self.pool = None

    async def upsert_web_pages(
        self,
        project_name: Optional[str],
        dataset_name: Optional[str],
        pages: Iterable[PageResult],
    ) -> WebPageIngestResult:
        """
        Ensure project/dataset rows exist and upsert crawled web pages.
        Returns mapping of canonical page IDs keyed by URL.
        """
        if self.pool is None:
            await self.initialize()

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                project_id = await self._ensure_project(conn, project_name)
                dataset_id = await self._ensure_dataset(conn, project_id, dataset_name)

                page_ids: Dict[str, uuid.UUID] = {}
                for page in pages:
                    # Skip empty payloads
                    if not page.markdown_content:
                        continue
                    page_id = await self._upsert_web_page(conn, dataset_id, page)
                    page_ids[page.url] = page_id

        return WebPageIngestResult(
            project_id=project_id, dataset_id=dataset_id, page_ids=page_ids
        )

    async def upsert_chunks(
        self,
        dataset_id: uuid.UUID,
        page_ids: Dict[str, uuid.UUID],
        chunks: List[Chunk],
        summaries: List[str],
        embeddings: List[List[float]],
    ) -> int:
        """
        Upsert chunk metadata and embeddings into claude_context.chunks.
        Skips entries without embeddings or missing upstream web page IDs.
        """
        if self.pool is None:
            await self.initialize()

        records = []
        total = min(len(chunks), len(embeddings))

        for index in range(total):
            chunk = chunks[index]
            embedding = embeddings[index]
            if not embedding:
                continue

            web_page_id = page_ids.get(chunk.source_path)
            if not web_page_id:
                LOGGER.warning(
                    f"Skipping chunk {index}: source_path '{chunk.source_path}' not found in page_ids. Available keys: {list(page_ids.keys())[:3]}"
                )
                continue

            summary = summaries[index] if index < len(summaries) else ""
            chunk_id = self._stable_chunk_id(web_page_id, chunk)

            metadata = {
                "language": chunk.language,
                "model_used": chunk.model_hint,
                "is_code": chunk.is_code,
                "confidence": chunk.confidence,
                "start_char": chunk.start_char,
                "end_char": chunk.end_char,
                "source_path": chunk.source_path,
            }

            records.append(
                (
                    chunk_id,
                    dataset_id,
                    web_page_id,
                    chunk.chunk_index,
                    chunk.text,
                    summary or "",
                    self._vector_literal(embedding),
                    json.dumps(metadata),
                )
            )

        if not records:
            return 0

        async with self.pool.acquire() as conn:
            await conn.executemany(
                f"""
                INSERT INTO {self.schema}.chunks
                    (id, dataset_id, web_page_id, source_type, chunk_index, text, summary, embedding, metadata)
                VALUES
                    ($1::uuid, $2::uuid, $3::uuid, 'web', $4, $5, $6, $7::vector, $8::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    text = EXCLUDED.text,
                    summary = EXCLUDED.summary,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata
                """,
                records,
            )

        return len(records)

    async def _ensure_project(
        self, conn: asyncpg.Connection, name: Optional[str]
    ) -> uuid.UUID:
        """Fetch or create a project row."""
        project_name = name or "default"
        row = await conn.fetchrow(
            f"SELECT id FROM {self.schema}.projects WHERE name = $1",
            project_name,
        )
        if row:
            return row["id"]

        project_id = uuid.uuid5(uuid.NAMESPACE_DNS, project_name)
        await conn.execute(
            f"""
            INSERT INTO {self.schema}.projects (id, name, description, is_active, is_global)
            VALUES ($1::uuid, $2, '', true, false)
            ON CONFLICT (name) DO NOTHING
            """,
            project_id,
            project_name,
        )

        row = await conn.fetchrow(
            f"SELECT id FROM {self.schema}.projects WHERE name = $1",
            project_name,
        )
        if not row:
            raise RuntimeError(f"Failed to upsert project '{project_name}'")
        return row["id"]

    async def _ensure_dataset(
        self,
        conn: asyncpg.Connection,
        project_id: uuid.UUID,
        name: Optional[str],
    ) -> uuid.UUID:
        """Fetch or create a dataset row."""
        dataset_name = name or "default"
        row = await conn.fetchrow(
            f"""
            SELECT id FROM {self.schema}.datasets
            WHERE project_id = $1 AND name = $2
            """,
            project_id,
            dataset_name,
        )
        if row:
            return row["id"]

        dataset_id = uuid.uuid5(uuid.NAMESPACE_DNS, dataset_name)
        await conn.execute(
            f"""
            INSERT INTO {self.schema}.datasets (id, project_id, name, status, is_global)
            VALUES ($1::uuid, $2::uuid, $3, 'active', false)
            ON CONFLICT (project_id, name) DO NOTHING
            """,
            dataset_id,
            project_id,
            dataset_name,
        )

        row = await conn.fetchrow(
            f"""
            SELECT id FROM {self.schema}.datasets
            WHERE project_id = $1 AND name = $2
            """,
            project_id,
            dataset_name,
        )
        if not row:
            raise RuntimeError(f"Failed to upsert dataset '{dataset_name}'")
        return row["id"]

    async def _upsert_web_page(
        self,
        conn: asyncpg.Connection,
        dataset_id: uuid.UUID,
        page: PageResult,
    ) -> uuid.UUID:
        """Insert or update a web page record."""
        page_id = uuid.uuid5(uuid.NAMESPACE_URL, f"{dataset_id}:{page.url}")
        metadata = dict(page.metadata or {})
        metadata.update(
            {
                "source_url": page.source_url,
                "word_count": page.word_count,
                "char_count": page.char_count,
                "domain": urlparse(page.url).netloc,
            }
        )

        content_hash = self._content_hash(page.markdown_content)
        if content_hash:
            metadata["content_hash"] = content_hash
        if page.html_content:
            metadata["html_content"] = page.html_content

        await conn.execute(
            f"""
            INSERT INTO {self.schema}.web_pages
                (id, dataset_id, url, title, content, status, metadata, crawled_at, updated_at)
            VALUES
                ($1::uuid, $2::uuid, $3, $4, $5, 'indexed', $6::jsonb, $7, NOW())
            ON CONFLICT (dataset_id, url) DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                status = 'indexed',
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            """,
            page_id,
            dataset_id,
            page.url,
            page.title,
            page.markdown_content,
            json.dumps(metadata),
            datetime.now(timezone.utc),
        )

        return page_id

    def _content_hash(self, content: Optional[str]) -> Optional[str]:
        if not content:
            return None
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def _vector_literal(self, embedding: List[float]) -> str:
        return "[" + ",".join(str(float(value)) for value in embedding) + "]"

    def _stable_chunk_id(self, web_page_id: uuid.UUID, chunk: Chunk) -> uuid.UUID:
        digest = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        seed = f"{web_page_id}:{chunk.chunk_index}:{digest}"
        return uuid.uuid5(uuid.NAMESPACE_URL, seed)


__all__ = ["CanonicalMetadataStore", "WebPageIngestResult"]
