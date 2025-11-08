/**
 * Check if a codebase is already indexed and what needs updating
 * Uses SHA-256 hash comparison to detect changes
 */

import { Pool } from 'pg';
import * as path from 'path';
import { detectChanges } from '../sync/change-detector';
import { getOrCreateProject, getOrCreateDataset } from '../utils/project-helpers';

export interface IndexCheckResult {
    isIndexed: boolean;
    isFullyIndexed: boolean;
    needsReindex: boolean;
    stats: {
        totalFiles: number;
        indexedFiles: number;
        unchangedFiles: number;
        newFiles: number;
        modifiedFiles: number;
        deletedFiles: number;
        percentIndexed: number;
    };
    recommendation: 'skip' | 'incremental' | 'full-reindex';
    message: string;
    details?: {
        newFiles?: string[];
        modifiedFiles?: string[];
        deletedFiles?: string[];
        unchangedFiles?: string[];
    };
}

/**
 * Check the indexing status of a codebase
 * @param pool PostgreSQL connection pool
 * @param codebasePath Path to the codebase
 * @param projectName Project name
 * @param datasetName Dataset name
 * @param includeDetails Whether to include file lists in response
 */
export async function checkIndexStatus(
    pool: Pool,
    codebasePath: string,
    projectName: string,
    datasetName: string,
    includeDetails: boolean = false
): Promise<IndexCheckResult> {
    const client = await pool.connect();
    
    try {
        // Get or create project and dataset IDs
        const project = await getOrCreateProject(client, projectName);
        const dataset = await getOrCreateDataset(client, project.id, datasetName);
        
        // Check if any files are indexed for this project/dataset
        const countResult = await client.query(
            `SELECT COUNT(*) as count 
             FROM claude_context.indexed_files 
             WHERE project_id = $1 AND dataset_id = $2`,
            [project.id, dataset.id]
        );
        
        const indexedCount = parseInt(countResult.rows[0].count);
        
        if (indexedCount === 0) {
            return {
                isIndexed: false,
                isFullyIndexed: false,
                needsReindex: false,
                stats: {
                    totalFiles: 0,
                    indexedFiles: 0,
                    unchangedFiles: 0,
                    newFiles: 0,
                    modifiedFiles: 0,
                    deletedFiles: 0,
                    percentIndexed: 0
                },
                recommendation: 'full-reindex',
                message: `Codebase has never been indexed. Run full indexing for project "${projectName}" dataset "${datasetName}".`
            };
        }
        
        // Detect changes between current files and indexed files
        const changes = await detectChanges(
            codebasePath,
            project.id,
            dataset.id,
            pool
        );
        
        const totalFiles = changes.stats.totalFiles;
        const unchangedFiles = changes.unchanged.length;
        const newFiles = changes.created.length;
        const modifiedFiles = changes.modified.length;
        const deletedFiles = changes.deleted.length;
        const changedFiles = newFiles + modifiedFiles + deletedFiles;
        
        // Calculate percentage indexed (unchanged files / total current files)
        const percentIndexed = totalFiles > 0 
            ? Math.round((unchangedFiles / totalFiles) * 100)
            : 0;
        
        // Determine recommendation
        let recommendation: 'skip' | 'incremental' | 'full-reindex';
        let message: string;
        
        if (changedFiles === 0) {
            recommendation = 'skip';
            message = `Codebase is fully indexed and up-to-date. No changes detected.`;
        } else if (percentIndexed >= 70 && changedFiles < 50) {
            // If most files are unchanged and few changes, do incremental
            recommendation = 'incremental';
            message = `Codebase is ${percentIndexed}% indexed. ${changedFiles} file(s) need updating (${newFiles} new, ${modifiedFiles} modified, ${deletedFiles} deleted).`;
        } else {
            // Too many changes, recommend full reindex
            recommendation = 'full-reindex';
            message = `Codebase has significant changes (${changedFiles} files). Recommend full reindex. Currently ${percentIndexed}% indexed.`;
        }
        
        const result: IndexCheckResult = {
            isIndexed: indexedCount > 0,
            isFullyIndexed: changedFiles === 0 && deletedFiles === 0,
            needsReindex: changedFiles > 0,
            stats: {
                totalFiles,
                indexedFiles: indexedCount,
                unchangedFiles,
                newFiles,
                modifiedFiles,
                deletedFiles,
                percentIndexed
            },
            recommendation,
            message
        };
        
        // Add details if requested
        if (includeDetails) {
            result.details = {
                newFiles: changes.created.slice(0, 10).map(f => f.relativePath),
                modifiedFiles: changes.modified.slice(0, 10).map(f => f.relativePath),
                deletedFiles: changes.deleted.slice(0, 10).map(f => f.relativePath),
                unchangedFiles: changes.unchanged.slice(0, 10).map(f => f.relativePath)
            };
            
            // Add note if lists are truncated
            if (changes.created.length > 10 || 
                changes.modified.length > 10 || 
                changes.deleted.length > 10) {
                result.message += ' (File lists truncated to first 10 items)';
            }
        }
        
        return result;
        
    } finally {
        client.release();
    }
}

