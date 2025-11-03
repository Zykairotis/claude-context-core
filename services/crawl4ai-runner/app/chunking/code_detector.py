"""
Tree-sitter based code detection with language identification.

This module uses tree-sitter AST parsing to detect code vs natural text
and identify programming languages with high confidence. Supports 20+ languages
with intelligent fallback to heuristics when tree-sitter is unavailable.
"""

import re
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class Language(str, Enum):
    """Supported programming languages."""
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    GO = "go"
    RUST = "rust"
    C = "c"
    CPP = "cpp"
    CSHARP = "csharp"
    PHP = "php"
    RUBY = "ruby"
    SWIFT = "swift"
    KOTLIN = "kotlin"
    SCALA = "scala"
    R = "r"
    SHELL = "shell"
    SQL = "sql"
    HTML = "html"
    CSS = "css"
    MARKDOWN = "markdown"
    UNKNOWN = "unknown"


@dataclass
class DetectionResult:
    """Result of code detection analysis."""
    is_code: bool
    language: Language
    confidence: float  # 0.0 to 1.0
    metadata: Dict[str, Any]


class CodeDetector:
    """
    Detects code vs text using tree-sitter AST analysis.
    
    Falls back to heuristic-based detection if tree-sitter
    is unavailable or parsing fails.
    """
    
    # Language-specific syntax patterns for heuristic detection
    SYNTAX_PATTERNS = {
        Language.PYTHON: [
            r'\bdef\s+\w+\s*\(',
            r'\bclass\s+\w+',
            r'\bimport\s+\w+',
            r'\bfrom\s+\w+\s+import',
            r'@\w+\s*\(',  # Decorators
        ],
        Language.JAVASCRIPT: [
            r'\bfunction\s+\w+\s*\(',
            r'\bconst\s+\w+\s*=',
            r'\blet\s+\w+\s*=',
            r'\bvar\s+\w+\s*=',
            r'=>',  # Arrow functions
            r'\bconsole\.log\(',
        ],
        Language.TYPESCRIPT: [
            r'\binterface\s+\w+',
            r'\btype\s+\w+\s*=',
            r':\s*\w+(\[\])?(?=\s*[=;,)])',  # Type annotations
            r'\bas\s+\w+',
        ],
        Language.JAVA: [
            r'\bpublic\s+class\s+\w+',
            r'\bprivate\s+\w+',
            r'\bprotected\s+\w+',
            r'\bstatic\s+void\s+main',
            r'\bpackage\s+[\w.]+;',
        ],
        Language.GO: [
            r'\bfunc\s+\w+\s*\(',
            r'\bpackage\s+\w+',
            r'\btype\s+\w+\s+struct',
            r':=',  # Short variable declaration
        ],
        Language.RUST: [
            r'\bfn\s+\w+\s*\(',
            r'\blet\s+mut\s+\w+',
            r'\bimpl\s+\w+',
            r'\bmatch\s+\w+\s*{',
        ],
        Language.C: [
            r'\bint\s+main\s*\(',
            r'\#include\s*<[\w.]+>',
            r'\bstruct\s+\w+',
            r'\bvoid\s+\w+\s*\(',
        ],
        Language.CPP: [
            r'\bclass\s+\w+',
            r'\btemplate\s*<',
            r'\bnamespace\s+\w+',
            r'std::',
        ],
        Language.PHP: [
            r'<\?php',
            r'\$\w+\s*=',
            r'\bfunction\s+\w+\s*\(',
        ],
        Language.RUBY: [
            r'\bdef\s+\w+',
            r'\bclass\s+\w+',
            r'\bend\b',
            r'@\w+',  # Instance variables
        ],
        Language.SQL: [
            r'\bSELECT\s+',
            r'\bFROM\s+\w+',
            r'\bWHERE\s+',
            r'\bINSERT\s+INTO',
            r'\bUPDATE\s+\w+\s+SET',
        ],
        Language.SHELL: [
            r'^\#\!/bin/(bash|sh)',
            r'\$\{?\w+\}?',  # Variables
            r'\|\s*\w+',  # Pipes
        ],
    }
    
    # Common code indicators (language-agnostic)
    CODE_INDICATORS = [
        r'[{}();]',  # Braces, parens, semicolons
        r'[\w]+\s*=\s*[\w"\']+',  # Assignments
        r'\b(if|else|for|while|return)\b',  # Keywords
        r'/\*.*?\*/',  # Multi-line comments
        r'//.*$',  # Single-line comments
    ]
    
    def __init__(self, enable_tree_sitter: bool = True):
        """
        Initialize code detector.
        
        Args:
            enable_tree_sitter: Use tree-sitter if available (default: True)
        """
        self.enable_tree_sitter = enable_tree_sitter
        self.parsers = {}
        
        if enable_tree_sitter:
            self._init_tree_sitter()
    
    def _init_tree_sitter(self):
        """Initialize tree-sitter parsers for supported languages."""
        try:
            import tree_sitter
            
            # Try to import language grammars
            parsers_loaded = {}
            
            try:
                from tree_sitter_python import language as python_lang
                parser = tree_sitter.Parser(tree_sitter.Language(python_lang()))
                parsers_loaded[Language.PYTHON] = parser
            except (ImportError, Exception):
                pass
            
            try:
                from tree_sitter_javascript import language as js_lang
                parser = tree_sitter.Parser(tree_sitter.Language(js_lang()))
                parsers_loaded[Language.JAVASCRIPT] = parser
            except (ImportError, Exception):
                pass
            
            try:
                from tree_sitter_typescript import language_typescript as ts_lang
                parser = tree_sitter.Parser(tree_sitter.Language(ts_lang()))
                parsers_loaded[Language.TYPESCRIPT] = parser
            except (ImportError, Exception):
                pass
            
            try:
                from tree_sitter_go import language as go_lang
                parser = tree_sitter.Parser(tree_sitter.Language(go_lang()))
                parsers_loaded[Language.GO] = parser
            except (ImportError, Exception):
                pass
            
            try:
                from tree_sitter_rust import language as rust_lang
                parser = tree_sitter.Parser(tree_sitter.Language(rust_lang()))
                parsers_loaded[Language.RUST] = parser
            except (ImportError, Exception):
                pass
            
            try:
                from tree_sitter_java import language as java_lang
                parser = tree_sitter.Parser(tree_sitter.Language(java_lang()))
                parsers_loaded[Language.JAVA] = parser
            except (ImportError, Exception):
                pass
            
            try:
                from tree_sitter_c import language as c_lang
                parser = tree_sitter.Parser(tree_sitter.Language(c_lang()))
                parsers_loaded[Language.C] = parser
            except (ImportError, Exception):
                pass
            
            self.parsers = parsers_loaded
            
        except ImportError:
            # Tree-sitter not available, will use heuristics
            self.enable_tree_sitter = False
    
    def detect(self, text: str, hint_language: Optional[str] = None) -> DetectionResult:
        """
        Detect if text is code and identify the language.
        
        Args:
            text: Text to analyze
            hint_language: Optional language hint (e.g., from file extension)
            
        Returns:
            DetectionResult with is_code flag, language, and confidence
        """
        if not text or len(text.strip()) < 10:
            return DetectionResult(
                is_code=False,
                language=Language.UNKNOWN,
                confidence=0.0,
                metadata={"reason": "text_too_short"},
            )
        
        # Try tree-sitter first if enabled
        if self.enable_tree_sitter and self.parsers:
            result = self._detect_with_tree_sitter(text, hint_language)
            if result.confidence > 0.5:
                return result
        
        # Fallback to heuristic detection
        return self._detect_with_heuristics(text, hint_language)
    
    def _detect_with_tree_sitter(
        self,
        text: str,
        hint_language: Optional[str] = None,
    ) -> DetectionResult:
        """
        Use tree-sitter AST parsing to detect code.
        
        A successful parse with minimal errors indicates code.
        """
        # Determine languages to try
        if hint_language:
            try:
                hint_lang = Language(hint_language.lower())
                languages_to_try = [hint_lang] if hint_lang in self.parsers else []
            except ValueError:
                languages_to_try = []
        else:
            languages_to_try = list(self.parsers.keys())
        
        best_result = None
        best_score = 0.0
        
        for language in languages_to_try:
            parser = self.parsers.get(language)
            if not parser:
                continue
            
            try:
                tree = parser.parse(bytes(text, "utf8"))
                root_node = tree.root_node
                
                # Calculate parse quality
                error_count = self._count_errors(root_node)
                node_count = self._count_nodes(root_node)
                
                if node_count == 0:
                    continue
                
                error_ratio = error_count / node_count
                confidence = max(0.0, 1.0 - error_ratio)
                
                # Boost confidence if parse had no errors
                if error_count == 0:
                    confidence = min(1.0, confidence + 0.2)
                
                if confidence > best_score:
                    best_score = confidence
                    best_result = DetectionResult(
                        is_code=True,
                        language=language,
                        confidence=confidence,
                        metadata={
                            "method": "tree_sitter",
                            "node_count": node_count,
                            "error_count": error_count,
                        },
                    )
            except Exception:
                continue
        
        if best_result and best_score > 0.5:
            return best_result
        
        return DetectionResult(
            is_code=False,
            language=Language.UNKNOWN,
            confidence=0.0,
            metadata={"method": "tree_sitter", "reason": "no_successful_parse"},
        )
    
    def _count_errors(self, node) -> int:
        """Count error nodes in AST."""
        count = 1 if node.type == "ERROR" else 0
        for child in node.children:
            count += self._count_errors(child)
        return count
    
    def _count_nodes(self, node) -> int:
        """Count total nodes in AST."""
        count = 1
        for child in node.children:
            count += self._count_nodes(child)
        return count
    
    def _detect_with_heuristics(
        self,
        text: str,
        hint_language: Optional[str] = None,
    ) -> DetectionResult:
        """
        Use pattern matching to detect code.
        
        This is a fallback when tree-sitter is unavailable or fails.
        """
        # Try hint language first
        if hint_language:
            try:
                hint_lang = Language(hint_language.lower())
                result = self._check_language_patterns(text, hint_lang)
                if result.is_code:
                    return result
            except ValueError:
                pass
        
        # Try all known languages
        best_result = None
        best_score = 0.0
        
        for language, patterns in self.SYNTAX_PATTERNS.items():
            score = 0.0
            matches = 0
            
            for pattern in patterns:
                if re.search(pattern, text, re.MULTILINE | re.IGNORECASE):
                    matches += 1
                    score += 0.25
            
            # Normalize score
            score = min(1.0, score)
            
            if matches > 0 and score > best_score:
                best_score = score
                best_result = DetectionResult(
                    is_code=True,
                    language=language,
                    confidence=score,
                    metadata={
                        "method": "heuristic",
                        "pattern_matches": matches,
                    },
                )
        
        # Check general code indicators
        if not best_result or best_score < 0.3:
            code_score = self._check_general_code_indicators(text)
            if code_score > 0.3:
                return DetectionResult(
                    is_code=True,
                    language=Language.UNKNOWN,
                    confidence=code_score,
                    metadata={
                        "method": "heuristic",
                        "general_indicators": True,
                    },
                )
        
        if best_result:
            return best_result
        
        return DetectionResult(
            is_code=False,
            language=Language.UNKNOWN,
            confidence=0.9,  # High confidence it's NOT code
            metadata={"method": "heuristic", "reason": "no_patterns_matched"},
        )
    
    def _check_language_patterns(self, text: str, language: Language) -> DetectionResult:
        """Check text against patterns for a specific language."""
        patterns = self.SYNTAX_PATTERNS.get(language, [])
        matches = 0
        
        for pattern in patterns:
            if re.search(pattern, text, re.MULTILINE | re.IGNORECASE):
                matches += 1
        
        if matches > 0:
            confidence = min(1.0, matches * 0.3)
            return DetectionResult(
                is_code=True,
                language=language,
                confidence=confidence,
                metadata={
                    "method": "heuristic",
                    "pattern_matches": matches,
                },
            )
        
        return DetectionResult(
            is_code=False,
            language=Language.UNKNOWN,
            confidence=0.0,
            metadata={"method": "heuristic"},
        )
    
    def _check_general_code_indicators(self, text: str) -> float:
        """Check for general code indicators (language-agnostic)."""
        score = 0.0
        
        for pattern in self.CODE_INDICATORS:
            if re.search(pattern, text, re.MULTILINE):
                score += 0.15
        
        # Check code-like density (lots of symbols)
        symbol_chars = len(re.findall(r'[{}()\[\];,.]', text))
        total_chars = len(text)
        symbol_ratio = symbol_chars / total_chars if total_chars > 0 else 0
        
        if symbol_ratio > 0.1:
            score += 0.2
        
        # Check indentation patterns (common in code)
        lines = text.split('\n')
        indented_lines = sum(1 for line in lines if line.startswith((' ', '\t')))
        indent_ratio = indented_lines / len(lines) if lines else 0
        
        if indent_ratio > 0.3:
            score += 0.15
        
        return min(1.0, score)

