# Phase 8: Metadata Mapping Layer

## 🎯 Objective
Create a comprehensive metadata mapping layer that translates between Claude-Context and Cognee metadata formats while preserving system-specific information.

## 🏗️ Metadata Architecture

### Universal Metadata Schema
```typescript
// Comprehensive metadata interface
interface UniversalMetadata {
    // Core identifiers
    identifiers: {
        universal_id: string;        // UUID v4
        claude_id?: string;          // Legacy Claude ID
        cognee_id?: string;          // Cognee data point ID
        external_id?: string;        // External system ID
    };
    
    // Provenance tracking
    provenance: {
        origin_system: 'claude' | 'cognee' | 'hybrid';
        created_by: string;          // User/system that created
        created_at: Date;
        modified_by: string;
        modified_at: Date;
        version: number;             // Version counter
        parent_id?: string;          // For derived chunks
    };
    
    // Processing metadata
    processing: {
        chunking: {
            method: 'ast' | 'character' | 'semantic' | 'llm';
            chunk_size: number;
            overlap: number;
            splitter_version: string;
        };
        embedding: {
            models: {
                dense?: { model: string; version: string; timestamp: Date; };
                sparse?: { model: string; version: string; timestamp: Date; };
            };
            processing_time_ms: number;
        };
        summarization?: {
            model: string;
            prompt_template: string;
            timestamp: Date;
        };
        entity_extraction?: {
            model: string;
            entities_found: number;
            confidence_threshold: number;
            timestamp: Date;
        };
    };
    
    // Quality metrics
    quality: {
        confidence_score: number;    // 0-1
        validation_status: 'pending' | 'validated' | 'failed';
        validation_errors?: string[];
        quality_checks: {
            content_length: boolean;
            embedding_quality: boolean;
            entity_coverage: boolean;
        };
        human_review?: {
            reviewed: boolean;
            reviewer: string;
            timestamp: Date;
            notes?: string;
        };
    };
    
    // Access control
    access: {
        visibility: 'public' | 'private' | 'team' | 'restricted';
        owner: string;
        team_id?: string;
        permissions: {
            read: string[];          // User/role IDs
            write: string[];
            delete: string[];
        };
        tags?: string[];             // For filtering
        categories?: string[];       // Classification
    };
    
    // Custom metadata
    custom: {
        [key: string]: any;          // System-specific fields
    };
}
```

## 🔄 Metadata Mappers

### Claude to Universal Mapper
```typescript
export class ClaudeMetadataMapper {
    mapToUniversal(claudeMetadata: any, chunk: any): UniversalMetadata {
        return {
            identifiers: {
                universal_id: chunk.id,
                claude_id: chunk.legacy_id || chunk.id,
                external_id: claudeMetadata.external_id
            },
            
            provenance: {
                origin_system: 'claude',
                created_by: claudeMetadata.created_by || 'claude-context',
                created_at: new Date(chunk.created_at),
                modified_by: claudeMetadata.modified_by || 'system',
                modified_at: new Date(chunk.updated_at || chunk.created_at),
                version: claudeMetadata.version || 1,
                parent_id: claudeMetadata.parent_chunk_id
            },
            
            processing: {
                chunking: {
                    method: chunk.chunking_method || 'ast',
                    chunk_size: chunk.chunk_size || 1000,
                    overlap: chunk.chunk_overlap || 100,
                    splitter_version: '1.0.0'
                },
                embedding: {
                    models: {
                        dense: chunk.embedding_model ? {
                            model: chunk.embedding_model,
                            version: '1.0',
                            timestamp: new Date(chunk.indexed_at)
                        } : undefined
                    },
                    processing_time_ms: claudeMetadata.processing_time || 0
                }
            },
            
            quality: {
                confidence_score: chunk.confidence || 1.0,
                validation_status: 'validated',
                quality_checks: {
                    content_length: chunk.content?.length > 0,
                    embedding_quality: chunk.vector?.length === 768,
                    entity_coverage: false
                }
            },
            
            access: {
                visibility: 'team',
                owner: chunk.project_id,
                permissions: {
                    read: ['*'],
                    write: [chunk.project_id],
                    delete: [chunk.project_id]
                },
                tags: claudeMetadata.tags || []
            },
            
            custom: {
                claude_specific: {
                    scope: chunk.scope,
                    symbol_extraction: claudeMetadata.symbols,
                    ast_features: claudeMetadata.ast_features
                }
            }
        };
    }
    
    mapFromUniversal(universal: UniversalMetadata): any {
        return {
            id: universal.identifiers.claude_id || universal.identifiers.universal_id,
            created_by: universal.provenance.created_by,
            created_at: universal.provenance.created_at.toISOString(),
            version: universal.provenance.version,
            processing_time: universal.processing.embedding?.processing_time_ms,
            confidence: universal.quality.confidence_score,
            tags: universal.access.tags,
            ...universal.custom.claude_specific
        };
    }
}
```

