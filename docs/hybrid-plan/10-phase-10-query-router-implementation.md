# Phase 10: Query Router Implementation

## 🎯 Objective
Implement an intelligent query routing system that automatically directs queries to the most appropriate backend (Claude-Context for fast search, Cognee for knowledge graphs, or hybrid for complex queries).

## 🏗️ Query Router Architecture

### Intelligent Query Analyzer
```typescript
import { NLPAnalyzer } from './nlp';
import { QueryClassifier } from './ml-classifier';

export enum QueryIntent {
    FAST_SEARCH = 'fast_search',        // Simple vector similarity
    CODE_SEARCH = 'code_search',        // Code-specific search
    GRAPH_TRAVERSAL = 'graph',          // Relationship queries
    ENTITY_LOOKUP = 'entity',           // Entity-based queries
    AGGREGATION = 'aggregation',        // Statistical queries
    HYBRID = 'hybrid'                    // Complex multi-hop
}

export class QueryRouter {
    private classifier: QueryClassifier;
    private nlpAnalyzer: NLPAnalyzer;
    private routingRules: RoutingRule[];
    
    constructor() {
        this.classifier = new QueryClassifier({
            modelPath: './models/query_classifier.onnx'
        });
        
        this.setupRoutingRules();
    }
    
    async route(query: string, context?: QueryContext): Promise<RoutingDecision> {
        // Step 1: Analyze query intent
        const intent = await this.analyzeIntent(query);
        
        // Step 2: Extract query features
        const features = await this.extractFeatures(query);
        
        // Step 3: Apply routing rules
        const route = this.determineRoute(intent, features, context);
        
        // Step 4: Optimize query for target system
        const optimizedQuery = await this.optimizeQuery(query, route);
        
        return {
            query: optimizedQuery,
            route,
            intent,
            features,
            confidence: features.confidence,
            fallback: this.getFallbackRoute(route)
        };
    }
    
    private async analyzeIntent(query: string): Promise<QueryIntent> {
        // Use ML classifier for intent detection
        const prediction = await this.classifier.predict(query);
        
        // Override with keyword detection for high confidence
        if (this.hasGraphKeywords(query)) {
            return QueryIntent.GRAPH_TRAVERSAL;
        }
        
        if (this.hasCodeKeywords(query)) {
            return QueryIntent.CODE_SEARCH;
        }
        
        return prediction.intent;
    }
    
    private hasGraphKeywords(query: string): boolean {
        const graphKeywords = [
            'relationship', 'connected', 'related to', 'path between',
            'depends on', 'references', 'calls', 'imports',
            'knowledge graph', 'entity', 'network'
        ];
        
        const lowerQuery = query.toLowerCase();
        return graphKeywords.some(keyword => lowerQuery.includes(keyword));
    }
    
    private determineRoute(
        intent: QueryIntent,
        features: QueryFeatures,
        context?: QueryContext
    ): RouteTarget {
        
        // Fast path routing
        if (intent === QueryIntent.FAST_SEARCH || 
            intent === QueryIntent.CODE_SEARCH) {
            return {
                primary: 'claude-context',
                secondary: null,
                strategy: 'single'
            };
        }
        
        // Graph path routing
        if (intent === QueryIntent.GRAPH_TRAVERSAL ||
            intent === QueryIntent.ENTITY_LOOKUP) {
            return {
                primary: 'cognee',
                secondary: 'neo4j',
                strategy: 'graph-first'
            };
        }
        
        // Hybrid routing for complex queries
        if (intent === QueryIntent.HYBRID ||
            features.complexity > 0.7) {
            return {
                primary: 'claude-context',
                secondary: 'cognee',
                strategy: 'parallel-merge'
            };
        }
        
        // Default to fast search
        return {
            primary: 'claude-context',
            secondary: null,
            strategy: 'single'
        };
    }
}
```

## 🔍 Query Execution Strategies

