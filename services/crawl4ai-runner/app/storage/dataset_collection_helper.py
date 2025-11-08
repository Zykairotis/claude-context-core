"""
Helper functions for managing dataset_collections table.

This module provides Python equivalents of the TypeScript collection-helpers
to ensure crawl operations create the same dataset_collections mappings that
code indexing creates.
"""

import logging
from typing import Optional
from uuid import UUID

LOGGER = logging.getLogger(__name__)


async def create_or_update_collection_record(
    pool,
    dataset_id: str,
    collection_name: str,
    vector_db_type: str = 'qdrant',
    dimension: int = 768,
    is_hybrid: bool = True
) -> str:
    """
    Create or update a collection record in dataset_collections table.
    
    This function ensures that the MCP tools (like listDatasets) can find
    the collection mapping and show correct vector counts.
    
    Args:
        pool: PostgreSQL connection pool (asyncpg)
        dataset_id: UUID of the dataset
        collection_name: Name of the Qdrant collection
        vector_db_type: Type of vector database ('qdrant' or 'postgres')
        dimension: Vector dimension (default 768)
        is_hybrid: Whether collection uses hybrid search (dense + sparse)
        
    Returns:
        Collection record UUID as string
        
    Raises:
        Exception if database operation fails
    """
    try:
        # Use INSERT ... ON CONFLICT to handle both create and update cases
        result = await pool.fetchrow(
            """
            INSERT INTO claude_context.dataset_collections 
                (dataset_id, collection_name, vector_db_type, dimension, is_hybrid, point_count)
            VALUES ($1, $2, $3, $4, $5, 0)
            ON CONFLICT (dataset_id) DO UPDATE
            SET collection_name = EXCLUDED.collection_name,
                vector_db_type = EXCLUDED.vector_db_type,
                dimension = EXCLUDED.dimension,
                is_hybrid = EXCLUDED.is_hybrid,
                updated_at = NOW()
            RETURNING id, (xmax = 0) AS inserted
            """,
            UUID(dataset_id),
            collection_name,
            vector_db_type,
            dimension,
            is_hybrid
        )
        
        record_id = str(result['id'])
        action = 'Created' if result['inserted'] else 'Updated'
        
        LOGGER.info(
            f"[dataset_collection_helper] ✅ {action} collection record for dataset {dataset_id} → {collection_name}"
        )
        
        return record_id
        
    except Exception as error:
        LOGGER.error(
            f"[dataset_collection_helper] ❌ Error creating collection record: {error}",
            exc_info=True
        )
        LOGGER.error(
            f"[dataset_collection_helper] Dataset: {dataset_id}, Collection: {collection_name}"
        )
        raise


async def update_collection_point_count(
    pool,
    collection_name: str,
    point_count: int
) -> None:
    """
    Update the point count for a collection.
    
    This should be called after chunks are successfully stored in Qdrant
    to keep the metadata in sync.
    
    Args:
        pool: PostgreSQL connection pool (asyncpg)
        collection_name: Name of the collection
        point_count: Number of points/vectors in the collection
    """
    try:
        await pool.execute(
            """
            UPDATE claude_context.dataset_collections
            SET point_count = $1,
                last_indexed_at = NOW(),
                last_point_count_sync = NOW(),
                updated_at = NOW()
            WHERE collection_name = $2
            """,
            point_count,
            collection_name
        )
        
        LOGGER.info(
            f"[dataset_collection_helper] ✅ Updated point count for {collection_name}: {point_count}"
        )
        
    except Exception as error:
        LOGGER.error(
            f"[dataset_collection_helper] ❌ Error updating point count: {error}",
            exc_info=True
        )
        # Don't raise - this is non-critical metadata update
