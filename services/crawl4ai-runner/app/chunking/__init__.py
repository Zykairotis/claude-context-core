"""
Intelligent text chunking with tree-sitter code detection.

This module provides advanced text splitting with overlapping chunks,
AST-based code detection using tree-sitter, and smart routing for
embedding models (GTE for text, CodeRank for code).
"""

from .text_splitter import RecursiveTextSplitter
from .code_detector import CodeDetector, DetectionResult
from .smart_chunker import SmartChunker, Chunk

__all__ = [
    "RecursiveTextSplitter",
    "CodeDetector",
    "DetectionResult",
    "SmartChunker",
    "Chunk",
]

