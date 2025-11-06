/**
 * Helper functions for working with dataset collections
 */

import { Pool } from 'pg';

/**
 * Get collection names for a specific project and/or dataset
 * Uses the dataset_collections table to find relevant collections
 * 
 * @param pool PostgreSQL connection pool
 * @param projectId Optional project UUID to filter by
 * @param datasetId Optional dataset UUID to filter by
 * @returns Array of collection names
 */
export async function getProjectCollections(
    pool: Pool,
    projectId?: string,
    datasetId?: string
): Promise<string[]> {
    try {
        // Build query based on filters
        if (datasetId) {
            // Single dataset - most specific
            const result = await pool.query(
                `SELECT dc.collection_name 
                 FROM claude_context.dataset_collections dc
                 WHERE dc.dataset_id = $1`,
                [datasetId]
            );
            return result.rows.map(r => r.collection_name);
        } else if (projectId) {
            // All datasets in a project
            const result = await pool.query(
                `SELECT dc.collection_name
                 FROM claude_context.dataset_collections dc
                 JOIN claude_context.datasets d ON dc.dataset_id = d.id
                 WHERE d.project_id = $1`,
                [projectId]
            );
            return result.rows.map(r => r.collection_name);
        } else {
            // No filters - return all collections (fallback for backward compatibility)
            const result = await pool.query(
                `SELECT collection_name 
                 FROM claude_context.dataset_collections`
            );
            return result.rows.map(r => r.collection_name);
        }
    } catch (error: any) {
        // If dataset_collections table doesn't exist, return empty array
        if (error?.code === '42P01') {
            console.warn('[getProjectCollections] dataset_collections table not found, returning empty array');
            return [];
        }
        
        console.error('[getProjectCollections] Error querying collections:', error);
        throw error;
    }
}

/**
 * Get or create a collection record for a dataset
 * 
 * @param pool PostgreSQL connection pool
 * @param datasetId Dataset UUID
 * @param collectionName Collection name
 * @param vectorDbType Type of vector database ('qdrant' or 'postgres')
 * @param dimension Vector dimension (default 768)
 * @param isHybrid Whether the collection uses hybrid search
 * @returns Collection record ID
 */
export async function getOrCreateCollectionRecord(
    pool: Pool,
    datasetId: string,
    collectionName: string,
    vectorDbType: string = 'qdrant',
    dimension: number = 768,
    isHybrid: boolean = true
): Promise<string> {
    try {
        const result = await pool.query(
            `INSERT INTO claude_context.dataset_collections 
             (dataset_id, collection_name, vector_db_type, dimension, is_hybrid)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (dataset_id) DO UPDATE
             SET collection_name = EXCLUDED.collection_name,
                 updated_at = NOW()
             RETURNING id`,
            [datasetId, collectionName, vectorDbType, dimension, isHybrid]
        );
        
        return result.rows[0].id;
    } catch (error) {
        console.error('[getOrCreateCollectionRecord] Error creating collection record:', error);
        throw error;
    }
}

/**
 * Update collection metadata (point count, last indexed time)
 * 
 * @param pool PostgreSQL connection pool
 * @param collectionName Collection name
 * @param pointCount Number of points/chunks in collection
 */
export async function updateCollectionMetadata(
    pool: Pool,
    collectionName: string,
    pointCount?: number
): Promise<void> {
    try {
        const updates: string[] = ['last_indexed_at = NOW()', 'updated_at = NOW()'];
        const params: any[] = [collectionName];
        
        if (pointCount !== undefined) {
            updates.push(`point_count = $${params.length + 1}`);
            params.push(pointCount);
            updates.push(`last_point_count_sync = NOW()`);
        }
        
        await pool.query(
            `UPDATE claude_context.dataset_collections 
             SET ${updates.join(', ')}
             WHERE collection_name = $1`,
            params
        );
    } catch (error) {
        console.error('[updateCollectionMetadata] Error updating collection metadata:', error);
        // Non-fatal - don't throw
    }
}

/**
 * Get collection info for a dataset
 * 
 * @param pool PostgreSQL connection pool
 * @param datasetId Dataset UUID
 * @returns Collection info or null if not found
 */
export async function getCollectionForDataset(
    pool: Pool,
    datasetId: string
): Promise<{ 
    id: string;
    collectionName: string;
    vectorDbType: string;
    dimension: number;
    isHybrid: boolean;
    pointCount: number;
} | null> {
    try {
        const result = await pool.query(
            `SELECT id, collection_name, vector_db_type, dimension, is_hybrid, point_count
             FROM claude_context.dataset_collections
             WHERE dataset_id = $1`,
            [datasetId]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        return {
            id: row.id,
            collectionName: row.collection_name,
            vectorDbType: row.vector_db_type,
            dimension: row.dimension,
            isHybrid: row.is_hybrid,
            pointCount: row.point_count || 0
        };
    } catch (error: any) {
        if (error?.code === '42P01') {
            console.warn('[getCollectionForDataset] dataset_collections table not found');
            return null;
        }
        
        console.error('[getCollectionForDataset] Error getting collection info:', error);
        throw error;
    }
}