### Strategy Pattern Implementation
```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any
import asyncio

class QueryStrategy(ABC):
    """Base class for query execution strategies."""
    
    @abstractmethod
    async def execute(self, query: str, params: Dict) -> Any:
        pass

class FastSearchStrategy(QueryStrategy):
    """Direct vector similarity search via Claude-Context."""
    
    async def execute(self, query: str, params: Dict) -> List[SearchResult]:
        # Generate embedding
        embedding = await self.embed_query(query)
        
        # Search in Qdrant
        results = await self.qdrant_client.search(
            collection_name="unified_chunks",
            query_vector=embedding,
            limit=params.get('limit', 10),
            query_filter={
                "must": [
                    {"key": "system_origin", "match": {"any": ["claude", "hybrid"]}}
                ]
            }
        )
        
        # Enhance with metadata
        return self.enhance_results(results)

class GraphTraversalStrategy(QueryStrategy):
    """Knowledge graph traversal via Neo4j."""
    
    async def execute(self, query: str, params: Dict) -> GraphResult:
        # Extract entities from query
        entities = await self.extract_entities(query)
        
        # Build Cypher query
        cypher = self.build_cypher_query(entities, params)
        
        # Execute on Neo4j
        async with self.neo4j_driver.session() as session:
            result = await session.run(cypher, entities=entities)
            graph = await self.process_graph_result(result)
        
        return GraphResult(
            nodes=graph['nodes'],
            edges=graph['edges'],
            paths=graph['paths']
        )

class HybridStrategy(QueryStrategy):
    """Parallel execution with result fusion."""
    
    async def execute(self, query: str, params: Dict) -> HybridResult:
        # Execute in parallel
        fast_task = asyncio.create_task(
            self.fast_search.execute(query, params)
        )
        
        graph_task = asyncio.create_task(
            self.graph_search.execute(query, params)
        )
        
        cognee_task = asyncio.create_task(
            self.cognee_search.execute(query, params)
        )
        
        # Wait for all
        fast_results, graph_results, cognee_results = await asyncio.gather(
            fast_task, graph_task, cognee_task,
            return_exceptions=True
        )
        
        # Fusion strategy
        fused = await self.fuse_results(
            fast_results,
            graph_results,
            cognee_results
        )
        
        return HybridResult(
            chunks=fused['chunks'],
            graph=fused['graph'],
            insights=fused['insights'],
            confidence=fused['confidence']
        )
    
    async def fuse_results(self, fast, graph, cognee):
        """Intelligent result fusion with reranking."""
        
        # Collect all unique chunks
        all_chunks = {}
        
        # Add fast search results
        for result in fast or []:
            all_chunks[result.id] = {
                'chunk': result,
                'scores': {'vector': result.score}
            }
        
        # Enhance with graph connections
        if graph:
            for node in graph.nodes:
                if node.chunk_id in all_chunks:
                    all_chunks[node.chunk_id]['scores']['graph'] = node.centrality
                    all_chunks[node.chunk_id]['relationships'] = node.relationships
        
        # Add Cognee insights
        if cognee:
            for insight in cognee:
                if insight.chunk_id in all_chunks:
                    all_chunks[insight.chunk_id]['scores']['cognitive'] = insight.relevance
                    all_chunks[insight.chunk_id]['summary'] = insight.summary
        
        # Rerank using combined scores
        ranked = self.rerank_results(all_chunks)
        
        return {
            'chunks': ranked[:10],
            'graph': graph,
            'insights': self.extract_insights(ranked),
            'confidence': self.calculate_confidence(all_chunks)
        }
```

## 🎯 Query Optimization

### Query Rewriting Engine
```typescript
export class QueryOptimizer {
    private synonymDB: SynonymDatabase;
    private queryExpander: QueryExpander;
    
    async optimizeForTarget(
        query: string,
        target: string
    ): Promise<OptimizedQuery> {
        
        let optimized = query;
        
        switch(target) {
            case 'claude-context':
                optimized = await this.optimizeForVectorSearch(query);
                break;
                
            case 'neo4j':
                optimized = await this.optimizeForGraphSearch(query);
                break;
                
            case 'cognee':
                optimized = await this.optimizeForCognitiveSearch(query);
                break;
        }
        
        return {
            original: query,
            optimized,
            expansions: await this.generateExpansions(query),
            filters: this.extractFilters(query),
            boosts: this.calculateBoosts(query)
        };
    }
    
    private async optimizeForVectorSearch(query: string): Promise<string> {
        // Remove stop words for better embedding
        let optimized = this.removeStopWords(query);
        
        // Expand technical terms
        optimized = await this.expandTechnicalTerms(optimized);
        
        // Add context hints
        if (this.isCodeQuery(query)) {
            optimized = `code function ${optimized}`;
        }
        
        return optimized;
    }
    
    private async optimizeForGraphSearch(query: string): Promise<string> {
        // Extract entities
        const entities = await this.extractEntities(query);
        
        // Build relationship hints
        const relationships = this.inferRelationships(query);
        
        // Format for Cypher generation
        return this.formatForCypher(entities, relationships);
    }
}
```

## 📊 Result Aggregation

