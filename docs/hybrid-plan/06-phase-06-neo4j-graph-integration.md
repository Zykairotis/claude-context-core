# Phase 6: Neo4j Graph Integration

## 🎯 Objective
Integrate Neo4j as the knowledge graph layer, linking chunks to entities and relationships while maintaining synchronization with vector stores.

## 🏗️ Neo4j Architecture

### Docker Setup
```yaml
# docker-compose.neo4j.yml
services:
  neo4j:
    image: neo4j:5.15-enterprise
    container_name: claude-context-neo4j
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      NEO4J_AUTH: neo4j/secure-graph-password
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
      NEO4J_dbms_memory_pagecache_size: 2G
      NEO4J_dbms_memory_heap_initial__size: 2G
      NEO4J_dbms_memory_heap_max__size: 4G
      NEO4J_apoc_export_file_enabled: true
      NEO4J_apoc_import_file_enabled: true
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins
    networks:
      - claude-context-network
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "secure-graph-password", "MATCH () RETURN count(*) LIMIT 1"]
      interval: 30s
      timeout: 10s
      retries: 5
```

### Graph Schema Design
```cypher
// Core node types
CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT dataset_id IF NOT EXISTS FOR (d:Dataset) REQUIRE d.id IS UNIQUE;

// Chunk nodes (linked to PostgreSQL/Qdrant)
CREATE (c:Chunk {
    id: 'uuid',
    content_hash: 'sha256_hash',
    chunk_type: 'code|text|mixed',
    source_type: 'github|web|file',
    created_at: datetime(),
    system_origin: 'claude|cognee|hybrid'
})

// Entity nodes (extracted via NER/LLM)
CREATE (e:Entity {
    id: 'uuid',
    name: 'entity_name',
    type: 'person|organization|location|concept|function|class',
    confidence: 0.95,
    first_seen: datetime(),
    last_seen: datetime()
})

// Project and Dataset nodes
CREATE (p:Project {
    id: 'uuid',
    name: 'project_name',
    created_at: datetime()
})

CREATE (d:Dataset {
    id: 'uuid',
    name: 'dataset_name',
    project_id: 'uuid',
    created_at: datetime()
})

// Relationships
CREATE (c:Chunk)-[:CONTAINS_ENTITY {
    confidence: 0.95,
    position: [100, 150],  // Character positions
    context: 'surrounding text'
}]->(e:Entity)

CREATE (c:Chunk)-[:BELONGS_TO]->(d:Dataset)
CREATE (d:Dataset)-[:PART_OF]->(p:Project)

CREATE (e1:Entity)-[:RELATES_TO {
    type: 'calls|imports|extends|references',
    confidence: 0.85,
    evidence: ['chunk_id1', 'chunk_id2']
}]->(e2:Entity)

CREATE (c1:Chunk)-[:SIMILAR_TO {
    similarity_score: 0.92,
    vector_type: 'dense|sparse'
}]->(c2:Chunk)

// Code-specific relationships
CREATE (f:Function)-[:CALLS {line_number: 42}]->(f2:Function)
CREATE (c:Class)-[:EXTENDS]->(parent:Class)
CREATE (m:Module)-[:IMPORTS]->(dep:Module)
```

## 🔄 Entity Extraction Pipeline

