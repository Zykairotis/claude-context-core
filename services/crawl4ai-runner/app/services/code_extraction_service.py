"""Code extraction and summarisation utilities."""

from __future__ import annotations

import asyncio
import html
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Iterable, List, Optional, Protocol, Sequence

from bs4 import BeautifulSoup


LOGGER = logging.getLogger(__name__)


class SummaryProvider(Protocol):
    async def summarize_code_examples(self, examples: Sequence["CodeExample"]) -> List[str]:
        ...


@dataclass
class DocumentSnapshot:
    url: str
    markdown: str
    html: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None


@dataclass
class CodeExample:
    source_url: str
    language: str
    code: str
    summary: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


class CodeExtractionService:
    def __init__(self, *, min_length_default: int = 20):
        self.min_length_default = min_length_default

    async def extract_and_store_code_examples(
        self,
        documents: Sequence[DocumentSnapshot],
        *,
        provider: Optional[SummaryProvider] = None,
        progress_callback=None,
        concurrency: int = 4,
    ) -> List[CodeExample]:
        examples: List[CodeExample] = []
        total = len(documents)

        semaphore = asyncio.Semaphore(concurrency)

        async def extract_from_document(document: DocumentSnapshot, index: int) -> None:
            async with semaphore:
                extracted = self._extract_code_blocks_from_document(document)
                examples.extend(extracted)
                if progress_callback:
                    progress_callback(index + 1, total, document.url)

        await asyncio.gather(*(extract_from_document(doc, idx) for idx, doc in enumerate(documents)))

        if provider and examples:
            summaries = await provider.summarize_code_examples(examples)
            for example, summary in zip(examples, summaries):
                example.summary = summary
        else:
            for example in examples:
                example.summary = example.summary or f"Code example from {example.source_url}"

        return examples

    def _extract_code_blocks_from_document(self, document: DocumentSnapshot) -> List[CodeExample]:
        results: List[CodeExample] = []
        if document.html:
            results.extend(self._extract_html_code_blocks(document))
        if document.markdown:
            results.extend(self._extract_markdown_code_blocks(document))
        if document.text:
            results.extend(self._extract_text_blocks(document))
        return results

    def _extract_html_code_blocks(self, document: DocumentSnapshot) -> List[CodeExample]:
        soup = BeautifulSoup(document.html or "", "lxml")
        code_blocks = []
        selectors = [
            "pre code",
            "code[class*='language-']",
            "div.highlight pre",
            "div[class*='code-block'] pre",
            "div[class*='codeBlock'] pre",
        ]
        for selector in selectors:
            for node in soup.select(selector):
                code = node.get_text("\n")
                language = self._detect_language_from_classes(node.get("class", []))
                example = self._build_example(document.url, code, language, source="html")
                if example:
                    code_blocks.append(example)
        return code_blocks

    def _extract_markdown_code_blocks(self, document: DocumentSnapshot) -> List[CodeExample]:
        pattern = re.compile(r"```(?P<lang>[\w+-]*)\n(?P<code>[\s\S]*?)```", re.MULTILINE)
        matches = pattern.finditer(document.markdown or "")
        blocks = []
        for match in matches:
            language = match.group("lang") or ""
            code = match.group("code")
            example = self._build_example(document.url, code, language, source="markdown")
            if example:
                blocks.append(example)
        return blocks

    def _extract_text_blocks(self, document: DocumentSnapshot) -> List[CodeExample]:
        lines = (document.text or "").splitlines()
        buffer: List[str] = []
        blocks: List[CodeExample] = []
        for line in lines:
            if line.startswith("    ") or line.startswith("\t"):
                buffer.append(line[4:] if line.startswith("    ") else line.lstrip("\t"))
            else:
                if buffer:
                    code = "\n".join(buffer)
                    example = self._build_example(document.url, code, "", source="text")
                    if example:
                        blocks.append(example)
                    buffer = []
        if buffer:
            code = "\n".join(buffer)
            example = self._build_example(document.url, code, "", source="text")
            if example:
                blocks.append(example)
        return blocks

    def _build_example(self, url: str, code: str, language_hint: str, *, source: str) -> Optional[CodeExample]:
        cleaned = self._clean_code_content(code)
        if not cleaned:
            return None
        language = language_hint or self._detect_language_from_content(cleaned)
        if not self._validate_code_quality(cleaned):
            return None
        min_len = self._calculate_min_length(language)
        if len(cleaned.splitlines()) < max(1, min_len // 40):
            return None
        metadata = {"source": source, "lines": cleaned.count("\n") + 1}
        return CodeExample(source_url=url, language=language, code=cleaned, metadata=metadata)

    def _clean_code_content(self, code: str) -> str:
        unescaped = html.unescape(code)
        return "\n".join(line.rstrip() for line in unescaped.strip().splitlines())

    def _validate_code_quality(self, code: str) -> bool:
        indicators = sum(
            1
            for token in ["=", "def ", "class ", "{", "};", "function ", "=>", "if ", "for "]
            if token in code
        )
        prose_indicators = sum(1 for token in [" the ", " and ", " is ", "."] if token in code.lower())
        return indicators >= 2 and prose_indicators < 5

    def _calculate_min_length(self, language: str) -> int:
        language = (language or "").lower()
        if language in {"python", "py"}:
            return 30
        if language in {"javascript", "js", "ts", "typescript"}:
            return 40
        return self.min_length_default

    def _detect_language_from_content(self, code: str) -> str:
        sample = code.lower()
        if "async def" in sample or "import " in sample:
            return "python"
        if "function" in sample or "const" in sample and "=>" in sample:
            return "javascript"
        if "class" in sample and "public" in sample:
            return "java"
        if "#include" in sample or "printf" in sample:
            return "c"
        return "text"

    def _detect_language_from_classes(self, classes: Iterable[str]) -> str:
        for cls in classes:
            if cls.startswith("language-"):
                return cls.split("-", 1)[1]
            if cls in {"python", "javascript", "typescript", "java", "c"}:
                return cls
        return ""


__all__ = ["CodeExample", "CodeExtractionService", "DocumentSnapshot", "SummaryProvider"]