### Multi-Source Result Merger
```python
class ResultAggregator:
    """Aggregate and merge results from multiple sources."""
    
    def __init__(self):
        self.reranker = CrossEncoderReranker()
        self.deduplicator = ResultDeduplicator()
        
    async def aggregate_results(
        self,
        results: Dict[str, List[Any]],
        query: str,
        strategy: str = 'weighted'
    ) -> AggregatedResult:
        """Aggregate results from multiple sources."""
        
        # Deduplicate across sources
        unique_results = self.deduplicator.deduplicate(results)
        
        # Apply aggregation strategy
        if strategy == 'weighted':
            aggregated = await self.weighted_aggregation(unique_results, query)
        elif strategy == 'voting':
            aggregated = await self.voting_aggregation(unique_results)
        elif strategy == 'cascade':
            aggregated = await self.cascade_aggregation(unique_results)
        else:
            aggregated = unique_results
        
        # Rerank if needed
        if len(aggregated) > 10:
            aggregated = await self.reranker.rerank(query, aggregated)
        
        # Add metadata
        return self.enrich_with_metadata(aggregated)
    
    async def weighted_aggregation(
        self,
        results: Dict[str, List],
        query: str
    ) -> List[AggregatedItem]:
        """Weight results based on source reliability."""
        
        weights = {
            'claude-context': 1.0,   # Highest for fast search
            'cognee': 0.9,          # High for cognitive
            'neo4j': 0.85,          # Good for relationships
            'hybrid': 1.1           # Bonus for cross-validation
        }
        
        aggregated = []
        
        for source, items in results.items():
            weight = weights.get(source, 1.0)
            
            for item in items:
                # Calculate weighted score
                item.weighted_score = item.score * weight
                item.source = source
                aggregated.append(item)
        
        # Sort by weighted score
        aggregated.sort(key=lambda x: x.weighted_score, reverse=True)
        
        return aggregated
```

## 🔄 Fallback Mechanisms

### Graceful Degradation
```typescript
export class QueryFallbackHandler {
    private fallbackChain = [
        'claude-context',  // Fastest, most reliable
        'qdrant-direct',   // Direct vector search
        'postgres-fts',    // PostgreSQL full-text search
        'cache'           // Last resort: cached results
    ];
    
    async executeWithFallback(
        query: string,
        primaryTarget: string
    ): Promise<any> {
        
        let lastError = null;
        
        // Try primary target
        try {
            return await this.execute(primaryTarget, query);
        } catch (error) {
            console.error(`Primary target ${primaryTarget} failed:`, error);
            lastError = error;
        }
        
        // Try fallback chain
        for (const fallback of this.fallbackChain) {
            if (fallback === primaryTarget) continue;
            
            try {
                console.log(`Falling back to ${fallback}`);
                const result = await this.execute(fallback, query);
                
                // Mark as fallback result
                result.metadata = {
                    ...result.metadata,
                    fallback: true,
                    fallback_reason: lastError?.message,
                    fallback_source: fallback
                };
                
                return result;
                
            } catch (error) {
                console.error(`Fallback ${fallback} failed:`, error);
                lastError = error;
            }
        }
        
        // All fallbacks failed
        throw new Error(`All query targets failed. Last error: ${lastError?.message}`);
    }
}
```

## 📈 Query Performance Tracking

### Analytics and Optimization
```python
class QueryPerformanceTracker:
    """Track and optimize query performance."""
    
    def __init__(self):
        self.metrics_db = MetricsDatabase()
        self.optimizer = QueryOptimizer()
        
    async def track_query(self, query: str, result: QueryResult):
        """Track query execution metrics."""
        
        metrics = {
            'query': query,
            'intent': result.intent,
            'route': result.route,
            'latency_ms': result.execution_time,
            'result_count': len(result.items),
            'relevance_score': result.relevance_score,
            'user_satisfaction': None,  # To be filled by feedback
            'timestamp': datetime.now()
        }
        
        # Store metrics
        await self.metrics_db.store(metrics)
        
        # Analyze for optimization opportunities
        if metrics['latency_ms'] > 1000:
            await self.analyze_slow_query(query, metrics)
        
    async def analyze_slow_query(self, query: str, metrics: dict):
        """Analyze why a query was slow."""
        
        analysis = {
            'query': query,
            'bottlenecks': []
        }
        
        # Check if better route exists
        alternative_route = await self.optimizer.suggest_route(query)
        if alternative_route != metrics['route']:
            analysis['bottlenecks'].append({
                'type': 'suboptimal_routing',
                'suggestion': alternative_route
            })
        
        # Check if query can be optimized
        optimized_query = await self.optimizer.optimize(query)
        if optimized_query != query:
            analysis['bottlenecks'].append({
                'type': 'query_optimization',
                'suggestion': optimized_query
            })
        
        # Store analysis
        await self.metrics_db.store_analysis(analysis)
```

## 🎯 Success Metrics

- Query routing accuracy: > 95%
- Average latency: < 100ms for fast path, < 500ms for graph
- Fallback success rate: > 99.9%
- Cache hit rate: > 30%
- User satisfaction: > 4.5/5

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-9  
**Output**: Intelligent query routing system with fallback mechanisms