### LLM-Based Entity Extraction
```python
from neo4j import AsyncGraphDatabase
import asyncio
from typing import List, Dict
import hashlib

class EntityExtractor:
    """Extract entities and relationships from chunks."""
    
    def __init__(self, llm_client, neo4j_driver):
        self.llm = llm_client
        self.driver = neo4j_driver
        
    async def extract_and_link(self, chunk: UniversalChunk):
        """Extract entities and create graph relationships."""
        
        # Extract entities using LLM
        entities = await self.extract_entities(chunk)
        
        # Extract relationships
        relationships = await self.extract_relationships(chunk, entities)
        
        # Store in Neo4j
        async with self.driver.session() as session:
            # Create chunk node
            chunk_node_id = await session.execute_write(
                self._create_chunk_node, chunk
            )
            
            # Create entity nodes and relationships
            for entity in entities:
                entity_node_id = await session.execute_write(
                    self._create_or_update_entity, entity
                )
                
                # Link chunk to entity
                await session.execute_write(
                    self._link_chunk_to_entity,
                    chunk_node_id, entity_node_id, entity
                )
            
            # Create entity-to-entity relationships
            for rel in relationships:
                await session.execute_write(
                    self._create_entity_relationship, rel
                )
    
    async def extract_entities(self, chunk: UniversalChunk) -> List[Entity]:
        """Use LLM to extract entities from chunk."""
        
        prompt = f"""
        Extract all entities from the following text/code.
        Return as JSON array with: name, type, confidence, position.
        
        Types: person, organization, location, function, class, variable, concept
        
        Text:
        {chunk.content}
        """
        
        response = await self.llm.complete(prompt)
        entities = json.loads(response)
        
        return [Entity(**e) for e in entities]
    
    @staticmethod
    async def _create_chunk_node(tx, chunk):
        """Create or update chunk node in Neo4j."""
        query = """
        MERGE (c:Chunk {id: $id})
        SET c.content_hash = $content_hash,
            c.chunk_type = $chunk_type,
            c.source_type = $source_type,
            c.created_at = datetime($created_at),
            c.system_origin = $system_origin,
            c.updated_at = datetime()
        RETURN c.id
        """
        
        result = await tx.run(query,
            id=chunk.id,
            content_hash=hashlib.sha256(chunk.content.encode()).hexdigest(),
            chunk_type=chunk.chunk_type,
            source_type=chunk.source.type,
            created_at=chunk.metadata.created_at.isoformat(),
            system_origin=chunk.system_origin
        )
        
        record = await result.single()
        return record[0]
```

### Code-Aware Relationship Extraction
```typescript
export class CodeGraphBuilder {
    constructor(
        private neo4jDriver: Driver,
        private astAnalyzer: ASTAnalyzer
    ) {}
    
    async buildCodeGraph(chunk: CodeChunk): Promise<void> {
        // Parse AST
        const ast = await this.astAnalyzer.parse(chunk.content, chunk.language);
        
        // Extract code entities
        const functions = this.extractFunctions(ast);
        const classes = this.extractClasses(ast);
        const imports = this.extractImports(ast);
        
        // Create nodes and relationships
        const session = this.neo4jDriver.session();
        
        try {
            await session.executeWrite(async tx => {
                // Create function nodes
                for (const func of functions) {
                    await tx.run(`
                        MERGE (f:Function {name: $name, file: $file})
                        SET f.signature = $signature,
                            f.start_line = $start_line,
                            f.end_line = $end_line,
                            f.chunk_id = $chunk_id
                    `, {
                        name: func.name,
                        file: chunk.source.path,
                        signature: func.signature,
                        start_line: func.startLine,
                        end_line: func.endLine,
                        chunk_id: chunk.id
                    });
                }
                
                // Create call relationships
                for (const call of this.extractCalls(ast)) {
                    await tx.run(`
                        MATCH (caller:Function {name: $caller, file: $file})
                        MATCH (callee:Function {name: $callee})
                        MERGE (caller)-[:CALLS {line: $line}]->(callee)
                    `, {
                        caller: call.from,
                        callee: call.to,
                        file: chunk.source.path,
                        line: call.line
                    });
                }
            });
        } finally {
            await session.close();
        }
    }
}
```

## 🔍 Graph Queries

### Complex Graph Traversals
```cypher
-- Find all functions that eventually call a specific function
MATCH path = (f1:Function)-[:CALLS*]->(f2:Function {name: 'authenticate'})
RETURN f1.name, f1.file, length(path) as depth
ORDER BY depth
LIMIT 20

-- Find related chunks through shared entities
MATCH (c1:Chunk {id: $chunk_id})-[:CONTAINS_ENTITY]->(e:Entity)
      <-[:CONTAINS_ENTITY]-(c2:Chunk)
WHERE c1 <> c2
WITH c2, count(distinct e) as shared_entities
RETURN c2.id, shared_entities
ORDER BY shared_entities DESC
LIMIT 10

-- Knowledge graph for a concept
MATCH (e:Entity {name: $concept_name})
OPTIONAL MATCH (e)-[r1]-(related:Entity)
OPTIONAL MATCH (related)-[r2]-(secondary:Entity)
WHERE secondary <> e
RETURN e, r1, related, r2, secondary
LIMIT 100
```

