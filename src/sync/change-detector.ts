/**
 * Change detection for incremental sync
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { calculateSHA256, calculateMultipleHashes } from './hash-calculator';
import ignore from 'ignore';

export interface FileChange {
    type: 'created' | 'modified' | 'deleted' | 'unchanged';
    path: string;           // Absolute path
    relativePath: string;   // Relative to codebase root
    oldHash?: string;       // Previous SHA256 (for modified/deleted)
    newHash?: string;       // Current SHA256 (for created/modified)
    size?: number;          // File size in bytes
    language?: string;      // Detected programming language
}

export interface ChangeSummary {
    created: FileChange[];
    modified: FileChange[];
    deleted: FileChange[];
    unchanged: FileChange[];
    stats: {
        totalFiles: number;
        changedFiles: number;
        unchangedFiles: number;
        totalSize: number;
        scanDurationMs: number;
    };
}

interface StoredFile {
    file_path: string;
    relative_path: string;
    sha256_hash: string;
    file_size: number;
    language: string | null;
    chunk_count: number;
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.php': 'php',
        '.rb': 'ruby',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.r': 'r',
        '.m': 'objective-c',
        '.mm': 'objective-c',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.json': 'json',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.sql': 'sql',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'zsh',
        '.fish': 'fish',
        '.ps1': 'powershell',
        '.lua': 'lua',
        '.vim': 'vim',
        '.dockerfile': 'dockerfile',
        '.makefile': 'makefile'
    };
    
    return languageMap[ext];
}

/**
 * Load ignore patterns from .gitignore and other ignore files
 */
async function loadIgnorePatterns(codebasePath: string): Promise<ReturnType<typeof ignore>> {
    const ig = ignore();
    
    // Default ignores
    ig.add([
        '.git/',
        'node_modules/',
        '__pycache__/',
        '.pytest_cache/',
        '.venv/',
        'venv/',
        'dist/',
        'build/',
        'target/',
        '*.pyc',
        '*.pyo',
        '*.pyd',
        '.DS_Store',
        'Thumbs.db',
        '*.swp',
        '*.swo',
        '*~',
        '.idea/',
        '.vscode/',
        '*.log'
    ]);
    
    // Load .gitignore if exists
    const gitignorePath = path.join(codebasePath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf-8');
        ig.add(gitignoreContent);
    }
    
    // Load .dockerignore if exists
    const dockerignorePath = path.join(codebasePath, '.dockerignore');
    if (fs.existsSync(dockerignorePath)) {
        const dockerignoreContent = await fs.promises.readFile(dockerignorePath, 'utf-8');
        ig.add(dockerignoreContent);
    }
    
    return ig;
}

/**
 * Recursively scan for code files, respecting ignore patterns
 */
async function scanCodeFiles(
    codebasePath: string,
    ignorePatterns: ReturnType<typeof ignore>
): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = new Set([
        '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.cs',
        '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.r', '.m', '.mm',
        '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
        '.md', '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.lua', '.vim'
    ]);
    
    async function traverse(currentPath: string): Promise<void> {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(codebasePath, fullPath);
            
            // Skip if ignored
            if (ignorePatterns.ignores(relativePath)) {
                continue;
            }
            
            if (entry.isDirectory()) {
                await traverse(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                
                // Check if it's a supported file type
                if (supportedExtensions.has(ext) || 
                    entry.name === 'Dockerfile' || 
                    entry.name === 'Makefile' ||
                    entry.name === 'docker-compose.yml' ||
                    entry.name === 'docker-compose.yaml') {
                    files.push(fullPath);
                }
            }
        }
    }
    
    await traverse(codebasePath);
    return files;
}

/**
 * Get stored file metadata from database
 */
async function getStoredFiles(
    pool: Pool,
    projectId: string,
    datasetId: string
): Promise<Map<string, StoredFile>> {
    const client = await pool.connect();
    try {
        const result = await client.query<StoredFile>(
            `SELECT 
                file_path, 
                relative_path, 
                sha256_hash, 
                file_size, 
                language, 
                chunk_count
             FROM claude_context.indexed_files 
             WHERE project_id = $1 AND dataset_id = $2`,
            [projectId, datasetId]
        );
        
        const storedMap = new Map<string, StoredFile>();
        for (const row of result.rows) {
            storedMap.set(row.file_path, row);
        }
        
        return storedMap;
    } finally {
        client.release();
    }
}

/**
 * Detect changes between current files and stored metadata
 */
