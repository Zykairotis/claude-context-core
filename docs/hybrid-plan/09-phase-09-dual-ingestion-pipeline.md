# Phase 9: Dual Ingestion Pipeline

## 🎯 Objective
Build a unified ingestion pipeline that can process data for both Claude-Context and Cognee simultaneously, maximizing efficiency and preventing duplicate processing.

## 🏗️ Pipeline Architecture

### Unified Ingestion Orchestrator
```typescript
import { Pipeline, Stage } from './pipeline-core';
import { Queue } from 'bull';

export class DualIngestionPipeline {
    private claudePipeline: Pipeline;
    private cogneePipeline: Pipeline;
    private unifiedQueue: Queue;
    
    constructor() {
        this.unifiedQueue = new Queue('unified-ingestion', {
            redis: {
                host: 'localhost',
                port: 6379
            },
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 1000,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            }
        });
        
        this.setupPipelines();
        this.setupQueueProcessors();
    }
    
    private setupPipelines() {
        // Claude-Context pipeline stages
        this.claudePipeline = new Pipeline([
            new Stage('fetch', this.fetchContent),
            new Stage('parse', this.parseForClaude),
            new Stage('chunk_ast', this.chunkWithAST),
            new Stage('embed_dense', this.generateDenseEmbeddings),
            new Stage('embed_sparse', this.generateSparseEmbeddings),
            new Stage('store_vectors', this.storeToQdrant)
        ]);
        
        // Cognee pipeline stages
        this.cogneePipeline = new Pipeline([
            new Stage('fetch', this.fetchContent),  // Shared
            new Stage('parse', this.parseForCognee),
            new Stage('chunk_semantic', this.chunkSemantically),
            new Stage('summarize', this.generateSummaries),
            new Stage('extract_entities', this.extractEntities),
            new Stage('build_graph', this.buildKnowledgeGraph),
            new Stage('cognify', this.cognifyContent)
        ]);
    }
    
    async ingestDual(request: IngestionRequest): Promise<IngestionResult> {
        // Add to unified queue
        const job = await this.unifiedQueue.add('ingest', {
            id: uuidv4(),
            request,
            timestamp: new Date(),
            targets: request.targets || ['claude', 'cognee']
        });
        
        // Wait for completion
        const result = await job.finished();
        return result;
    }
    
    private async processUnifiedIngestion(job: Job) {
        const { request, targets } = job.data;
        const results = {
            claude: null,
            cognee: null,
            unified: null
        };
        
        try {
            // Fetch content once
            const content = await this.fetchContent(request);
            
            // Process in parallel for each target
            const promises = [];
            
            if (targets.includes('claude')) {
                promises.push(
                    this.processClaudeIngestion(content, request)
                        .then(r => results.claude = r)
                );
            }
            
            if (targets.includes('cognee')) {
                promises.push(
                    this.processCogneeIngestion(content, request)
                        .then(r => results.cognee = r)
                );
            }
            
            await Promise.all(promises);
            
            // Merge results
            results.unified = await this.mergeResults(results);
            
            // Store unified metadata
            await this.storeUnifiedMetadata(results.unified);
            
            return results;
            
        } catch (error) {
            await this.handleIngestionError(error, job);
            throw error;
        }
    }
}
```

## 🔄 Content Processing Stages

