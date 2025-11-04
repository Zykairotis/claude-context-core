"""
Extract code blocks from markdown for separate embedding.

This module parses markdown content and extracts fenced code blocks,
allowing them to be chunked and embedded separately with CodeRank.
"""

import re
from typing import List, Tuple
from dataclasses import dataclass


@dataclass
class CodeBlock:
    """Represents an extracted code block from markdown."""
    code: str
    language: str
    start_pos: int
    end_pos: int


@dataclass
class MarkdownSegment:
    """Represents a segment of markdown (either text or code)."""
    content: str
    is_code: bool
    language: str  # For code blocks, the language; for text, "markdown"
    start_pos: int
    end_pos: int


class MarkdownCodeExtractor:
    """
    Extracts code blocks from markdown and returns structured segments.
    
    Handles both fenced code blocks (```) and indented code blocks.
    """
    
    # Pattern for fenced code blocks: ```language\ncode\n```
    FENCED_CODE_PATTERN = re.compile(
        r'^```(\w+)?\s*\n(.*?)^```\s*$',
        re.MULTILINE | re.DOTALL
    )
    
    # Pattern for indented code blocks (4 spaces or 1 tab)
    INDENTED_CODE_PATTERN = re.compile(
        r'^(?:    |\t)(.+)$',
        re.MULTILINE
    )
    
    def extract_segments(self, markdown: str) -> List[MarkdownSegment]:
        """
        Extract all segments (text and code) from markdown.
        
        Args:
            markdown: Raw markdown text
            
        Returns:
            List of MarkdownSegment objects in order
        """
        if not markdown:
            return []
        
        segments = []
        last_end = 0
        
        # Find all fenced code blocks
        for match in self.FENCED_CODE_PATTERN.finditer(markdown):
            start_pos = match.start()
            end_pos = match.end()
            language = match.group(1) or "unknown"
            code = match.group(2).strip()
            
            # Add text segment before code block (if any)
            if start_pos > last_end:
                text_content = markdown[last_end:start_pos].strip()
                if text_content:
                    segments.append(MarkdownSegment(
                        content=text_content,
                        is_code=False,
                        language="markdown",
                        start_pos=last_end,
                        end_pos=start_pos
                    ))
            
            # Add code segment
            if code:
                segments.append(MarkdownSegment(
                    content=code,
                    is_code=True,
                    language=language,
                    start_pos=start_pos,
                    end_pos=end_pos
                ))
            
            last_end = end_pos
        
        # Add remaining text after last code block
        if last_end < len(markdown):
            text_content = markdown[last_end:].strip()
            if text_content:
                segments.append(MarkdownSegment(
                    content=text_content,
                    is_code=False,
                    language="markdown",
                    start_pos=last_end,
                    end_pos=len(markdown)
                ))
        
        # If no code blocks found, return entire content as text
        if not segments:
            segments.append(MarkdownSegment(
                content=markdown,
                is_code=False,
                language="markdown",
                start_pos=0,
                end_pos=len(markdown)
            ))
        
        return segments
    
    def extract_code_blocks(self, markdown: str) -> List[CodeBlock]:
        """
        Extract only code blocks from markdown.
        
        Args:
            markdown: Raw markdown text
            
        Returns:
            List of CodeBlock objects
        """
        code_blocks = []
        
        for match in self.FENCED_CODE_PATTERN.finditer(markdown):
            language = match.group(1) or "unknown"
            code = match.group(2).strip()
            
            if code:
                code_blocks.append(CodeBlock(
                    code=code,
                    language=language,
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        return code_blocks
    
    def get_stats(self, segments: List[MarkdownSegment]) -> dict:
        """Get statistics about extracted segments."""
        code_segments = [s for s in segments if s.is_code]
        text_segments = [s for s in segments if not s.is_code]
        
        language_counts = {}
        for segment in code_segments:
            lang = segment.language
            language_counts[lang] = language_counts.get(lang, 0) + 1
        
        total_code_chars = sum(len(s.content) for s in code_segments)
        total_text_chars = sum(len(s.content) for s in text_segments)
        
        return {
            "total_segments": len(segments),
            "code_segments": len(code_segments),
            "text_segments": len(text_segments),
            "code_chars": total_code_chars,
            "text_chars": total_text_chars,
            "code_ratio": total_code_chars / (total_code_chars + total_text_chars) if (total_code_chars + total_text_chars) > 0 else 0,
            "languages": language_counts
        }
