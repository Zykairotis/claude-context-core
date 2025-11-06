/**
 * SHA256 hash calculation utilities for file change detection
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Calculate SHA256 hash for file content
 */
export async function calculateSHA256(filePath: string): Promise<string> {
    const fileBuffer = await fs.promises.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
}

/**
 * Calculate SHA256 hash for large files using streams (memory efficient)
 */
export function calculateSHA256Stream(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/**
 * Calculate hashes for multiple files in parallel
 */
export async function calculateMultipleHashes(
    filePaths: string[],
    maxConcurrency: number = 10
): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const chunks: string[][] = [];
    
    // Split into chunks for controlled concurrency
    for (let i = 0; i < filePaths.length; i += maxConcurrency) {
        chunks.push(filePaths.slice(i, i + maxConcurrency));
    }
    
    // Process chunks sequentially, files within chunk in parallel
    for (const chunk of chunks) {
        const hashPromises = chunk.map(async (filePath) => {
            try {
                const fileSize = (await fs.promises.stat(filePath)).size;
                // Use streaming for files larger than 10MB
                const hash = fileSize > 10 * 1024 * 1024 
                    ? await calculateSHA256Stream(filePath)
                    : await calculateSHA256(filePath);
                return { path: filePath, hash };
            } catch (error) {
                console.error(`[HashCalculator] Failed to hash ${filePath}:`, error);
                return { path: filePath, hash: null };
            }
        });
        
        const chunkResults = await Promise.all(hashPromises);
        for (const result of chunkResults) {
            if (result.hash) {
                results.set(result.path, result.hash);
            }
        }
    }
    
    return results;
}

/**
 * Calculate hash for string content (for testing)
 */
export function calculateSHA256String(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content, 'utf8');
    return hash.digest('hex');
}

/**
 * Verify file content against expected hash
 */
export async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
    try {
        const actualHash = await calculateSHA256(filePath);
        return actualHash === expectedHash;
    } catch (error) {
        console.error(`[HashCalculator] Failed to verify hash for ${filePath}:`, error);
        return false;
    }
}
