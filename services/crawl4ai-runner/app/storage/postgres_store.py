"""Postgres/pgvector storage for crawled documents."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import List, Optional

import asyncpg


LOGGER = logging.getLogger(__name__)


@dataclass
class StoredDocument:
    id: str
    vector: List[float]
    content: str
    relative_path: str
    project_id: str
    dataset_id: str
    metadata: dict


@dataclass
class StoredChunk:
    """Represents a chunk with summary and code detection metadata."""
    id: str
    chunk_text: str
    summary: str
    vector: List[float]
    is_code: bool
    language: str
    relative_path: str
    chunk_index: int
    start_char: int
    end_char: int
    model_used: str
    project_id: str
    dataset_id: str
    scope: str
    metadata: dict


class PostgresVectorStore:
    """Postgres/pgvector storage with project isolation."""

    def __init__(
        self,
        *,
        connection_string: Optional[str] = None,
        max_connections: int = 10,
        batch_size: int = 100,
    ):
        self.connection_string = connection_string or os.getenv(
            "POSTGRES_CONNECTION_STRING",
            "postgresql://postgres:code-context-secure-password@localhost:5533/claude_context",
        )
        self.max_connections = max_connections
        self.batch_size = batch_size
        self.pool: Optional[asyncpg.Pool] = None
        self.schema = "claude_context"

    async def initialize(self) -> None:
        """Initialize connection pool."""
        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=1,
                max_size=self.max_connections,
                timeout=10.0,
            )
            LOGGER.info("PostgresVectorStore initialized with pool size %d", self.max_connections)

    async def close(self) -> None:
        """Close connection pool."""
        if self.pool:
            await self.pool.close()
            self.pool = None

    async def create_collection(self, collection_name: str, dimension: int) -> None:
        """Create a collection (table) for vectors."""
        if not self.pool:
            await self.initialize()

        table_name = f"{self.schema}.vectors_{collection_name}"

        async with self.pool.acquire() as conn:
            # Create schema if needed
            await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {self.schema}")

            # Create table
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {table_name} (
                    id TEXT PRIMARY KEY,
                    vector vector({dimension}),
                    content TEXT,
                    relative_path TEXT,
                    start_line INTEGER,
                    end_line INTEGER,
                    file_extension TEXT,
                    project_id UUID,
                    dataset_id UUID,
                    source_type TEXT,
                    metadata JSONB DEFAULT '{{}}'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # Create indexes
            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {collection_name}_vector_idx
                ON {table_name} USING ivfflat (vector vector_cosine_ops)
                WITH (lists = 100)
            """)

            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {collection_name}_project_idx
                ON {table_name}(project_id)
            """)

            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {collection_name}_dataset_idx
                ON {table_name}(dataset_id)
            """)

            LOGGER.info("Created collection %s (%dd)", collection_name, dimension)

    async def insert_documents(
        self,
        collection_name: str,
        documents: List[StoredDocument],
    ) -> int:
        """Insert documents in batches."""
        if not self.pool:
            await self.initialize()

        table_name = f"{self.schema}.vectors_{collection_name}"
        inserted = 0

        async with self.pool.acquire() as conn:
            for i in range(0, len(documents), self.batch_size):
                batch = documents[i : i + self.batch_size]
                
                # Format vectors as pgvector-compatible strings: '[0.1, 0.2, ...]'
                # Convert metadata dict to JSON string for JSONB column
                values = [
                    (
                        doc.id,
                        '[' + ','.join(str(v) for v in doc.vector) + ']',  # pgvector format
                        doc.content,
                        doc.relative_path,
                        doc.project_id,
                        doc.dataset_id,
                        json.dumps(doc.metadata),  # Convert dict to JSON string for JSONB
                    )
                    for doc in batch
                ]

                await conn.executemany(
                    f"""
                    INSERT INTO {table_name}
                    (id, vector, content, relative_path, project_id, dataset_id, metadata)
                    VALUES ($1, $2::vector, $3, $4, $5::uuid, $6::uuid, $7)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    values,
                )

                inserted += len(batch)
                LOGGER.info("Inserted %d/%d documents into %s", inserted, len(documents), collection_name)

        return inserted

    async def create_chunks_collection(self, collection_name: str, dimension: int) -> None:
        """Create a collection (table) for chunk vectors - unified schema with GitHub chunks."""
        if not self.pool:
            await self.initialize()

        # Use SAME table structure as GitHub chunks for unified retrieval
        table_name = f"{self.schema}.{collection_name}"

        async with self.pool.acquire() as conn:
            # Create schema if needed
            await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {self.schema}")

            # Unified schema matching PostgresDualVectorDatabase
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {table_name} (
                    id TEXT PRIMARY KEY,
                    vector vector({dimension}),
                    content TEXT,
                    relative_path TEXT,
                    start_line INTEGER,
                    end_line INTEGER,
                    file_extension TEXT,
                    project_id UUID,
                    dataset_id UUID,
                    source_type TEXT,
                    repo TEXT,
                    branch TEXT,
                    sha TEXT,
                    lang TEXT,
                    symbol JSONB,
                    metadata JSONB DEFAULT '{{}}'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # Create indexes matching GitHub schema
            sanitized = collection_name.replace('-', '_').replace('.', '_')
            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {sanitized}_vector_idx
                ON {table_name} USING ivfflat (vector vector_cosine_ops)
                WITH (lists = 100)
            """)

            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {sanitized}_project_idx
                ON {table_name}(project_id)
            """)

            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {sanitized}_dataset_idx
                ON {table_name}(dataset_id)
            """)

            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {sanitized}_source_type_idx
                ON {table_name}(source_type)
            """)

            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {sanitized}_metadata_idx
                ON {table_name} USING GIN (metadata)
            """)

            LOGGER.info("Created chunks collection %s (%dd) - unified schema", collection_name, dimension)

    async def insert_chunks(
        self,
        collection_name: str,
        chunks: List[StoredChunk],
    ) -> int:
        """Insert chunks in batches - unified schema matching GitHub chunks."""
        if not self.pool:
            await self.initialize()

        table_name = f"{self.schema}.{collection_name}"
        inserted = 0

        async with self.pool.acquire() as conn:
            for i in range(0, len(chunks), self.batch_size):
                batch = chunks[i : i + self.batch_size]
                
                # Map crawl4ai fields to unified schema
                values = [
                    (
                        chunk.id,
                        '[' + ','.join(str(v) for v in chunk.vector) + ']',  # vector
                        chunk.chunk_text,  # content
                        chunk.relative_path,  # relative_path
                        chunk.start_char or 0,  # start_line (reuse for char position)
                        chunk.end_char or 0,  # end_line (reuse for char position)
                        None,  # file_extension (N/A for web content)
                        chunk.project_id,  # project_id
                        chunk.dataset_id,  # dataset_id
                        'web',  # source_type
                        None,  # repo (N/A for web)
                        None,  # branch (N/A for web)
                        None,  # sha (N/A for web)
                        chunk.language,  # lang
                        None,  # symbol (N/A for web)
                        json.dumps({
                            **chunk.metadata,
                            'summary': chunk.summary,
                            'is_code': chunk.is_code,
                            'chunk_index': chunk.chunk_index,
                            'model_used': chunk.model_used,
                            'scope': chunk.scope,
                        }),  # metadata (combine all web-specific fields)
                    )
                    for chunk in batch
                ]

                await conn.executemany(
                    f"""
                    INSERT INTO {table_name}
                    (id, vector, content, relative_path, start_line, end_line, file_extension,
                     project_id, dataset_id, source_type, repo, branch, sha, lang, symbol, metadata)
                    VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8::uuid, $9::uuid, $10, $11, $12, $13, $14, $15, $16)
                    ON CONFLICT (id) DO UPDATE SET
                      vector = EXCLUDED.vector,
                      content = EXCLUDED.content,
                      metadata = EXCLUDED.metadata
                    """,
                    values,
                )

                inserted += len(batch)
                LOGGER.info("Inserted %d/%d chunks into %s (unified schema)", inserted, len(chunks), collection_name)

        return inserted


__all__ = ["PostgresVectorStore", "StoredDocument", "StoredChunk"]