### Cognee to Universal Mapper
```python
class CogneeMetadataMapper:
    """Map between Cognee and Universal metadata formats."""
    
    def map_to_universal(self, cognee_metadata: dict, data_point: Any) -> dict:
        """Convert Cognee metadata to universal format."""
        
        return {
            "identifiers": {
                "universal_id": str(data_point.id),
                "cognee_id": str(data_point.id),
                "external_id": cognee_metadata.get("external_ref")
            },
            
            "provenance": {
                "origin_system": "cognee",
                "created_by": cognee_metadata.get("user_id", "cognee"),
                "created_at": data_point.created_at.isoformat(),
                "modified_by": cognee_metadata.get("last_modified_by", "system"),
                "modified_at": data_point.updated_at.isoformat(),
                "version": cognee_metadata.get("version", 1)
            },
            
            "processing": {
                "chunking": {
                    "method": "semantic",
                    "chunk_size": cognee_metadata.get("chunk_size", 512),
                    "overlap": cognee_metadata.get("overlap", 50),
                    "splitter_version": "cognee-1.0"
                },
                "summarization": {
                    "model": cognee_metadata.get("summary_model", "gpt-4"),
                    "prompt_template": cognee_metadata.get("prompt_template"),
                    "timestamp": data_point.summarized_at.isoformat()
                } if hasattr(data_point, 'summarized_at') else None,
                "entity_extraction": {
                    "model": "cognee-ner",
                    "entities_found": len(data_point.entities) if hasattr(data_point, 'entities') else 0,
                    "confidence_threshold": 0.7,
                    "timestamp": data_point.cognified_at.isoformat()
                } if hasattr(data_point, 'cognified_at') else None
            },
            
            "quality": {
                "confidence_score": cognee_metadata.get("confidence", 0.9),
                "validation_status": "validated" if data_point.is_validated else "pending",
                "quality_checks": {
                    "content_length": len(data_point.text) > 0,
                    "embedding_quality": data_point.embedding is not None,
                    "entity_coverage": hasattr(data_point, 'entities')
                }
            },
            
            "access": {
                "visibility": cognee_metadata.get("visibility", "private"),
                "owner": str(data_point.user_id),
                "permissions": {
                    "read": cognee_metadata.get("read_permissions", ["owner"]),
                    "write": cognee_metadata.get("write_permissions", ["owner"]),
                    "delete": ["owner"]
                }
            },
            
            "custom": {
                "cognee_specific": {
                    "dataset_id": str(data_point.dataset_id),
                    "knowledge_graph_id": cognee_metadata.get("graph_id"),
                    "cognitive_layer": cognee_metadata.get("cognitive_layer")
                }
            }
        }
```

## 🔐 Metadata Validation

### Schema Validation
```python
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List, Any

class MetadataValidator(BaseModel):
    """Validate metadata against schema."""
    
    identifiers: Dict[str, Optional[str]]
    provenance: Dict[str, Any]
    processing: Dict[str, Any]
    quality: Dict[str, Any]
    access: Dict[str, Any]
    custom: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    @validator('identifiers')
    def validate_identifiers(cls, v):
        if not v.get('universal_id'):
            raise ValueError('universal_id is required')
        return v
    
    @validator('provenance')
    def validate_provenance(cls, v):
        required = ['origin_system', 'created_at', 'version']
        for field in required:
            if field not in v:
                raise ValueError(f'{field} is required in provenance')
        
        if v['origin_system'] not in ['claude', 'cognee', 'hybrid']:
            raise ValueError('Invalid origin_system')
        
        return v
    
    @validator('quality')
    def validate_quality(cls, v):
        if 'confidence_score' in v:
            score = v['confidence_score']
            if not 0 <= score <= 1:
                raise ValueError('confidence_score must be between 0 and 1')
        return v
    
    class Config:
        extra = 'forbid'  # No extra fields allowed
```

