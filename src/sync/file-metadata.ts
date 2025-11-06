/**
 * File metadata CRUD operations for incremental sync
 */

import { Pool } from 'pg';

export interface FileMetadata {
    projectId: string;
    datasetId: string;
    filePath: string;
    relativePath: string;
    sha256Hash: string;
    fileSize: number;
    chunkCount: number;
    language?: string;
    metadata?: any;
}

/**
 * Record new file metadata
 */
export async function recordFileMetadata(
    pool: Pool,
    metadata: FileMetadata
): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO claude_context.indexed_files 
             (project_id, dataset_id, file_path, relative_path, sha256_hash, 
              file_size, chunk_count, language, metadata, last_indexed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (project_id, dataset_id, file_path) 
             DO UPDATE SET 
                sha256_hash = EXCLUDED.sha256_hash,
                file_size = EXCLUDED.file_size,
                chunk_count = EXCLUDED.chunk_count,
                language = EXCLUDED.language,
                metadata = EXCLUDED.metadata,
                last_indexed_at = NOW(),
                updated_at = NOW()`,
            [
                metadata.projectId,
                metadata.datasetId,
                metadata.filePath,
                metadata.relativePath,
                metadata.sha256Hash,
                metadata.fileSize,
                metadata.chunkCount,
                metadata.language,
                JSON.stringify(metadata.metadata || {})
            ]
        );
    } finally {
        client.release();
    }
}

/**
 * Update existing file metadata
 */
export async function updateFileMetadata(
    pool: Pool,
    metadata: FileMetadata
): Promise<void> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `UPDATE claude_context.indexed_files 
             SET sha256_hash = $1, 
                 file_size = $2, 
                 chunk_count = $3,
                 language = $4,
                 metadata = $5,
                 last_indexed_at = NOW(),
                 updated_at = NOW()
             WHERE project_id = $6 
               AND dataset_id = $7 
               AND file_path = $8`,
            [
                metadata.sha256Hash,
                metadata.fileSize,
                metadata.chunkCount,
                metadata.language,
                JSON.stringify(metadata.metadata || {}),
                metadata.projectId,
                metadata.datasetId,
                metadata.filePath
            ]
        );
        
        if (result.rowCount === 0) {
            // If update didn't find the record, insert it
            await recordFileMetadata(pool, metadata);
        }
    } finally {
        client.release();
    }
}

/**
 * Remove file metadata
 */
export async function removeFileMetadata(
    pool: Pool,
    projectId: string,
    datasetId: string,
    filePath: string
): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(
            `DELETE FROM claude_context.indexed_files 
             WHERE project_id = $1 
               AND dataset_id = $2 
               AND file_path = $3`,
            [projectId, datasetId, filePath]
        );
    } finally {
        client.release();
    }
}

/**
 * Update file path (for renames)
 */
export async function updateFilePath(
    pool: Pool,
    projectId: string,
    datasetId: string,
    oldPath: string,
    newPath: string,
    newRelativePath: string
): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE claude_context.indexed_files 
             SET file_path = $1,
                 relative_path = $2,
                 updated_at = NOW()
             WHERE project_id = $3 
               AND dataset_id = $4 
               AND file_path = $5`,
            [newPath, newRelativePath, projectId, datasetId, oldPath]
        );
    } finally {
        client.release();
    }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
    pool: Pool,
    projectId: string,
    datasetId: string,
    filePath: string
): Promise<FileMetadata | null> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM claude_context.indexed_files 
             WHERE project_id = $1 
               AND dataset_id = $2 
               AND file_path = $3`,
            [projectId, datasetId, filePath]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        return {
            projectId: row.project_id,
            datasetId: row.dataset_id,
            filePath: row.file_path,
            relativePath: row.relative_path,
            sha256Hash: row.sha256_hash,
            fileSize: row.file_size,
            chunkCount: row.chunk_count,
            language: row.language,
            metadata: row.metadata
        };
    } finally {
        client.release();
    }
}

/**
 * Get all file metadata for a dataset
 */
export async function getAllFileMetadata(
    pool: Pool,
    projectId: string,
    datasetId: string
): Promise<FileMetadata[]> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM claude_context.indexed_files 
             WHERE project_id = $1 
               AND dataset_id = $2
             ORDER BY file_path`,
            [projectId, datasetId]
        );
        
        return result.rows.map(row => ({
            projectId: row.project_id,
            datasetId: row.dataset_id,
            filePath: row.file_path,
            relativePath: row.relative_path,
            sha256Hash: row.sha256_hash,
            fileSize: row.file_size,
            chunkCount: row.chunk_count,
            language: row.language,
            metadata: row.metadata
        }));
    } finally {
        client.release();
    }
}

/**
 * Clear all file metadata for a dataset
 */
export async function clearDatasetMetadata(
    pool: Pool,
    projectId: string,
    datasetId: string
): Promise<number> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `DELETE FROM claude_context.indexed_files 
             WHERE project_id = $1 
               AND dataset_id = $2`,
            [projectId, datasetId]
        );
        
        return result.rowCount || 0;
    } finally {
        client.release();
    }
}

/**
 * Get statistics for a dataset
 */
export async function getDatasetStats(
    pool: Pool,
    projectId: string,
    datasetId: string
): Promise<{
    totalFiles: number;
    totalSize: number;
    totalChunks: number;
    languages: Record<string, number>;
}> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                COUNT(*) as total_files,
                COALESCE(SUM(file_size), 0) as total_size,
                COALESCE(SUM(chunk_count), 0) as total_chunks
             FROM claude_context.indexed_files 
             WHERE project_id = $1 
               AND dataset_id = $2`,
            [projectId, datasetId]
        );
        
        const languageResult = await client.query(
            `SELECT 
                language,
                COUNT(*) as count
             FROM claude_context.indexed_files 
             WHERE project_id = $1 
               AND dataset_id = $2
               AND language IS NOT NULL
             GROUP BY language
             ORDER BY count DESC`,
            [projectId, datasetId]
        );
        
        const languages: Record<string, number> = {};
        for (const row of languageResult.rows) {
            languages[row.language] = parseInt(row.count);
        }
        
        const stats = result.rows[0];
        return {
            totalFiles: parseInt(stats.total_files),
            totalSize: parseInt(stats.total_size),
            totalChunks: parseInt(stats.total_chunks),
            languages
        };
    } finally {
        client.release();
    }
}
