"""
Smart chunking orchestrator with code detection and model routing.

This module combines recursive text splitting with tree-sitter code detection
to intelligently route chunks to appropriate embedding models:
- GTE for natural language text
- CodeRankEmbed for code

Each chunk includes metadata for tracking position, language, and routing.
"""

import os
from typing import List, Optional
from dataclasses import dataclass

from .text_splitter import RecursiveTextSplitter
from .code_detector import CodeDetector, DetectionResult, Language


@dataclass
class Chunk:
    """
    Represents a single text or code chunk with routing metadata.
    
    Attributes:
        text: Chunk content
        is_code: Whether this chunk contains code
        language: Detected programming language (or 'unknown' for text)
        start_char: Start position in original document
        end_char: End position in original document
        chunk_index: Sequential index within document
        confidence: Code detection confidence (0.0 to 1.0)
        source_path: Original file/URL path
        model_hint: Suggested embedding model ('gte' or 'coderank')
    """
    text: str
    is_code: bool
    language: str
    start_char: int
    end_char: int
    chunk_index: int
    confidence: float
    source_path: str
    model_hint: str


class SmartChunker:
    """
    Intelligent text chunker with AST-based code detection.
    
    This class orchestrates the entire chunking pipeline:
    1. Split text into overlapping chunks
    2. Detect code vs text using tree-sitter
    3. Tag chunks with routing information for embedding models
    """
    
    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        enable_tree_sitter: Optional[bool] = None,
    ):
        """
        Initialize smart chunker.
        
        Args:
            chunk_size: Max characters per chunk (default: from env or 1000)
            chunk_overlap: Overlap between chunks (default: from env or 200)
            enable_tree_sitter: Use tree-sitter for detection (default: True)
        """
        # Load configuration from environment
        self.chunk_size = chunk_size or int(os.getenv("CHUNK_SIZE", "1000"))
        self.chunk_overlap = chunk_overlap or int(os.getenv("CHUNK_OVERLAP", "200"))
        self.enable_tree_sitter = (
            enable_tree_sitter
            if enable_tree_sitter is not None
            else os.getenv("ENABLE_TREE_SITTER", "true").lower() == "true"
        )
        
        # Initialize components
        self.text_splitter = RecursiveTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )
        self.code_detector = CodeDetector(
            enable_tree_sitter=self.enable_tree_sitter,
        )
    
    def chunk_text(
        self,
        text: str,
        source_path: str = "",
        language_hint: Optional[str] = None,
    ) -> List[Chunk]:
        """
        Split text into smart chunks with code detection.
        
        Args:
            text: Text to chunk
            source_path: Original file/URL path for provenance
            language_hint: Optional language hint from file extension
            
        Returns:
            List of Chunk objects with routing metadata
        """
        if not text:
            return []
        
        # Step 1: Split text into overlapping chunks
        text_chunks = self.text_splitter.split_text(text)
        
        # Step 2: Detect code in each chunk
        smart_chunks = []
        
        for idx, text_chunk in enumerate(text_chunks):
            # Detect if chunk is code
            detection: DetectionResult = self.code_detector.detect(
                text_chunk.text,
                hint_language=language_hint,
            )
            
            # Determine embedding model
            model_hint = "coderank" if detection.is_code else "gte"
            
            # Create smart chunk
            chunk = Chunk(
                text=text_chunk.text,
                is_code=detection.is_code,
                language=detection.language.value,
                start_char=text_chunk.start_char,
                end_char=text_chunk.end_char,
                chunk_index=idx,
                confidence=detection.confidence,
                source_path=source_path,
                model_hint=model_hint,
            )
            
            smart_chunks.append(chunk)
        
        return smart_chunks
    
    def chunk_documents(
        self,
        documents: List[dict],
        text_field: str = "content",
        path_field: str = "path",
    ) -> List[Chunk]:
        """
        Chunk multiple documents in batch.
        
        Args:
            documents: List of document dicts
            text_field: Key for text content in document dict
            path_field: Key for path/URL in document dict
            
        Returns:
            Flat list of all chunks from all documents
        """
        all_chunks = []
        
        for doc in documents:
            text = doc.get(text_field, "")
            path = doc.get(path_field, "")
            
            # Try to infer language from path
            language_hint = self._infer_language_from_path(path)
            
            # Chunk this document
            doc_chunks = self.chunk_text(text, path, language_hint)
            all_chunks.extend(doc_chunks)
        
        return all_chunks
    
    def get_routing_info(self, chunks: List[Chunk]) -> dict:
        """
        Get routing statistics for embedding models.
        
        Args:
            chunks: List of chunks to analyze
            
        Returns:
            Dict with routing stats (GTE count, CodeRank count, etc.)
        """
        gte_chunks = [c for c in chunks if c.model_hint == "gte"]
        coderank_chunks = [c for c in chunks if c.model_hint == "coderank"]
        
        # Language breakdown
        languages = {}
        for chunk in chunks:
            lang = chunk.language
            languages[lang] = languages.get(lang, 0) + 1
        
        return {
            "total_chunks": len(chunks),
            "gte_chunks": len(gte_chunks),
            "coderank_chunks": len(coderank_chunks),
            "gte_ratio": len(gte_chunks) / len(chunks) if chunks else 0,
            "coderank_ratio": len(coderank_chunks) / len(chunks) if chunks else 0,
            "languages": languages,
            "avg_confidence": (
                sum(c.confidence for c in chunks) / len(chunks) if chunks else 0
            ),
        }
    
    @staticmethod
    def _infer_language_from_path(path: str) -> Optional[str]:
        """Infer programming language from file extension."""
        if not path:
            return None
        
        extension_map = {
            ".py": "python",
            ".js": "javascript",
            ".jsx": "javascript",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".java": "java",
            ".go": "go",
            ".rs": "rust",
            ".c": "c",
            ".h": "c",
            ".cpp": "cpp",
            ".cc": "cpp",
            ".cxx": "cpp",
            ".hpp": "cpp",
            ".cs": "csharp",
            ".php": "php",
            ".rb": "ruby",
            ".swift": "swift",
            ".kt": "kotlin",
            ".scala": "scala",
            ".r": "r",
            ".sh": "shell",
            ".bash": "shell",
            ".sql": "sql",
            ".html": "html",
            ".css": "css",
            ".md": "markdown",
        }
        
        # Get file extension
        if "." in path:
            ext = "." + path.rsplit(".", 1)[-1].lower()
            return extension_map.get(ext)
        
        return None