## 📊 Metadata Aggregation

### Cross-System Metadata Merger
```typescript
export class MetadataAggregator {
    /**
     * Merge metadata from multiple sources
     */
    async mergeMetadata(
        sources: { system: string; metadata: UniversalMetadata }[]
    ): Promise<UniversalMetadata> {
        
        // Start with base metadata
        const merged: UniversalMetadata = this.createBaseMetadata();
        
        // Merge identifiers
        merged.identifiers = this.mergeIdentifiers(sources);
        
        // Merge provenance (keep earliest created, latest modified)
        merged.provenance = this.mergeProvenance(sources);
        
        // Merge processing info (union of all)
        merged.processing = this.mergeProcessingInfo(sources);
        
        // Quality score (weighted average)
        merged.quality = this.mergeQualityMetrics(sources);
        
        // Access control (most restrictive)
        merged.access = this.mergeAccessControl(sources);
        
        // Custom fields (namespace by system)
        merged.custom = this.mergeCustomFields(sources);
        
        return merged;
    }
    
    private mergeIdentifiers(sources: any[]): any {
        const identifiers: any = {
            universal_id: null
        };
        
        for (const source of sources) {
            const meta = source.metadata;
            
            // Use first universal_id found
            if (!identifiers.universal_id && meta.identifiers.universal_id) {
                identifiers.universal_id = meta.identifiers.universal_id;
            }
            
            // Collect system-specific IDs
            if (source.system === 'claude' && meta.identifiers.claude_id) {
                identifiers.claude_id = meta.identifiers.claude_id;
            }
            if (source.system === 'cognee' && meta.identifiers.cognee_id) {
                identifiers.cognee_id = meta.identifiers.cognee_id;
            }
        }
        
        return identifiers;
    }
    
    private mergeQualityMetrics(sources: any[]): any {
        let totalScore = 0;
        let totalWeight = 0;
        const checks: any = {};
        
        for (const source of sources) {
            const quality = source.metadata.quality;
            const weight = this.getSystemWeight(source.system);
            
            totalScore += quality.confidence_score * weight;
            totalWeight += weight;
            
            // Merge quality checks (AND logic)
            Object.assign(checks, quality.quality_checks);
        }
        
        return {
            confidence_score: totalScore / totalWeight,
            validation_status: 'validated',
            quality_checks: checks
        };
    }
    
    private getSystemWeight(system: string): number {
        // Weight different systems based on reliability
        const weights = {
            'claude': 1.0,
            'cognee': 0.9,
            'hybrid': 1.1
        };
        return weights[system] || 1.0;
    }
}
```

## 🔍 Metadata Querying

### Advanced Metadata Search
```sql
-- Create metadata search functions
CREATE OR REPLACE FUNCTION search_by_metadata(
    filters JSONB,
    limit_count INT DEFAULT 10
)
RETURNS TABLE(chunk_id UUID, metadata JSONB, score FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as chunk_id,
        c.metadata,
        -- Calculate relevance score
        (
            CASE WHEN c.metadata @> filters THEN 1.0 ELSE 0.0 END +
            CASE WHEN c.metadata->'quality'->>'confidence_score'::float > 0.8 THEN 0.2 ELSE 0.0 END +
            CASE WHEN c.metadata->'provenance'->>'origin_system' = 'hybrid' THEN 0.1 ELSE 0.0 END
        ) as score
    FROM unified.chunks c
    WHERE c.metadata @> filters  -- JSONB containment
    ORDER BY score DESC, c.created_at DESC
    LIMIT limit_count;
END;
$$;

-- Index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_gin 
ON unified.chunks USING GIN (metadata);

-- Index for specific metadata paths
CREATE INDEX IF NOT EXISTS idx_chunks_confidence 
ON unified.chunks ((metadata->'quality'->>'confidence_score'::float));
```

## 🎯 Success Metrics

- Metadata mapping accuracy: 100%
- Validation success rate: > 99%
- Query performance: p95 < 10ms
- Metadata completeness: > 95%
- Schema compatibility: 100%

---

**Status**: ⏳ Pending  
**Estimated Duration**: 4-5 days  
**Dependencies**: Phases 1-7  
**Output**: Complete metadata mapping and validation layer