### GraphQL API Layer
```typescript
import { gql } from 'apollo-server-express';
import { neo4jgraphql } from 'neo4j-graphql-js';

const typeDefs = gql`
    type Chunk {
        id: ID!
        content_hash: String
        chunk_type: String
        entities: [Entity] @relation(name: "CONTAINS_ENTITY", direction: OUT)
        similar_chunks: [Chunk] @relation(name: "SIMILAR_TO", direction: BOTH)
        dataset: Dataset @relation(name: "BELONGS_TO", direction: OUT)
    }
    
    type Entity {
        id: ID!
        name: String!
        type: String!
        confidence: Float
        chunks: [Chunk] @relation(name: "CONTAINS_ENTITY", direction: IN)
        related_entities: [Entity] @cypher(
            statement: """
            MATCH (this)-[:RELATES_TO]-(related:Entity)
            RETURN related
            """
        )
    }
    
    type Query {
        findRelatedChunks(chunkId: ID!, depth: Int = 2): [Chunk]
        @cypher(statement: """
            MATCH (c:Chunk {id: $chunkId})-[:CONTAINS_ENTITY]->(e:Entity)
                  <-[:CONTAINS_ENTITY*1..$depth]-(related:Chunk)
            WHERE related.id <> $chunkId
            RETURN DISTINCT related
        """)
        
        getKnowledgeGraph(entityName: String!): KnowledgeGraph
        @cypher(statement: """
            MATCH path = (e:Entity {name: $entityName})-[*1..3]-(connected)
            RETURN path
        """)
    }
`;

const resolvers = {
    Query: {
        findRelatedChunks: neo4jgraphql,
        getKnowledgeGraph: neo4jgraphql
    }
};
```

## 📊 Performance Optimization

### Index Strategy
```cypher
-- Composite indexes for common queries
CREATE INDEX chunk_source_type IF NOT EXISTS 
FOR (c:Chunk) ON (c.source_type, c.created_at);

CREATE INDEX entity_type_name IF NOT EXISTS 
FOR (e:Entity) ON (e.type, e.name);

-- Full-text search indexes
CREATE FULLTEXT INDEX chunk_content_search IF NOT EXISTS
FOR (c:Chunk) ON EACH [c.content_hash];

CREATE FULLTEXT INDEX entity_name_search IF NOT EXISTS
FOR (e:Entity) ON EACH [e.name];

-- Vector similarity index (requires GDS plugin)
CALL gds.graph.project(
  'chunk_similarity',
  'Chunk',
  {
    SIMILAR_TO: {
      properties: 'similarity_score'
    }
  }
);
```

### Query Optimization
```python
class Neo4jQueryOptimizer:
    """Optimize and cache graph queries."""
    
    def __init__(self):
        self.query_cache = {}
        self.query_plans = {}
        
    async def execute_optimized(self, query: str, params: dict):
        """Execute query with optimization."""
        
        # Get query plan
        plan = await self.get_query_plan(query)
        
        # Check if index hints needed
        if plan.needs_index_hint:
            query = self.add_index_hints(query, plan)
        
        # Check cache
        cache_key = self.get_cache_key(query, params)
        if cache_key in self.query_cache:
            return self.query_cache[cache_key]
        
        # Execute query
        result = await self.driver.execute(query, params)
        
        # Cache if appropriate
        if plan.is_cacheable:
            self.query_cache[cache_key] = result
            
        return result
    
    async def get_query_plan(self, query: str):
        """Analyze query execution plan."""
        explain_query = f"EXPLAIN {query}"
        plan = await self.driver.execute(explain_query)
        return self.parse_plan(plan)
```

## 🎯 Success Metrics

- Entity extraction accuracy: > 85%
- Graph traversal latency: p95 < 100ms
- Relationship discovery rate: > 70%
- Node creation throughput: > 1000/sec
- Query cache hit rate: > 60%

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-5  
**Output**: Fully integrated Neo4j knowledge graph layer