### Shared Processing Functions
```python
from typing import Any, Dict, List, Optional
import asyncio
from dataclasses import dataclass

@dataclass
class ProcessingContext:
    """Shared context across pipeline stages."""
    content: str
    source_type: str
    metadata: Dict[str, Any]
    claude_artifacts: Optional[Dict] = None
    cognee_artifacts: Optional[Dict] = None
    shared_cache: Optional[Dict] = None

class SharedProcessors:
    """Processors that can be reused by both pipelines."""
    
    @staticmethod
    async def fetch_content(source: str, source_type: str) -> ProcessingContext:
        """Fetch content from various sources."""
        
        fetchers = {
            'github': GitHubFetcher(),
            'web': WebFetcher(),
            'file': FileFetcher(),
            'api': APIFetcher()
        }
        
        fetcher = fetchers.get(source_type)
        if not fetcher:
            raise ValueError(f"Unknown source type: {source_type}")
        
        content = await fetcher.fetch(source)
        
        return ProcessingContext(
            content=content.text,
            source_type=source_type,
            metadata={
                'source': source,
                'fetched_at': datetime.now(),
                'content_type': content.content_type,
                'size_bytes': len(content.text)
            },
            shared_cache={}
        )
    
    @staticmethod
    async def detect_language(context: ProcessingContext) -> str:
        """Detect programming language or content type."""
        
        # Check cache first
        if 'language' in context.shared_cache:
            return context.shared_cache['language']
        
        # Use tree-sitter for code detection
        if context.source_type in ['github', 'file']:
            language = detect_programming_language(context.content)
        else:
            language = 'text'
        
        # Cache result
        context.shared_cache['language'] = language
        return language
    
    @staticmethod
    async def extract_structure(context: ProcessingContext) -> Dict:
        """Extract structural information usable by both systems."""
        
        structure = {
            'headings': [],
            'code_blocks': [],
            'links': [],
            'sections': []
        }
        
        if context.source_type == 'web':
            # Extract HTML structure
            structure['headings'] = extract_headings(context.content)
            structure['links'] = extract_links(context.content)
        
        elif context.shared_cache.get('language') != 'text':
            # Extract code structure
            ast = parse_ast(context.content, context.shared_cache['language'])
            structure['functions'] = extract_functions(ast)
            structure['classes'] = extract_classes(ast)
            structure['imports'] = extract_imports(ast)
        
        context.shared_cache['structure'] = structure
        return structure
```

### Intelligent Chunking Strategy
```typescript
export class IntelligentChunker {
    private astChunker: ASTChunker;
    private semanticChunker: SemanticChunker;
    private hybridChunker: HybridChunker;
    
    async chunkForBothSystems(
        content: string,
        context: ProcessingContext
    ): Promise<DualChunkResult> {
        
        const result: DualChunkResult = {
            claude_chunks: [],
            cognee_chunks: [],
            shared_chunks: [],
            chunk_mapping: new Map()
        };
        
        // Determine chunking strategy
        const strategy = this.determineStrategy(context);
        
        if (strategy === 'code') {
            // Use AST chunking (better for Claude-Context)
            const astChunks = await this.astChunker.chunk(content, {
                language: context.language,
                maxSize: 1000,
                overlap: 100
            });
            
            // These work well for both systems
            result.shared_chunks = astChunks;
            result.claude_chunks = astChunks;
            
            // Cognee might want different boundaries
            result.cognee_chunks = await this.semanticChunker.rechunk(
                astChunks,
                { targetSize: 512 }
            );
            
        } else if (strategy === 'document') {
            // Use semantic chunking (better for Cognee)
            const semanticChunks = await this.semanticChunker.chunk(content, {
                maxSize: 512,
                overlap: 50,
                breakpoints: context.structure?.headings
            });
            
            result.cognee_chunks = semanticChunks;
            
            // Claude might want larger chunks
            result.claude_chunks = await this.mergeChunks(
                semanticChunks,
                { targetSize: 1000 }
            );
            
            // Create mapping
            this.createChunkMapping(
                result.claude_chunks,
                result.cognee_chunks,
                result.chunk_mapping
            );
        }
        
        return result;
    }
    
    private createChunkMapping(
        claudeChunks: Chunk[],
        cogneeChunks: Chunk[],
        mapping: Map<string, string[]>
    ) {
        // Map which Cognee chunks correspond to each Claude chunk
        for (const claudeChunk of claudeChunks) {
            const overlapping = cogneeChunks.filter(cogneeChunk =>
                this.chunksOverlap(claudeChunk, cogneeChunk)
            );
            
            mapping.set(
                claudeChunk.id,
                overlapping.map(c => c.id)
            );
        }
    }
}
```

## 🚀 Parallel Processing

