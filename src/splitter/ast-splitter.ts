import Parser from 'tree-sitter';
import { Splitter, CodeChunk, SymbolMetadata } from './index';

// Language parsers
const JavaScript = require('tree-sitter-javascript');
const TypeScript = require('tree-sitter-typescript').typescript;
const Python = require('tree-sitter-python');
const Java = require('tree-sitter-java');
const Cpp = require('tree-sitter-cpp');
const Go = require('tree-sitter-go');
const Rust = require('tree-sitter-rust');
const CSharp = require('tree-sitter-c-sharp');
const Scala = require('tree-sitter-scala');

// Node types that represent logical code units
const SPLITTABLE_NODE_TYPES = {
    javascript: ['function_declaration', 'arrow_function', 'class_declaration', 'method_definition', 'export_statement'],
    typescript: ['function_declaration', 'arrow_function', 'class_declaration', 'method_definition', 'export_statement', 'interface_declaration', 'type_alias_declaration'],
    python: ['function_definition', 'class_definition', 'decorated_definition', 'async_function_definition'],
    java: ['method_declaration', 'class_declaration', 'interface_declaration', 'constructor_declaration'],
    cpp: ['function_definition', 'class_specifier', 'namespace_definition', 'declaration'],
    go: ['function_declaration', 'method_declaration', 'type_declaration', 'var_declaration', 'const_declaration'],
    rust: ['function_item', 'impl_item', 'struct_item', 'enum_item', 'trait_item', 'mod_item'],
    csharp: ['method_declaration', 'class_declaration', 'interface_declaration', 'struct_declaration', 'enum_declaration'],
    scala: ['method_declaration', 'class_declaration', 'interface_declaration', 'constructor_declaration']
};

// Language-specific symbol extraction configuration
const SYMBOL_EXTRACTORS: Record<string, { nameNode: string; paramNode: string; docNode: string }> = {
    typescript: {
        nameNode: 'identifier',
        paramNode: 'formal_parameters',
        docNode: 'comment'
    },
    javascript: {
        nameNode: 'identifier',
        paramNode: 'formal_parameters',
        docNode: 'comment'
    },
    python: {
        nameNode: 'identifier',
        paramNode: 'parameters',
        docNode: 'expression_statement'
    },
    java: {
        nameNode: 'identifier',
        paramNode: 'formal_parameters',
        docNode: 'block_comment'
    },
    cpp: {
        nameNode: 'identifier',
        paramNode: 'parameter_list',
        docNode: 'comment'
    },
    go: {
        nameNode: 'identifier',
        paramNode: 'parameter_list',
        docNode: 'comment'
    },
    rust: {
        nameNode: 'identifier',
        paramNode: 'parameters',
        docNode: 'line_comment'
    }
};

// Map node types to symbol kinds
const NODE_TYPE_TO_KIND: Record<string, SymbolMetadata['kind']> = {
    'function_declaration': 'function',
    'function_definition': 'function',
    'function_item': 'function',
    'arrow_function': 'function',
    'method_declaration': 'method',
    'method_definition': 'method',
    'class_declaration': 'class',
    'class_definition': 'class',
    'class_specifier': 'class',
    'interface_declaration': 'interface',
    'type_alias_declaration': 'type',
    'type_declaration': 'type',
    'struct_item': 'struct',
    'struct_declaration': 'struct',
    'enum_item': 'enum',
    'enum_declaration': 'enum',
    'trait_item': 'trait',
    'mod_item': 'module',
    'namespace_definition': 'module',
    'var_declaration': 'variable',
    'const_declaration': 'const',
    'constructor_declaration': 'method'
};

export class AstCodeSplitter implements Splitter {
    private chunkSize: number = 1000;
    private chunkOverlap: number = 100;
    private parser: Parser;
    private langchainFallback: any; // LangChainCodeSplitter for fallback

    constructor(chunkSize?: number, chunkOverlap?: number) {
        if (chunkSize) this.chunkSize = chunkSize;
        if (chunkOverlap || chunkOverlap === 0) this.chunkOverlap = chunkOverlap;
        this.parser = new Parser();

        // Initialize fallback splitter
        const { LangChainCodeSplitter } = require('./langchain-splitter');
        this.langchainFallback = new LangChainCodeSplitter(chunkSize, chunkOverlap);
    }

    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
        // Check if language is supported by AST splitter
        const langConfig = this.getLanguageConfig(language);
        if (!langConfig) {
            console.log(`📝 Language ${language} not supported by AST, using LangChain splitter for: ${filePath || 'unknown'}`);
            return await this.langchainFallback.split(code, language, filePath);
        }

