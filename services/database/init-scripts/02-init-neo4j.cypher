// Cognee Neo4j Knowledge Graph Initialization Script
// This script sets up constraints, indexes, and the initial graph schema

// ============================================
// Constraints for Entity Nodes
// ============================================

// Ensure entity IDs are unique
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (e:Entity) REQUIRE e.id IS UNIQUE;

// Ensure document IDs are unique
CREATE CONSTRAINT document_id_unique IF NOT EXISTS
FOR (d:Document) REQUIRE d.id IS UNIQUE;

// Ensure chunk IDs are unique
CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS
FOR (c:Chunk) REQUIRE c.id IS UNIQUE;

// Ensure dataset IDs are unique
CREATE CONSTRAINT dataset_id_unique IF NOT EXISTS
FOR (ds:Dataset) REQUIRE ds.id IS UNIQUE;

// ============================================
// Indexes for Performance Optimization
// ============================================

// Index on entity names for text search
CREATE INDEX entity_name_idx IF NOT EXISTS
FOR (e:Entity) ON (e.name);

// Index on entity types for filtering
CREATE INDEX entity_type_idx IF NOT EXISTS
FOR (e:Entity) ON (e.type);

// Index on document source paths
CREATE INDEX document_source_idx IF NOT EXISTS
FOR (d:Document) ON (d.source_path);

// Index on chunk content (for graph-based text search)
CREATE INDEX chunk_content_idx IF NOT EXISTS
FOR (c:Chunk) ON (c.content);

// Index on timestamps for temporal queries
CREATE INDEX entity_created_at_idx IF NOT EXISTS
FOR (e:Entity) ON (e.created_at);

CREATE INDEX document_created_at_idx IF NOT EXISTS
FOR (d:Document) ON (d.created_at);

// Composite index for entity type and name (for common queries)
CREATE INDEX entity_type_name_idx IF NOT EXISTS
FOR (e:Entity) ON (e.type, e.name);

// ============================================
// Full-Text Search Indexes
// ============================================

// Full-text index on entity names and descriptions
CREATE FULLTEXT INDEX entity_fulltext IF NOT EXISTS
FOR (e:Entity) ON EACH [e.name, e.description];

// Full-text index on chunk content
CREATE FULLTEXT INDEX chunk_fulltext IF NOT EXISTS
FOR (c:Chunk) ON EACH [c.content];

// Full-text index on document metadata
CREATE FULLTEXT INDEX document_fulltext IF NOT EXISTS
FOR (d:Document) ON EACH [d.source_path, d.content_type];

// ============================================
// Relationship Indexes
// ============================================

// These help with traversal performance
// Note: Neo4j automatically indexes relationship types, but we can add property indexes

// Index for relationship weights (if used for scoring)
// CREATE INDEX rel_weight_idx IF NOT EXISTS FOR ()-[r:RELATES_TO]-() ON (r.weight);

// Index for relationship timestamps
// CREATE INDEX rel_created_at_idx IF NOT EXISTS FOR ()-[r:RELATES_TO]-() ON (r.created_at);

// ============================================
// Initial System Node
// ============================================

// Create a system metadata node to track graph schema version
MERGE (sys:SystemMetadata {id: 'cognee_graph_schema'})
ON CREATE SET 
    sys.version = '1.0.0',
    sys.initialized_at = datetime(),
    sys.description = 'Cognee Knowledge Graph Schema'
ON MATCH SET
    sys.last_checked = datetime();

// ============================================
// Sample Entity Type Definitions (for reference)
// ============================================

// These are not constraints, just documentation of expected entity types:
// - Person: Individuals mentioned in documents
// - Organization: Companies, institutions, groups
// - Concept: Abstract concepts, topics, themes
// - Location: Places, addresses, geographic entities
// - Technology: Programming languages, frameworks, tools
// - CodeElement: Functions, classes, modules from code
// - Document: Source documents
// - Chunk: Text chunks from documents
// - Dataset: Collections of documents

// ============================================
// Sample Relationship Types (for reference)
// ============================================

// Common relationship types:
// - RELATES_TO: Generic relationship between entities
// - MENTIONS: Document/Chunk mentions an Entity
// - CONTAINS: Hierarchical containment (e.g., Document CONTAINS Chunk)
// - SIMILAR_TO: Semantic similarity between entities
// - PART_OF: Entity is part of another entity
// - DEPENDS_ON: Dependency relationship (e.g., in code)
// - CALLS: Function call relationship
// - IMPLEMENTS: Implementation relationship
// - EXTENDS: Inheritance relationship

// ============================================
// Query Performance Hints
// ============================================

// For optimal query performance:
// 1. Always use labels in MATCH clauses: MATCH (e:Entity) instead of MATCH (e)
// 2. Use indexed properties in WHERE clauses
// 3. Use EXPLAIN/PROFILE to analyze query plans
// 4. Consider using APOC procedures for complex operations
// 5. Use relationship direction when known for better performance

// ============================================
// APOC Configuration Check
// ============================================

// Verify APOC is available (will fail gracefully if not)
CALL dbms.procedures() YIELD name
WHERE name STARTS WITH 'apoc.'
RETURN count(name) as apoc_procedures_available;

// ============================================
// Completion Message
// ============================================

// Return confirmation
RETURN 'Cognee Neo4j graph schema initialized successfully' AS status,
       'Version 1.0.0' AS schema_version,
       datetime() AS initialized_at;