### Dual Embedding Generation
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class DualEmbeddingProcessor:
    """Generate embeddings for both systems efficiently."""
    
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.claude_embedder = ClaudeEmbedder()  # GTE/CodeRank
        self.cognee_embedder = CogneeEmbedder()  # Cognee models
    
    async def generate_all_embeddings(
        self,
        chunks: List[UniversalChunk]
    ) -> Dict[str, List[float]]:
        """Generate all required embeddings in parallel."""
        
        tasks = []
        
        # Group chunks by type for efficient batching
        text_chunks = [c for c in chunks if c.chunk_type == 'text']
        code_chunks = [c for c in chunks if c.chunk_type == 'code']
        
        # Claude-Context embeddings
        if text_chunks:
            tasks.append(self.generate_gte_embeddings(text_chunks))
        if code_chunks:
            tasks.append(self.generate_coderank_embeddings(code_chunks))
        
        # Cognee embeddings (all chunks)
        tasks.append(self.generate_cognee_embeddings(chunks))
        
        # SPLADE sparse embeddings
        tasks.append(self.generate_splade_embeddings(chunks))
        
        # Execute all in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Merge results
        embeddings = {}
        for chunk in chunks:
            chunk_embeddings = {
                'dense_gte': None,
                'dense_coderank': None,
                'dense_cognee': None,
                'sparse_splade': None
            }
            
            # Map results to chunks
            if chunk.chunk_type == 'text':
                chunk_embeddings['dense_gte'] = results[0].get(chunk.id)
            else:
                chunk_embeddings['dense_coderank'] = results[1].get(chunk.id)
            
            chunk_embeddings['dense_cognee'] = results[2].get(chunk.id)
            chunk_embeddings['sparse_splade'] = results[3].get(chunk.id)
            
            embeddings[chunk.id] = chunk_embeddings
        
        return embeddings
```

## 📊 Ingestion Monitoring

### Pipeline Metrics Dashboard
```typescript
export class IngestionMetrics {
    private metrics = {
        ingestion_rate: new Rate(),
        processing_time: new Histogram(),
        error_rate: new Counter(),
        duplicate_detection: new Counter(),
        storage_saved: new Gauge()
    };
    
    async recordIngestion(result: IngestionResult) {
        // Record metrics
        this.metrics.ingestion_rate.mark();
        
        this.metrics.processing_time.update(
            result.processing_time_ms
        );
        
        if (result.duplicates_found > 0) {
            this.metrics.duplicate_detection.inc(result.duplicates_found);
            
            // Calculate storage saved
            const saved_bytes = result.duplicates_found * result.avg_chunk_size;
            this.metrics.storage_saved.set(saved_bytes);
        }
    }
    
    getDashboardData(): DashboardData {
        return {
            current_rate: this.metrics.ingestion_rate.meanRate(),
            avg_processing_time: this.metrics.processing_time.mean(),
            error_percentage: this.calculateErrorRate(),
            storage_efficiency: this.calculateStorageEfficiency(),
            duplicate_percentage: this.calculateDuplicateRate()
        };
    }
}
```

## 🔄 Deduplication Strategy

### Content-Based Deduplication
```python
import hashlib
from typing import Set, Dict

class ContentDeduplicator:
    """Prevent duplicate ingestion across both systems."""
    
    def __init__(self):
        self.content_hashes: Set[str] = set()
        self.chunk_hashes: Dict[str, str] = {}
        
    async def check_duplicate(self, content: str) -> bool:
        """Check if content already exists."""
        
        content_hash = self.hash_content(content)
        
        # Check in-memory cache
        if content_hash in self.content_hashes:
            return True
        
        # Check database
        exists = await self.check_database(content_hash)
        if exists:
            self.content_hashes.add(content_hash)
            return True
        
        return False
    
    def hash_content(self, content: str) -> str:
        """Generate stable hash for content."""
        
        # Normalize content
        normalized = content.strip().lower()
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Generate hash
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    async def check_database(self, content_hash: str) -> bool:
        """Check if hash exists in database."""
        
        result = await db.execute("""
            SELECT EXISTS(
                SELECT 1 FROM unified.chunks
                WHERE metadata->>'content_hash' = $1
            )
        """, content_hash)
        
        return result[0]['exists']
    
    async def deduplicate_chunks(
        self,
        chunks: List[UniversalChunk]
    ) -> List[UniversalChunk]:
        """Remove duplicate chunks."""
        
        unique_chunks = []
        
        for chunk in chunks:
            chunk_hash = self.hash_content(chunk.content)
            
            if chunk_hash not in self.chunk_hashes:
                self.chunk_hashes[chunk_hash] = chunk.id
                unique_chunks.append(chunk)
            else:
                # Log duplicate
                logger.info(f"Duplicate chunk found: {chunk.id} == {self.chunk_hashes[chunk_hash]}")
        
        return unique_chunks
```

## 🎯 Success Metrics

- Ingestion throughput: > 1000 chunks/minute
- Deduplication rate: > 95%
- Processing efficiency: 40% reduction vs separate pipelines
- Error rate: < 0.1%
- Storage savings: 30-40% through deduplication

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-8  
**Output**: Unified dual ingestion pipeline with deduplication
