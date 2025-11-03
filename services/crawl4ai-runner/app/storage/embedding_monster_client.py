"""EmbeddingMonster client for generating embeddings via local services."""

from __future__ import annotations

import asyncio
import logging
from typing import List, Literal, Optional

import httpx


LOGGER = logging.getLogger(__name__)


class EmbeddingMonsterClient:
    """Client for EmbeddingMonster services (GTE and CodeRank)."""

    def __init__(
        self,
        *,
        gte_port: int = 30001,
        coderank_port: int = 30002,
        timeout: float = 30.0,
        retries: int = 3,
        batch_size: int = 32,
        host: Optional[str] = None,
    ):
        import os
        # Use host.docker.internal to reach host machine from container
        # On Linux, this is mapped via docker-compose extra_hosts
        embedding_host = host or os.getenv("EMBEDDING_HOST", "host.docker.internal")
        self.gte_url = f"http://{embedding_host}:{gte_port}"
        self.coderank_url = f"http://{embedding_host}:{coderank_port}"
        self.timeout = timeout
        self.retries = retries
        self.batch_size = batch_size
        self.dimension = 768  # Both models use 768d

    async def embed_batch(
        self,
        texts: List[str],
        model: Literal["gte", "coderank"] = "gte",
    ) -> List[List[float]]:
        """Generate embeddings for a batch of texts."""
        if not texts:
            return []

        base_url = self.gte_url if model == "gte" else self.coderank_url
        model_name = "gte-base-en-v1.5" if model == "gte" else "coderank"

        # Process in chunks of batch_size
        all_embeddings: List[List[float]] = []
        
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            embeddings = await self._request_embeddings(base_url, model_name, batch)
            all_embeddings.extend(embeddings)
            
            if len(texts) > self.batch_size and (i + self.batch_size) % (self.batch_size * 5) == 0:
                LOGGER.info(
                    "EmbeddingMonster progress: %d/%d chunks (%s)",
                    min(i + self.batch_size, len(texts)),
                    len(texts),
                    model,
                )

        return all_embeddings

    async def _request_embeddings(
        self,
        base_url: str,
        model: str,
        texts: List[str],
    ) -> List[List[float]]:
        """Make HTTP request to embedding service with retries."""
        last_error = None

        for attempt in range(1, self.retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        f"{base_url}/embed",
                        json={"inputs": texts, "model": model},
                    )
                    response.raise_for_status()
                    data = response.json()

                    # Handle both response formats
                    if isinstance(data, list):
                        return data
                    if isinstance(data, dict) and "embeddings" in data:
                        return data["embeddings"]
                    
                    raise ValueError("Invalid response format")

            except Exception as exc:
                last_error = exc
                if attempt < self.retries:
                    delay = min(2 ** (attempt - 1), 5)
                    LOGGER.warning(
                        "Embedding request failed (attempt %d/%d), retrying in %ds: %s",
                        attempt,
                        self.retries,
                        delay,
                        exc,
                    )
                    await asyncio.sleep(delay)
                else:
                    LOGGER.error(
                        "Embedding request failed after %d attempts: %s",
                        self.retries,
                        exc,
                    )

        raise last_error or RuntimeError("Embedding request failed")

    async def check_health(self, model: Literal["gte", "coderank"] = "gte") -> bool:
        """Check if embedding service is healthy."""
        base_url = self.gte_url if model == "gte" else self.coderank_url
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{base_url}/health")
                return response.status_code == 200
        except Exception as exc:
            LOGGER.warning("Health check failed for %s: %s", model, exc)
            return False


__all__ = ["EmbeddingMonsterClient"]
