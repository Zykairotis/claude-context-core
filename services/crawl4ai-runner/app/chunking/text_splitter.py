"""
Recursive text splitter with overlap and smart boundary detection.

This module implements a character-based text splitter that:
- Preserves sentence and paragraph boundaries
- Handles markdown headers intelligently
- Supports configurable chunk size and overlap
- Maintains semantic coherence across chunks
"""

import re
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class TextChunk:
    """Represents a text chunk with position metadata."""
    text: str
    start_char: int
    end_char: int


class RecursiveTextSplitter:
    """
    Splits text into overlapping chunks while preserving semantic boundaries.
    
    The splitter uses a hierarchy of separators to find natural break points,
    preferring larger semantic units (paragraphs, sentences) over arbitrary
    character positions.
    """
    
    # Separator hierarchy (tried in order)
    SEPARATORS = [
        "\n\n\n",  # Multiple blank lines (section breaks)
        "\n\n",    # Paragraph breaks
        "\n",      # Line breaks
        ". ",      # Sentence ends
        "! ",      # Exclamation ends
        "? ",      # Question ends
        "; ",      # Semicolon
        ", ",      # Comma
        " ",       # Space
        "",        # Character-level fallback
    ]
    
    # Markdown header patterns
    HEADER_PATTERN = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        length_function: Optional[callable] = None,
    ):
        """
        Initialize the text splitter.
        
        Args:
            chunk_size: Maximum characters per chunk (default: 1000)
            chunk_overlap: Characters to overlap between chunks (default: 200)
            length_function: Custom length function (default: len)
        """
        if chunk_overlap >= chunk_size:
            raise ValueError("Chunk overlap must be less than chunk size")
        
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.length_function = length_function or len
    
    def split_text(self, text: str) -> List[TextChunk]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: Text to split
            
        Returns:
            List of TextChunk objects with position metadata
        """
        if not text:
            return []
        
        # Handle markdown headers specially
        chunks = self._split_with_headers(text)
        
        # Apply overlap
        chunks = self._apply_overlap(chunks, text)
        
        return chunks
    
    def _split_with_headers(self, text: str) -> List[TextChunk]:
        """
        Split text while preserving markdown header hierarchy.
        
        This method keeps headers attached to their content sections
        and treats them as natural boundaries.
        """
        # Find all headers
        headers = list(self.HEADER_PATTERN.finditer(text))
        
        if not headers:
            # No headers, use regular splitting
            return self._split_recursive(text, 0)
        
        chunks = []
        
        # Split by headers
        for i, header_match in enumerate(headers):
            start = header_match.start()
            
            # Determine section end (next header or end of text)
            if i + 1 < len(headers):
                end = headers[i + 1].start()
            else:
                end = len(text)
            
            section = text[start:end]
            
            # If section is small enough, keep as single chunk
            if self.length_function(section) <= self.chunk_size:
                chunks.append(TextChunk(
                    text=section,
                    start_char=start,
                    end_char=end,
                ))
            else:
                # Section too large, split recursively
                section_chunks = self._split_recursive(section, start)
                chunks.extend(section_chunks)
        
        # Handle text before first header
        if headers[0].start() > 0:
            prefix = text[:headers[0].start()]
            prefix_chunks = self._split_recursive(prefix, 0)
            chunks = prefix_chunks + chunks
        
        return chunks
    
    def _split_recursive(self, text: str, offset: int) -> List[TextChunk]:
        """
        Recursively split text using separator hierarchy.
        
        Args:
            text: Text to split
            offset: Character offset in original document
            
        Returns:
            List of TextChunk objects
        """
        if self.length_function(text) <= self.chunk_size:
            return [TextChunk(
                text=text,
                start_char=offset,
                end_char=offset + len(text),
            )]
        
        # Try each separator in order
        for separator in self.SEPARATORS:
            if separator == "":
                # Fallback: split by character
                return self._split_by_characters(text, offset)
            
            if separator in text:
                chunks = self._split_by_separator(text, separator, offset)
                if chunks:
                    return chunks
        
        # Should not reach here, but fallback to character split
        return self._split_by_characters(text, offset)
    
    def _split_by_separator(
        self,
        text: str,
        separator: str,
        offset: int,
    ) -> List[TextChunk]:
        """Split text by a specific separator."""
        splits = text.split(separator)
        chunks = []
        current_chunk = ""
        current_start = offset
        
        for i, split in enumerate(splits):
            # Add separator back (except for last split)
            if i < len(splits) - 1:
                split += separator
            
            # Check if adding this split would exceed chunk size
            test_chunk = current_chunk + split
            
            if self.length_function(test_chunk) <= self.chunk_size:
                current_chunk = test_chunk
            else:
                # Save current chunk if not empty
                if current_chunk:
                    chunks.append(TextChunk(
                        text=current_chunk,
                        start_char=current_start,
                        end_char=current_start + len(current_chunk),
                    ))
                    current_start = current_start + len(current_chunk)
                
                # If single split is too large, split it further
                if self.length_function(split) > self.chunk_size:
                    # Force character-level splitting to avoid infinite recursion
                    sub_chunks = self._split_by_characters(split, current_start)
                    chunks.extend(sub_chunks)
                    current_start = sub_chunks[-1].end_char if sub_chunks else current_start
                    current_chunk = ""
                else:
                    current_chunk = split
        
        # Add final chunk
        if current_chunk:
            chunks.append(TextChunk(
                text=current_chunk,
                start_char=current_start,
                end_char=current_start + len(current_chunk),
            ))
        
        return chunks
    
    def _split_by_characters(self, text: str, offset: int) -> List[TextChunk]:
        """Fallback: split by character count."""
        chunks = []
        for i in range(0, len(text), self.chunk_size):
            chunk_text = text[i:i + self.chunk_size]
            chunks.append(TextChunk(
                text=chunk_text,
                start_char=offset + i,
                end_char=offset + i + len(chunk_text),
            ))
        return chunks
    
    def _apply_overlap(self, chunks: List[TextChunk], full_text: str) -> List[TextChunk]:
        """
        Apply overlap between chunks.
        
        This method extends each chunk backward to include overlap
        from the previous chunk, improving context continuity.
        """
        if not chunks or self.chunk_overlap == 0:
            return chunks
        
        overlapped = []
        
        for i, chunk in enumerate(chunks):
            if i == 0:
                # First chunk: no overlap
                overlapped.append(chunk)
                continue
            
            # Calculate overlap start
            overlap_start = max(0, chunk.start_char - self.chunk_overlap)
            
            # Extract overlapped text
            overlapped_text = full_text[overlap_start:chunk.end_char]
            
            overlapped.append(TextChunk(
                text=overlapped_text,
                start_char=overlap_start,
                end_char=chunk.end_char,
            ))
        
        return overlapped