        try {
            console.log(`🌳 Using AST splitter for ${language} file: ${filePath || 'unknown'}`);

            this.parser.setLanguage(langConfig.parser);
            const tree = this.parser.parse(code);

            if (!tree.rootNode) {
                console.warn(`[ASTSplitter] ⚠️  Failed to parse AST for ${language}, falling back to LangChain: ${filePath || 'unknown'}`);
                return await this.langchainFallback.split(code, language, filePath);
            }

            // Extract chunks based on AST nodes
            const chunks = this.extractChunks(tree.rootNode, code, langConfig.nodeTypes, language, filePath);

            // If chunks are too large, split them further
            const refinedChunks = await this.refineChunks(chunks, code);

            return refinedChunks;
        } catch (error) {
            console.warn(`[ASTSplitter] ⚠️  AST splitter failed for ${language}, falling back to LangChain: ${error}`);
            return await this.langchainFallback.split(code, language, filePath);
        }
    }

    setChunkSize(chunkSize: number): void {
        this.chunkSize = chunkSize;
        this.langchainFallback.setChunkSize(chunkSize);
    }

    setChunkOverlap(chunkOverlap: number): void {
        this.chunkOverlap = chunkOverlap;
        this.langchainFallback.setChunkOverlap(chunkOverlap);
    }

    private getLanguageConfig(language: string): { parser: any; nodeTypes: string[] } | null {
        const langMap: Record<string, { parser: any; nodeTypes: string[] }> = {
            'javascript': { parser: JavaScript, nodeTypes: SPLITTABLE_NODE_TYPES.javascript },
            'js': { parser: JavaScript, nodeTypes: SPLITTABLE_NODE_TYPES.javascript },
            'typescript': { parser: TypeScript, nodeTypes: SPLITTABLE_NODE_TYPES.typescript },
            'ts': { parser: TypeScript, nodeTypes: SPLITTABLE_NODE_TYPES.typescript },
            'python': { parser: Python, nodeTypes: SPLITTABLE_NODE_TYPES.python },
            'py': { parser: Python, nodeTypes: SPLITTABLE_NODE_TYPES.python },
            'java': { parser: Java, nodeTypes: SPLITTABLE_NODE_TYPES.java },
            'cpp': { parser: Cpp, nodeTypes: SPLITTABLE_NODE_TYPES.cpp },
            'c++': { parser: Cpp, nodeTypes: SPLITTABLE_NODE_TYPES.cpp },
            'c': { parser: Cpp, nodeTypes: SPLITTABLE_NODE_TYPES.cpp },
            'go': { parser: Go, nodeTypes: SPLITTABLE_NODE_TYPES.go },
            'rust': { parser: Rust, nodeTypes: SPLITTABLE_NODE_TYPES.rust },
            'rs': { parser: Rust, nodeTypes: SPLITTABLE_NODE_TYPES.rust },
            'cs': { parser: CSharp, nodeTypes: SPLITTABLE_NODE_TYPES.csharp },
            'csharp': { parser: CSharp, nodeTypes: SPLITTABLE_NODE_TYPES.csharp },
            'scala': { parser: Scala, nodeTypes: SPLITTABLE_NODE_TYPES.scala }
        };

        return langMap[language.toLowerCase()] || null;
    }

    private extractChunks(
        node: Parser.SyntaxNode,
        code: string,
        splittableTypes: string[],
        language: string,
        filePath?: string
    ): CodeChunk[] {
        const chunks: CodeChunk[] = [];
        const codeLines = code.split('\n');

        const traverse = (currentNode: Parser.SyntaxNode) => {
            // Check if this node type should be split into a chunk
            if (splittableTypes.includes(currentNode.type)) {
                const startLine = currentNode.startPosition.row + 1;
                const endLine = currentNode.endPosition.row + 1;
                const nodeText = code.slice(currentNode.startIndex, currentNode.endIndex);

                // Only create chunk if it has meaningful content
                if (nodeText.trim().length > 0) {
                    const chunkTitle = this.getChunkTitle(nodeText, filePath);
                    const symbol = this.extractSymbolMetadata(currentNode, language, code);
                    
                    chunks.push({
                        content: nodeText,
                        metadata: {
                            startLine,
                            endLine,
                            language,
                            filePath,
                            chunkTitle,
                            symbol: symbol || undefined
                        }
                    });
                }
            }

            // Continue traversing child nodes
            for (const child of currentNode.children) {
                traverse(child);
            }
        };

        traverse(node);

        // If no meaningful chunks found, create a single chunk with the entire code
        if (chunks.length === 0) {
            const chunkTitle = this.getChunkTitle(code, filePath);
            chunks.push({
                content: code,
                metadata: {
                    startLine: 1,
                    endLine: codeLines.length,
                    language,
                    filePath,
                    chunkTitle
                }
            });
        }

        return chunks;
    }

    private async refineChunks(chunks: CodeChunk[], originalCode: string): Promise<CodeChunk[]> {
        const refinedChunks: CodeChunk[] = [];

        for (const chunk of chunks) {
            if (chunk.content.length <= this.chunkSize) {
                refinedChunks.push(chunk);
            } else {
                // Split large chunks using character-based splitting
                const subChunks = this.splitLargeChunk(chunk, originalCode);
                refinedChunks.push(...subChunks);
            }
        }

        return this.addOverlap(refinedChunks);
    }

    private splitLargeChunk(chunk: CodeChunk, originalCode: string): CodeChunk[] {
        const lines = chunk.content.split('\n');
        const subChunks: CodeChunk[] = [];
        let currentChunk = '';
        let currentStartLine = chunk.metadata.startLine;
        let currentLineCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineWithNewline = i === lines.length - 1 ? line : line + '\n';

            if (currentChunk.length + lineWithNewline.length > this.chunkSize && currentChunk.length > 0) {
                // Create a sub-chunk
                const content = currentChunk.trim();
                if (content.length > 0) {
                    subChunks.push({
                        content,
                        metadata: {
                            startLine: currentStartLine,
                            endLine: currentStartLine + currentLineCount - 1,
                            language: chunk.metadata.language,
                            filePath: chunk.metadata.filePath,
                            chunkTitle: this.getChunkTitle(content, chunk.metadata.filePath)
                        }
                    });
                }

                currentChunk = lineWithNewline;
                currentStartLine = chunk.metadata.startLine + i;
                currentLineCount = 1;
            } else {
                currentChunk += lineWithNewline;
                currentLineCount++;
            }
        }

        // Add the last sub-chunk
        if (currentChunk.trim().length > 0) {
            const content = currentChunk.trim();
            subChunks.push({
                content,
                metadata: {
                    startLine: currentStartLine,
                    endLine: currentStartLine + currentLineCount - 1,
                    language: chunk.metadata.language,
                    filePath: chunk.metadata.filePath,
                    chunkTitle: this.getChunkTitle(content, chunk.metadata.filePath)
                }
            });
        }

        return subChunks;
    }

    private addOverlap(chunks: CodeChunk[]): CodeChunk[] {
        if (chunks.length <= 1 || this.chunkOverlap <= 0) {
            return chunks;
        }

        const overlappedChunks: CodeChunk[] = [];

        for (let i = 0; i < chunks.length; i++) {
            let content = chunks[i].content;
            const metadata = { ...chunks[i].metadata };

            // Add overlap from previous chunk
            if (i > 0 && this.chunkOverlap > 0) {
                const prevChunk = chunks[i - 1];
                const overlapText = prevChunk.content.slice(-this.chunkOverlap);
                content = overlapText + '\n' + content;
                metadata.startLine = Math.max(1, metadata.startLine - this.getLineCount(overlapText));
            }

            metadata.chunkTitle = metadata.chunkTitle || this.getChunkTitle(content, metadata.filePath);

            overlappedChunks.push({
                content,
                metadata
            });
        }

        return overlappedChunks;
    }

    private getLineCount(text: string): number {
        return text.split('\n').length;
    }

    /**
     * Check if AST splitting is supported for the given language
     */
    static isLanguageSupported(language: string): boolean {
        const supportedLanguages = [
            'javascript', 'js', 'typescript', 'ts', 'python', 'py',
            'java', 'cpp', 'c++', 'c', 'go', 'rust', 'rs', 'cs', 'csharp', 'scala'
        ];
        return supportedLanguages.includes(language.toLowerCase());
    }

    /**
     * Extract symbol metadata from AST node
     */
    private extractSymbolMetadata(node: Parser.SyntaxNode, language: string, code: string): SymbolMetadata | null {
        const enableSymbolExtraction = process.env.ENABLE_SYMBOL_EXTRACTION !== 'false';
        if (!enableSymbolExtraction) {
            return null;
        }

        try {
            const name = this.getSymbolName(node, language);
            const kind = this.getSymbolKind(node.type);
            
            if (!name || !kind) {
                return null;
            }

            const signature = this.getSymbolSignature(node, language, code);
            const parent = this.getParentSymbol(node);
            const docstring = this.extractDocstring(node, code);

            return {
                name,
                kind,
                signature,
                parent,
                docstring
            };
        } catch (error) {
            console.warn(`[ASTSplitter] Failed to extract symbol metadata:`, error);
            return null;
        }
    }

    /**
     * Get symbol name from node
     */
    private getSymbolName(node: Parser.SyntaxNode, language: string): string | null {
        const extractor = SYMBOL_EXTRACTORS[language.toLowerCase()];
        if (!extractor) {
            return null;
        }

        // Find the identifier child node
        for (const child of node.children) {
            if (child.type === extractor.nameNode || child.type === 'identifier') {
                return child.text;
            }
            
            // For some nodes, the name might be nested
            for (const grandchild of child.children) {
                if (grandchild.type === extractor.nameNode || grandchild.type === 'identifier') {
                    return grandchild.text;
                }
            }
        }

        return null;
    }

    /**
     * Map node type to semantic symbol kind
     */
    private getSymbolKind(nodeType: string): SymbolMetadata['kind'] | null {
        return NODE_TYPE_TO_KIND[nodeType] || null;
    }

    /**
     * Extract function/method signature
     */
    private getSymbolSignature(node: Parser.SyntaxNode, language: string, code: string): string | undefined {
        const extractor = SYMBOL_EXTRACTORS[language.toLowerCase()];
        if (!extractor) {
            return undefined;
        }

        // Find parameter node
        for (const child of node.children) {
            if (child.type === extractor.paramNode || 
                child.type === 'parameters' || 
                child.type === 'formal_parameters' ||
                child.type === 'parameter_list') {
                return child.text;
            }
        }

        return undefined;
    }

    /**
     * Get parent symbol name (class/module containing this symbol)
     */
    private getParentSymbol(node: Parser.SyntaxNode): string | undefined {
        let current = node.parent;
        
        while (current) {
            const parentType = current.type;
            
            // Check if parent is a class, interface, module, etc.
            if (parentType.includes('class') || 
                parentType.includes('interface') ||
                parentType.includes('module') ||
                parentType.includes('namespace') ||
                parentType === 'impl_item') {
                
                // Find the name of the parent
                for (const child of current.children) {
                    if (child.type === 'identifier' || child.type === 'type_identifier') {
                        return child.text;
                    }
                }
            }
            
            current = current.parent;
        }
        
        return undefined;
    }

    /**
     * Extract docstring or comment preceding the symbol
     */
    private extractDocstring(node: Parser.SyntaxNode, code: string): string | undefined {
        const startLine = node.startPosition.row;
        const lines = code.split('\n');
        
        // Look at lines immediately before the node
        const lookbackLines = Math.min(5, startLine);
        const precedingLines: string[] = [];
        
        for (let i = startLine - 1; i >= startLine - lookbackLines && i >= 0; i--) {
            const line = lines[i].trim();
            
            // Check for comment patterns
            if (line.startsWith('//') || 
                line.startsWith('#') || 
                line.startsWith('/*') || 
                line.includes('*/') ||
                line.startsWith('*') ||
                line.startsWith('"""') ||
                line.startsWith("'''")) {
                precedingLines.unshift(line);
            } else if (line.length > 0 && precedingLines.length > 0) {
                // Stop if we hit non-comment content after finding comments
                break;
            }
        }
        
        if (precedingLines.length === 0) {
            return undefined;
        }
        
        // Clean up comment markers and join
        const docstring = precedingLines
            .map(line => {
                return line
                    .replace(/^\/\/\s?/, '')
                    .replace(/^#\s?/, '')
                    .replace(/^\/\*+\s?/, '')
                    .replace(/\s?\*+\/$/, '')
                    .replace(/^\*\s?/, '')
                    .replace(/^"""\s?/, '')
                    .replace(/^'''\s?/, '')
                    .trim();
            })
            .filter(line => line.length > 0)
            .join(' ');
        
        // Limit docstring length
        return docstring.length > 200 ? docstring.substring(0, 197) + '...' : docstring;
    }

    private getChunkTitle(content: string, filePath?: string): string | undefined {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;

            // Skip import/export lines when possible to surface meaningful symbol lines
            if (/^(import\s|export\s|#include\s)/i.test(trimmed)) {
                continue;
            }

            return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
        }

        if (filePath) {
            const fileName = filePath.split(/[\\/]/).pop();
            return fileName ? `Section from ${fileName}` : undefined;
        }

        return undefined;
    }
}