export async function detectChanges(
    codebasePath: string,
    projectId: string,
    datasetId: string,
    pool: Pool
): Promise<ChangeSummary> {
    const startTime = Date.now();
    
    console.log(`[ChangeDetector] 🔍 Scanning codebase: ${codebasePath}`);
    
    // Step 1: Load ignore patterns
    const ignorePatterns = await loadIgnorePatterns(codebasePath);
    
    // Step 2: Scan current files on disk
    const currentFiles = await scanCodeFiles(codebasePath, ignorePatterns);
    console.log(`[ChangeDetector] 📁 Found ${currentFiles.length} code files`);
    
    // Step 3: Calculate SHA256 for each file (parallel with controlled concurrency)
    const hashMap = await calculateMultipleHashes(currentFiles, 20);
    
    const currentFileData: Map<string, {
        path: string;
        relativePath: string;
        hash: string;
        size: number;
        language?: string;
    }> = new Map();
    
    let totalSize = 0;
    
    for (const filePath of currentFiles) {
        const hash = hashMap.get(filePath);
        if (!hash) continue; // Skip if hash failed
        
        const stat = await fs.promises.stat(filePath);
        const relativePath = path.relative(codebasePath, filePath);
        const language = detectLanguage(filePath);
        
        currentFileData.set(filePath, {
            path: filePath,
            relativePath,
            hash,
            size: stat.size,
            language
        });
        
        totalSize += stat.size;
    }
    
    // Step 4: Get stored hashes from database
    const storedFiles = await getStoredFiles(pool, projectId, datasetId);
    console.log(`[ChangeDetector] 🗄️  Found ${storedFiles.size} stored files`);
    
    // Step 5: Compare and categorize changes
    const changes: ChangeSummary = {
        created: [],
        modified: [],
        deleted: [],
        unchanged: [],
        stats: {
            totalFiles: currentFiles.length,
            changedFiles: 0,
            unchangedFiles: 0,
            totalSize,
            scanDurationMs: 0
        }
    };
    
    // Check current files: new or modified?
    for (const [filePath, fileData] of currentFileData) {
        const stored = storedFiles.get(filePath);
        
        if (!stored) {
            // New file
            changes.created.push({
                type: 'created',
                path: fileData.path,
                relativePath: fileData.relativePath,
                newHash: fileData.hash,
                size: fileData.size,
                language: fileData.language
            });
        } else if (stored.sha256_hash !== fileData.hash) {
            // Modified file
            changes.modified.push({
                type: 'modified',
                path: fileData.path,
                relativePath: fileData.relativePath,
                oldHash: stored.sha256_hash,
                newHash: fileData.hash,
                size: fileData.size,
                language: fileData.language
            });
        } else {
            // Unchanged file
            changes.unchanged.push({
                type: 'unchanged',
                path: fileData.path,
                relativePath: fileData.relativePath,
                newHash: fileData.hash,
                size: fileData.size,
                language: fileData.language
            });
        }
        
        // Remove from stored map (for deletion detection)
        storedFiles.delete(filePath);
    }
    
    // Remaining stored files = deleted
    for (const [filePath, stored] of storedFiles) {
        changes.deleted.push({
            type: 'deleted',
            path: filePath,
            relativePath: stored.relative_path,
            oldHash: stored.sha256_hash
        });
    }
    
    // Update stats
    changes.stats.changedFiles = 
        changes.created.length + 
        changes.modified.length + 
        changes.deleted.length;
    changes.stats.unchangedFiles = changes.unchanged.length;
    changes.stats.scanDurationMs = Date.now() - startTime;
    
    console.log(`[ChangeDetector] ✅ Change detection complete in ${changes.stats.scanDurationMs}ms`);
    console.log(`[ChangeDetector] 📊 Created: ${changes.created.length}, Modified: ${changes.modified.length}, Deleted: ${changes.deleted.length}, Unchanged: ${changes.unchanged.length}`);
    
    return changes;
}

/**
 * Detect renames (same content, different path)
 */
export function detectRenames(changes: ChangeSummary): {
    renames: Array<{ old: string; new: string; hash: string }>;
    actualCreated: FileChange[];
    actualDeleted: FileChange[];
} {
    const renames: Array<{ old: string; new: string; hash: string }> = [];
    const createdByHash = new Map<string, FileChange>();
    const deletedByHash = new Map<string, FileChange>();
    
    // Index by hash
    for (const file of changes.created) {
        if (file.newHash) {
            createdByHash.set(file.newHash, file);
        }
    }
    
    for (const file of changes.deleted) {
        if (file.oldHash) {
            deletedByHash.set(file.oldHash, file);
        }
    }
    
    // Find matches (same hash = rename)
    const matchedCreated = new Set<FileChange>();
    const matchedDeleted = new Set<FileChange>();
    
    for (const [hash, createdFile] of createdByHash) {
        const deletedFile = deletedByHash.get(hash);
        if (deletedFile) {
            renames.push({
                old: deletedFile.path,
                new: createdFile.path,
                hash
            });
            matchedCreated.add(createdFile);
            matchedDeleted.add(deletedFile);
        }
    }
    
    // Filter out renamed files from created/deleted lists
    const actualCreated = changes.created.filter(f => !matchedCreated.has(f));
    const actualDeleted = changes.deleted.filter(f => !matchedDeleted.has(f));
    
    if (renames.length > 0) {
        console.log(`[ChangeDetector] 🔄 Detected ${renames.length} file rename(s)`);
    }
    
    return { renames, actualCreated, actualDeleted };
}
