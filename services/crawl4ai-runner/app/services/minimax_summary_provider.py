"""MiniMax M2 summary provider for code examples."""

from __future__ import annotations

import logging
import os
from typing import List, Sequence

from openai import AsyncOpenAI

from .code_extraction_service import CodeExample


LOGGER = logging.getLogger(__name__)


class MiniMaxSummaryProvider:
    """Summarize code examples using MiniMax M2 via OpenAI-compatible API."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str = "MiniMax-M2",
        max_tokens: int = 100,
        temperature: float = 0.3,
    ):
        self.api_key = api_key or os.getenv("MINIMAX_API_KEY")
        self.base_url = base_url or os.getenv("MINIMAX_API_BASE", "https://api.minimax.io/v1")
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature

        if not self.api_key:
            raise ValueError("MINIMAX_API_KEY must be set")

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )

    async def summarize_code_examples(self, examples: Sequence[CodeExample]) -> List[str]:
        """Generate concise summaries for code examples."""
        if not examples:
            return []

        summaries: List[str] = []
        for example in examples:
            try:
                summary = await self._summarize_single(example)
                summaries.append(summary)
            except Exception as exc:  # pylint: disable=broad-except
                LOGGER.warning("Failed to summarize code from %s: %s", example.source_url, exc)
                summaries.append(f"Code example from {example.source_url}")

        return summaries

    async def _summarize_single(self, example: CodeExample) -> str:
        """Summarize a single code example."""
        prompt = self._build_prompt(example)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a code documentation assistant. Provide concise, technical summaries.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=self.max_tokens,
            temperature=self.temperature,
        )

        content = response.choices[0].message.content
        return content.strip() if content else f"Code example from {example.source_url}"

    def _build_prompt(self, example: CodeExample) -> str:
        """Build summarization prompt for a code example."""
        code_preview = example.code[:500] if len(example.code) > 500 else example.code
        language = example.language or "code"

        return f"""Summarize this {language} code snippet in 1-2 concise sentences. Focus on what the code does and its purpose.

Source: {example.source_url}
Language: {language}

Code:
```{language}
{code_preview}
```

Summary:"""


__all__ = ["MiniMaxSummaryProvider"]