/**
 * Quick check if project/dataset exists and has any indexed files
 */
export async function quickIndexCheck(
    pool: Pool,
    projectName: string,
    datasetName: string
): Promise<{ exists: boolean; fileCount: number; lastIndexed?: Date }> {
    const client = await pool.connect();
    
    try {
        const result = await client.query(
            `SELECT 
                COUNT(f.id) as file_count,
                MAX(f.last_indexed_at) as last_indexed
             FROM claude_context.projects p
             JOIN claude_context.datasets d ON d.project_id = p.id
             LEFT JOIN claude_context.indexed_files f ON f.project_id = p.id AND f.dataset_id = d.id
             WHERE p.name = $1 AND d.name = $2
             GROUP BY p.id, d.id`,
            [projectName, datasetName]
        );
        
        if (result.rows.length === 0) {
            return { exists: false, fileCount: 0 };
        }
        
        return {
            exists: true,
            fileCount: parseInt(result.rows[0].file_count),
            lastIndexed: result.rows[0].last_indexed
        };
        
    } finally {
        client.release();
    }
}

/**
 * Get detailed statistics about indexed files
 */
export async function getIndexedFilesStats(
    pool: Pool,
    projectName: string,
    datasetName: string
): Promise<{
    totalFiles: number;
    totalSize: number;
    totalChunks: number;
    languages: { [key: string]: number };
    lastIndexed?: Date;
    oldestFile?: Date;
}> {
    const client = await pool.connect();
    
    try {
        // Get project and dataset
        const projectResult = await client.query(
            `SELECT p.id as project_id, d.id as dataset_id
             FROM claude_context.projects p
             JOIN claude_context.datasets d ON d.project_id = p.id
             WHERE p.name = $1 AND d.name = $2`,
            [projectName, datasetName]
        );
        
        if (projectResult.rows.length === 0) {
            return {
                totalFiles: 0,
                totalSize: 0,
                totalChunks: 0,
                languages: {}
            };
        }
        
        const { project_id, dataset_id } = projectResult.rows[0];
        
        // Get statistics
        const statsResult = await client.query(
            `SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                SUM(chunk_count) as total_chunks,
                MAX(last_indexed_at) as last_indexed,
                MIN(last_indexed_at) as oldest_file
             FROM claude_context.indexed_files
             WHERE project_id = $1 AND dataset_id = $2`,
            [project_id, dataset_id]
        );
        
        // Get language distribution
        const langResult = await client.query(
            `SELECT 
                language,
                COUNT(*) as count
             FROM claude_context.indexed_files
             WHERE project_id = $1 AND dataset_id = $2
               AND language IS NOT NULL
             GROUP BY language
             ORDER BY count DESC`,
            [project_id, dataset_id]
        );
        
        const languages: { [key: string]: number } = {};
        for (const row of langResult.rows) {
            languages[row.language] = parseInt(row.count);
        }
        
        const stats = statsResult.rows[0];
        
        return {
            totalFiles: parseInt(stats.total_files || 0),
            totalSize: parseInt(stats.total_size || 0),
            totalChunks: parseInt(stats.total_chunks || 0),
            languages,
            lastIndexed: stats.last_indexed,
            oldestFile: stats.oldest_file
        };
        
    } finally {
        client.release();
    }
}
