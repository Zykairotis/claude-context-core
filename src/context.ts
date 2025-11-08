import {
    Splitter,
    CodeChunk,
    AstCodeSplitter
} from './splitter';
import {
    Embedding,
    EmbeddingVector,
    OpenAIEmbedding
} from './embedding';
import {
    VectorDatabase,
    VectorDocument,
    VectorSearchResult
} from './vectordb';
import { SemanticSearchResult } from './types';
import { envManager } from './utils/env-manager';
import { getOrCreateProject, getOrCreateDataset } from './utils/project-helpers';
import { RerankerClient } from './utils/reranker-client';
import { SpladeClient } from './utils/splade-client';
import { ScopeManager, ScopeLevel } from './utils/scope-manager';
import { Pool } from 'pg';

// Re-export ScopeLevel for public API (used in getCollectionNameScoped method signature)
export { ScopeLevel };
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileSynchronizer } from './sync/synchronizer';

const DEFAULT_SUPPORTED_EXTENSIONS = [
    // Programming languages
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.m', '.mm',
    // Text and markup files
    '.md', '.markdown', '.ipynb',
    // '.txt',  '.json', '.yaml', '.yml', '.xml', '.html', '.htm',
    // '.css', '.scss', '.less', '.sql', '.sh', '.bash', '.env'
];

const DEFAULT_IGNORE_PATTERNS = [
    // Common build output and dependency directories
    'node_modules/**',
    'dist/**',
    'build/**',
    'out/**',
    'target/**',
    'coverage/**',
    '.nyc_output/**',
    
    // Next.js build directories
    '.next/**',
    '.next/cache/**',
    '.next/server/**',
    '.next/static/**',
    '.next/dev/**',
    
    // Other framework build directories
    '.nuxt/**',
    '.vuepress/**',
    '.gatsby-cache/**',
    '.vercel/**',
    '.turbo/**',
    '.parcel-cache/**',
    '.webpack/**',

    // IDE and editor files
    '.vscode/**',
    '.idea/**',
    '*.swp',
    '*.swo',

    // Version control
    '.git/**',
    '.svn/**',
    '.hg/**',

    // Cache directories
    '.cache/**',
    '__pycache__/**',
    '.pytest_cache/**',

    // Logs and temporary files
    'logs/**',
    'tmp/**',
    'temp/**',
    '*.log',

    // Environment and config files
    '.env',
    '.env.*',
    '*.local',

    // Minified and bundled files
    '*.min.js',
    '*.min.css',
    '*.min.map',
    '*.bundle.js',
    '*.bundle.css',
    '*.chunk.js',
    '*.vendor.js',
    '*.polyfills.js',
    '*.runtime.js',
    '*.map', // source map files
    
    // Additional duplicates for consistency
    'node_modules', '.git', '.svn', '.hg', 'build', 'dist', 'out',
    'target', '.vscode', '.idea', '__pycache__', '.pytest_cache',
    'coverage', '.nyc_output', 'logs', 'tmp', 'temp', '.next'
];

export interface ContextConfig {
    embedding?: Embedding;
    vectorDatabase?: VectorDatabase;
    codeSplitter?: Splitter;
    supportedExtensions?: string[];
    ignorePatterns?: string[];
    customExtensions?: string[]; // New: custom extensions from MCP
    customIgnorePatterns?: string[]; // New: custom ignore patterns from MCP
    postgresPool?: Pool; // Optional: for project-aware operations
}

export interface ProjectContext {
    projectId: string;
    projectName: string;
    datasetId: string;
    datasetName: string;
}

export interface ProvenanceInfo {
    repo?: string;
    branch?: string;
    sha?: string;
}

export class Context {
    private embedding: Embedding;
    private vectorDatabase: VectorDatabase;
    private codeSplitter: Splitter;
    private supportedExtensions: string[];
    private ignorePatterns: string[];
    private synchronizers = new Map<string, FileSynchronizer>();
    private postgresPool?: Pool;
    private readonly chunkStatsEnabled: boolean;
    private rerankerClient?: RerankerClient;
    private spladeClient?: SpladeClient;
    private scopeManager: ScopeManager;

    constructor(config: ContextConfig = {}) {
        this.postgresPool = config.postgresPool;
        // Initialize services
        this.embedding = config.embedding || new OpenAIEmbedding({
            apiKey: envManager.get('OPENAI_API_KEY') || 'your-openai-api-key',
            model: 'text-embedding-3-small',
            ...(envManager.get('OPENAI_BASE_URL') && { baseURL: envManager.get('OPENAI_BASE_URL') })
        });

        if (!config.vectorDatabase) {
            throw new Error('VectorDatabase is required. Please provide a vectorDatabase instance in the config.');
        }
        this.vectorDatabase = config.vectorDatabase;

        const chunkStatsFlag = envManager.get('CHUNK_STATS_VERBOSE');
        this.chunkStatsEnabled = typeof chunkStatsFlag === 'string' && chunkStatsFlag.toLowerCase() === 'true';

        if (config.codeSplitter) {
            this.codeSplitter = config.codeSplitter;
        } else {
            const defaultChunkSize = this.getNumericEnv('CHUNK_CHAR_TARGET', 1000);
            const defaultChunkOverlap = this.getNumericEnv('CHUNK_CHAR_OVERLAP', 100, { allowZero: true });
            this.codeSplitter = new AstCodeSplitter(defaultChunkSize, defaultChunkOverlap);
            const approxTokens = Math.round(defaultChunkSize / 4);
            console.log(`[Context] ✂️  Code splitter configured for ~${defaultChunkSize} characters (~${approxTokens} tokens) with ${defaultChunkOverlap} character overlap`);
        }

        // Load custom extensions from environment variables
        const envCustomExtensions = this.getCustomExtensionsFromEnv();

        // Combine default extensions with config extensions and env extensions
        const allSupportedExtensions = [
            ...DEFAULT_SUPPORTED_EXTENSIONS,
            ...(config.supportedExtensions || []),
            ...(config.customExtensions || []),
            ...envCustomExtensions
        ];
        // Remove duplicates
        this.supportedExtensions = [...new Set(allSupportedExtensions)];

        // Load custom ignore patterns from environment variables  
        const envCustomIgnorePatterns = this.getCustomIgnorePatternsFromEnv();

        // Start with default ignore patterns
        const allIgnorePatterns = [
            ...DEFAULT_IGNORE_PATTERNS,
            ...(config.ignorePatterns || []),
            ...(config.customIgnorePatterns || []),
            ...envCustomIgnorePatterns
        ];
        // Remove duplicates
        this.ignorePatterns = [...new Set(allIgnorePatterns)];

        // Initialize reranker and SPLADE clients if enabled
        if (process.env.ENABLE_RERANKING === 'true') {
            this.rerankerClient = new RerankerClient();
        }
        if (process.env.ENABLE_HYBRID_SEARCH === 'true') {
            this.spladeClient = new SpladeClient();
        }

        // Initialize ScopeManager for island architecture
        this.scopeManager = new ScopeManager();

        console.log(`[Context] 🔧 Initialized with ${this.supportedExtensions.length} supported extensions and ${this.ignorePatterns.length} ignore patterns`);
        if (envCustomExtensions.length > 0) {
            console.log(`[Context] 📎 Loaded ${envCustomExtensions.length} custom extensions from environment: ${envCustomExtensions.join(', ')}`);
        }
        if (envCustomIgnorePatterns.length > 0) {
            console.log(`[Context] 🚫 Loaded ${envCustomIgnorePatterns.length} custom ignore patterns from environment: ${envCustomIgnorePatterns.join(', ')}`);
        }
    }

    /**
     * Get embedding instance
     */
    getEmbedding(): Embedding {
        return this.embedding;
    }

    /**
     * Get vector database instance
     */
    getVectorDatabase(): VectorDatabase {
        return this.vectorDatabase;
    }

    /**
     * Get configured PostgreSQL pool if available
     */
    getPostgresPool(): Pool | undefined {
        return this.postgresPool;
    }

    /**
     * Get configured reranker client when enabled
     */
    getRerankerClient(): RerankerClient | undefined {
        return this.rerankerClient;
    }

    /**
     * Get configured SPLADE client when enabled
     */
    getSpladeClient(): SpladeClient | undefined {
        return this.spladeClient;
    }

    /**
     * Get code splitter instance
     */
    getCodeSplitter(): Splitter {
        return this.codeSplitter;
    }

    /**
     * Get supported extensions
     */
    getSupportedExtensions(): string[] {
        return [...this.supportedExtensions];
    }

    /**
     * Get ignore patterns
     */
    getIgnorePatterns(): string[] {
        return [...this.ignorePatterns];
    }

    /**
     * Get synchronizers map
     */
    getSynchronizers(): Map<string, FileSynchronizer> {
        return new Map(this.synchronizers);
    }

    /**
     * Set synchronizer for a collection
     */
    setSynchronizer(collectionName: string, synchronizer: FileSynchronizer): void {
        this.synchronizers.set(collectionName, synchronizer);
    }

    /**
     * Public wrapper for loadIgnorePatterns private method
     */
    async getLoadedIgnorePatterns(codebasePath: string): Promise<void> {
        return this.loadIgnorePatterns(codebasePath);
    }

    /**
     * Public wrapper for prepareCollection private method
     */
    async getPreparedCollection(codebasePath: string): Promise<void> {
        return this.prepareCollection(codebasePath);
    }

    /**
     * Get isHybrid setting from environment variable with default true
     */
    private getIsHybrid(): boolean {
        const isHybridEnv = envManager.get('HYBRID_MODE');
        if (isHybridEnv === undefined || isHybridEnv === null) {
            return true; // Default to true
        }
        return isHybridEnv.toLowerCase() === 'true';
    }

    /**
     * Generate collection name based on codebase path and hybrid mode
     * @deprecated Use getCollectionNameScoped() for island architecture support.
     * This method is kept for backward compatibility with existing MD5-based collections.
     */
    public getCollectionName(codebasePath: string): string {
        const isHybrid = this.getIsHybrid();
        const normalizedPath = path.resolve(codebasePath);
        const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');
        const prefix = isHybrid === true ? 'hybrid_code_chunks' : 'code_chunks';
        return `${prefix}_${hash.substring(0, 8)}`;
    }

    /**
     * Generate collection name using ScopeManager (Island Architecture)
     * 
     * This is the new recommended method for generating collection names.
     * It uses the NAME-based approach that matches the Python implementation.
     * 
     * Collection naming:
     * - Global: 'global_knowledge'
     * - Project: 'project_{sanitized_project_name}'
     * - Local: 'project_{sanitized_project}_dataset_{sanitized_dataset}'
     * 
     * @param project Project name
     * @param dataset Dataset name
     * @param scope Optional explicit scope (GLOBAL, PROJECT, LOCAL)
     * @returns Collection name string
     * 
     * @example
     * ```typescript
     * // Local scope (default)
     * context.getCollectionNameScoped('myproject', 'mydataset')
     * // Returns: "project_myproject_dataset_mydataset"
     * 
     * // Project scope
     * context.getCollectionNameScoped('myproject', 'mydataset', ScopeLevel.PROJECT)
     * // Returns: "project_myproject"
     * 
     * // Global scope
     * context.getCollectionNameScoped(undefined, undefined, ScopeLevel.GLOBAL)
     * // Returns: "global_knowledge"
     * ```
     */
    public getCollectionNameScoped(
        project?: string,
        dataset?: string,
        scope?: ScopeLevel
    ): string {
        return this.scopeManager.getCollectionName(project, dataset, scope);
    }

    /**
     * Get ScopeManager instance for advanced scope operations
     */
    public getScopeManager(): ScopeManager {
        return this.scopeManager;
    }

    /**
     * Index a codebase for semantic search
     * @param codebasePath Codebase root path
     * @param progressCallback Optional progress callback function
     * @param forceReindex Whether to recreate the collection even if it exists
     * @returns Indexing statistics
     */
    async indexCodebase(
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
        forceReindex: boolean = false
    ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
        const isHybrid = this.getIsHybrid();
        const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
        console.log(`[Context] 🚀 Starting to index codebase with ${searchType}: ${codebasePath}`);

        // 1. Load ignore patterns from various ignore files
        await this.loadIgnorePatterns(codebasePath);

        // 2. Check and prepare vector collection
        progressCallback?.({ phase: 'Preparing collection...', current: 0, total: 100, percentage: 0 });
        console.log(`Debug2: Preparing vector collection for codebase${forceReindex ? ' (FORCE REINDEX)' : ''}`);
        await this.prepareCollection(codebasePath, forceReindex);

        // 3. Recursively traverse codebase to get all supported files
        progressCallback?.({ phase: 'Scanning files...', current: 5, total: 100, percentage: 5 });
        const codeFiles = await this.getCodeFiles(codebasePath);
        console.log(`[Context] 📁 Found ${codeFiles.length} code files`);

        if (codeFiles.length === 0) {
            progressCallback?.({ phase: 'No files to index', current: 100, total: 100, percentage: 100 });
            return { indexedFiles: 0, totalChunks: 0, status: 'completed' };
        }

        // 3. Process each file with streaming chunk processing
        // Reserve 10% for preparation, 90% for actual indexing
        const indexingStartPercentage = 10;
        const indexingEndPercentage = 100;
        const indexingRange = indexingEndPercentage - indexingStartPercentage;

        const result = await this.processFileList(
            codeFiles,
            codebasePath,
            (filePath, fileIndex, totalFiles) => {
                // Calculate progress percentage
                const progressPercentage = indexingStartPercentage + (fileIndex / totalFiles) * indexingRange;

                console.log(`[Context] 📊 Processed ${fileIndex}/${totalFiles} files`);
                progressCallback?.({
                    phase: `Processing files (${fileIndex}/${totalFiles})...`,
                    current: fileIndex,
                    total: totalFiles,
                    percentage: Math.round(progressPercentage)
                });
            }
        );

        console.log(`[Context] ✅ Codebase indexing completed! Processed ${result.processedFiles} files in total, generated ${result.totalChunks} code chunks`);

        progressCallback?.({
            phase: 'Indexing complete!',
            current: result.processedFiles,
            total: codeFiles.length,
            percentage: 100
        });

        return {
            indexedFiles: result.processedFiles,
            totalChunks: result.totalChunks,
            status: result.status
        };
    }

    async reindexByChange(
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void
    ): Promise<{ added: number, removed: number, modified: number }> {
        const collectionName = this.getCollectionName(codebasePath);
        const synchronizer = this.synchronizers.get(collectionName);

        if (!synchronizer) {
            // Load project-specific ignore patterns before creating FileSynchronizer
            await this.loadIgnorePatterns(codebasePath);

            // To be safe, let's initialize if it's not there.
            const newSynchronizer = new FileSynchronizer(codebasePath, this.ignorePatterns);
            await newSynchronizer.initialize();
            this.synchronizers.set(collectionName, newSynchronizer);
        }

        const currentSynchronizer = this.synchronizers.get(collectionName)!;

        progressCallback?.({ phase: 'Checking for file changes...', current: 0, total: 100, percentage: 0 });
        const { added, removed, modified } = await currentSynchronizer.checkForChanges();
        const totalChanges = added.length + removed.length + modified.length;

        if (totalChanges === 0) {
            progressCallback?.({ phase: 'No changes detected', current: 100, total: 100, percentage: 100 });
            console.log('[Context] ✅ No file changes detected.');
            return { added: 0, removed: 0, modified: 0 };
        }

        console.log(`[Context] 🔄 Found changes: ${added.length} added, ${removed.length} removed, ${modified.length} modified.`);

        let processedChanges = 0;
        const updateProgress = (phase: string) => {
            processedChanges++;
            const percentage = Math.round((processedChanges / (removed.length + modified.length + added.length)) * 100);
            progressCallback?.({ phase, current: processedChanges, total: totalChanges, percentage });
        };

        // Handle removed files
        for (const file of removed) {
            await this.deleteFileChunks(collectionName, file);
            updateProgress(`Removed ${file}`);
        }

        // Handle modified files
        for (const file of modified) {
            await this.deleteFileChunks(collectionName, file);
            updateProgress(`Deleted old chunks for ${file}`);
        }

        // Handle added and modified files
        const filesToIndex = [...added, ...modified].map(f => path.join(codebasePath, f));

        if (filesToIndex.length > 0) {
            await this.processFileList(
                filesToIndex,
                codebasePath,
                (filePath, fileIndex, totalFiles) => {
                    updateProgress(`Indexed ${filePath} (${fileIndex}/${totalFiles})`);
                }
            );
        }

        console.log(`[Context] ✅ Re-indexing complete. Added: ${added.length}, Removed: ${removed.length}, Modified: ${modified.length}`);
        progressCallback?.({ phase: 'Re-indexing complete!', current: totalChanges, total: totalChanges, percentage: 100 });

        return { added: added.length, removed: removed.length, modified: modified.length };
    }

    private async deleteFileChunks(collectionName: string, relativePath: string): Promise<void> {
        // Escape backslashes for Milvus query expression (Windows path compatibility)
        const escapedPath = relativePath.replace(/\\/g, '\\\\');
        const results = await this.vectorDatabase.query(
            collectionName,
            `relativePath == "${escapedPath}"`,
            ['id']
        );

        if (results.length > 0) {
            const ids = results.map(r => r.id as string).filter(id => id);
            if (ids.length > 0) {
                await this.vectorDatabase.delete(collectionName, ids);
                console.log(`[Context] Deleted ${ids.length} chunks for file ${relativePath}`);
            }
        }
    }

    /**
     * Semantic search with unified implementation
     * @param codebasePath Codebase path to search in
     * @param query Search query
     * @param topK Number of results to return
     * @param threshold Similarity threshold
     */
    async semanticSearch(codebasePath: string, query: string, topK: number = 5, threshold: number = 0.5, filterExpr?: string): Promise<SemanticSearchResult[]> {
        const isHybridMode = this.getIsHybrid();
        const hybridEnabled = isHybridMode === true && this.spladeClient?.isEnabled();
        const rerankEnabled = process.env.ENABLE_RERANKING === 'true' && this.rerankerClient;

        const searchLabel = hybridEnabled ? 'hybrid search' : 'semantic search';
        console.log(`[Context] 🔍 Executing ${searchLabel}: "${query}" in ${codebasePath}`);

        const collectionName = this.getCollectionName(codebasePath);
        console.log(`[Context] 🔍 Using collection: ${collectionName}`);

        const hasCollection = await this.vectorDatabase.hasCollection(collectionName);
        if (!hasCollection) {
            console.log(`[Context] ⚠️  Collection '${collectionName}' does not exist. Please index the codebase first.`);
            return [];
        }

        const initialK = rerankEnabled
            ? parseInt(process.env.RERANK_INITIAL_K || '150', 10)
            : topK;
        const finalK = rerankEnabled
            ? parseInt(process.env.RERANK_FINAL_K || `${topK}`, 10)
            : topK;

            console.log(`[Context] 🔍 Generating embeddings for query: "${query}"`);
            const queryEmbedding: EmbeddingVector = await this.embedding.embed(query);
            console.log(`[Context] ✅ Generated embedding vector with dimension: ${queryEmbedding.vector.length}`);

        let querySparse: { indices: number[]; values: number[] } | undefined;
        if (hybridEnabled && this.spladeClient) {
            try {
                querySparse = await this.spladeClient.computeSparse(query);
                console.log('[Context] 🔍 Generated sparse query representation');
            } catch (error) {
                console.warn('[Context] ⚠️  Failed to compute sparse query vector, continuing with dense search:', error);
            }
        }

        let baseResults: VectorSearchResult[] = [];
        try {
            if (hybridEnabled && querySparse && typeof (this.vectorDatabase as any).hybridQuery === 'function') {
                baseResults = await (this.vectorDatabase as any).hybridQuery(
                collectionName,
                    queryEmbedding.vector,
                    querySparse,
                    { topK: initialK, threshold }
                );
            } else {
                baseResults = await this.vectorDatabase.search(
                    collectionName,
                    queryEmbedding.vector,
                    { topK: initialK, threshold, filterExpr }
            );
            }
        } catch (error) {
            console.error('[Context] ❌ Vector search failed:', error);
            return [];
        }

        type EnrichedResult = {
            document: VectorDocument;
            vectorScore: number;
            rerankScore?: number;
            finalScore: number;
        };

        let enrichedResults: EnrichedResult[] = baseResults.map(result => ({
            document: result.document,
            vectorScore: result.score,
            finalScore: result.score
            }));

        if (rerankEnabled && this.rerankerClient && enrichedResults.length > 0) {
            try {
                const candidateTexts = enrichedResults.map(result => `${result.document.relativePath}\n${result.document.content}`);
                const rerankScores = await this.rerankerClient.rerank(query, candidateTexts);

                enrichedResults = enrichedResults.map((result, index) => ({
                    ...result,
                    rerankScore: rerankScores[index] ?? result.finalScore,
                    finalScore: rerankScores[index] ?? result.finalScore
                }));

                enrichedResults.sort((a, b) => b.finalScore - a.finalScore);
            } catch (error) {
                console.warn('[Context] ⚠️  Reranking failed, returning vector scores:', error);
            }
        }

        const limit = Math.max(1, finalK);
        const trimmedResults = enrichedResults.slice(0, limit);

        const results: SemanticSearchResult[] = trimmedResults.map(result => ({
                content: result.document.content,
                relativePath: result.document.relativePath,
                startLine: result.document.startLine,
                endLine: result.document.endLine,
                language: result.document.metadata.language || 'unknown',
            score: result.finalScore
            }));

            console.log(`[Context] ✅ Found ${results.length} relevant results`);
        if (results.length > 0) {
            console.log(`[Context] 🔍 Top result score: ${results[0].score}, path: ${results[0].relativePath}`);
        }

            return results;
    }

    /**
     * Check if index exists for codebase
     * @param codebasePath Codebase path to check
     * @returns Whether index exists
     */
    async hasIndex(codebasePath: string): Promise<boolean> {
        const collectionName = this.getCollectionName(codebasePath);
        return await this.vectorDatabase.hasCollection(collectionName);
    }

    /**
     * Clear index
     * @param codebasePath Codebase path to clear index for
     * @param progressCallback Optional progress callback function
     */
    async clearIndex(
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void
    ): Promise<void> {
        console.log(`[Context] 🧹 Cleaning index data for ${codebasePath}...`);

        progressCallback?.({ phase: 'Checking existing index...', current: 0, total: 100, percentage: 0 });

        const collectionName = this.getCollectionName(codebasePath);
        const collectionExists = await this.vectorDatabase.hasCollection(collectionName);

        progressCallback?.({ phase: 'Removing index data...', current: 50, total: 100, percentage: 50 });

        if (collectionExists) {
            await this.vectorDatabase.dropCollection(collectionName);
        }

        // Delete snapshot file
        await FileSynchronizer.deleteSnapshot(codebasePath);

        progressCallback?.({ phase: 'Index cleared', current: 100, total: 100, percentage: 100 });
        console.log('[Context] ✅ Index data cleaned');
    }

    /**
     * Update ignore patterns (merges with default patterns and existing patterns)
     * @param ignorePatterns Array of ignore patterns to add to defaults
     */
    updateIgnorePatterns(ignorePatterns: string[]): void {
        // Merge with default patterns and any existing custom patterns, avoiding duplicates
        const mergedPatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];
        const uniquePatterns: string[] = [];
        const patternSet = new Set(mergedPatterns);
        patternSet.forEach(pattern => uniquePatterns.push(pattern));
        this.ignorePatterns = uniquePatterns;
        console.log(`[Context] 🚫 Updated ignore patterns: ${ignorePatterns.length} new + ${DEFAULT_IGNORE_PATTERNS.length} default = ${this.ignorePatterns.length} total patterns`);
    }

    /**
     * Add custom ignore patterns (from MCP or other sources) without replacing existing ones
     * @param customPatterns Array of custom ignore patterns to add
     */
    addCustomIgnorePatterns(customPatterns: string[]): void {
        if (customPatterns.length === 0) return;

        // Merge current patterns with new custom patterns, avoiding duplicates
        const mergedPatterns = [...this.ignorePatterns, ...customPatterns];
        const uniquePatterns: string[] = [];
        const patternSet = new Set(mergedPatterns);
        patternSet.forEach(pattern => uniquePatterns.push(pattern));
        this.ignorePatterns = uniquePatterns;
        console.log(`[Context] 🚫 Added ${customPatterns.length} custom ignore patterns. Total: ${this.ignorePatterns.length} patterns`);
    }

    /**
     * Reset ignore patterns to defaults only
     */
    resetIgnorePatternsToDefaults(): void {
        this.ignorePatterns = [...DEFAULT_IGNORE_PATTERNS];
        console.log(`[Context] 🔄 Reset ignore patterns to defaults: ${this.ignorePatterns.length} patterns`);
    }

    /**
     * Update embedding instance
     * @param embedding New embedding instance
     */
    updateEmbedding(embedding: Embedding): void {
        this.embedding = embedding;
        console.log(`[Context] 🔄 Updated embedding provider: ${embedding.getProvider()}`);
    }

    /**
     * Update vector database instance
     * @param vectorDatabase New vector database instance
     */
    updateVectorDatabase(vectorDatabase: VectorDatabase): void {
        this.vectorDatabase = vectorDatabase;
        console.log(`[Context] 🔄 Updated vector database`);
    }

    /**
     * Update splitter instance
     * @param splitter New splitter instance
     */
    updateSplitter(splitter: Splitter): void {
        this.codeSplitter = splitter;
        console.log(`[Context] 🔄 Updated splitter instance`);
    }

    /**
     * Prepare vector collection
     */
    private async prepareCollection(codebasePath: string, forceReindex: boolean = false): Promise<void> {
        const isHybrid = this.getIsHybrid();
        const collectionType = isHybrid === true ? 'hybrid vector' : 'vector';
        console.log(`[Context] 🔧 Preparing ${collectionType} collection for codebase: ${codebasePath}${forceReindex ? ' (FORCE REINDEX)' : ''}`);
        const collectionName = this.getCollectionName(codebasePath);

        // Check if collection already exists
        const collectionExists = await this.vectorDatabase.hasCollection(collectionName);

        if (collectionExists && !forceReindex) {
            console.log(`📋 Collection ${collectionName} already exists, skipping creation`);
            return;
        }

        if (collectionExists && forceReindex) {
            console.log(`[Context] 🗑️  Dropping existing collection ${collectionName} for force reindex...`);
            await this.vectorDatabase.dropCollection(collectionName);
            console.log(`[Context] ✅ Collection ${collectionName} dropped successfully`);
        }

        console.log(`[Context] 🔍 Detecting embedding dimension for ${this.embedding.getProvider()} provider...`);
        const dimension = await this.embedding.detectDimension();
        console.log(`[Context] 📏 Detected dimension: ${dimension} for ${this.embedding.getProvider()}`);
        const dirName = path.basename(codebasePath);

        if (isHybrid === true) {
            await this.vectorDatabase.createHybridCollection(collectionName, dimension, `Hybrid Index for ${dirName}`);
        } else {
            await this.vectorDatabase.createCollection(collectionName, dimension, `Index for ${dirName}`);
        }

        console.log(`[Context] ✅ Collection ${collectionName} created successfully (dimension: ${dimension})`);
    }

    /**
     * Prepare vector collection with scope-based naming (Island Architecture)
     */
    private async prepareCollectionScoped(collectionName: string, forceReindex: boolean = false): Promise<void> {
        const isHybrid = this.getIsHybrid();
        const collectionType = isHybrid === true ? 'hybrid vector' : 'vector';
        console.log(`[Context] 🔧 Preparing ${collectionType} collection: ${collectionName}${forceReindex ? ' (FORCE REINDEX)' : ''}`);

        // Check if collection already exists
        const collectionExists = await this.vectorDatabase.hasCollection(collectionName);

        if (collectionExists && !forceReindex) {
            console.log(`📋 Collection ${collectionName} already exists, skipping creation`);
            return;
        }

        if (collectionExists && forceReindex) {
            console.log(`[Context] 🗑️  Dropping existing collection ${collectionName} for force reindex...`);
            await this.vectorDatabase.dropCollection(collectionName);
            console.log(`[Context] ✅ Collection ${collectionName} dropped successfully`);
        }

        console.log(`[Context] 🔍 Detecting embedding dimension for ${this.embedding.getProvider()} provider...`);
        const dimension = await this.embedding.detectDimension();
        console.log(`[Context] 📏 Detected dimension: ${dimension} for ${this.embedding.getProvider()}`);

        if (isHybrid === true) {
            await this.vectorDatabase.createHybridCollection(collectionName, dimension, `Hybrid Index`);
        } else {
            await this.vectorDatabase.createCollection(collectionName, dimension, `Index`);
        }

        console.log(`[Context] ✅ Collection ${collectionName} created successfully (dimension: ${dimension})`);
    }

    /**
     * Recursively get all code files in the codebase
     */
    private async getCodeFiles(codebasePath: string): Promise<string[]> {
        const files: string[] = [];

        const traverseDirectory = async (currentPath: string) => {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                // Check if path matches ignore patterns
                if (this.matchesIgnorePattern(fullPath, codebasePath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await traverseDirectory(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (this.supportedExtensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        };

        await traverseDirectory(codebasePath);
        return files;
    }

    /**
 * Process a list of files with streaming chunk processing
 * @param filePaths Array of file paths to process
 * @param codebasePath Base path for the codebase
 * @param onFileProcessed Callback called when each file is processed
 * @returns Object with processed file count and total chunk count
 */
    private async processFileList(
        filePaths: string[],
        codebasePath: string,
        onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void
    ): Promise<{ processedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
        const isHybrid = this.getIsHybrid();
        const EMBEDDING_BATCH_SIZE = Math.max(1, parseInt(envManager.get('EMBEDDING_BATCH_SIZE') || '100', 10));
        const CHUNK_LIMIT = 450000;
        console.log(`[Context] 🔧 Using EMBEDDING_BATCH_SIZE: ${EMBEDDING_BATCH_SIZE}`);

        let chunkBuffer: Array<{ chunk: CodeChunk; codebasePath: string }> = [];
        let processedFiles = 0;
        let totalChunks = 0;
        let limitReached = false;

        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];

            try {
                let content = await fs.promises.readFile(filePath, 'utf-8');
                
                // Sanitize Unicode to prevent "lone leading surrogate" errors
                // Replace invalid Unicode characters with replacement character
                content = content.replace(/[\uD800-\uDFFF]/g, '\uFFFD');
                
                const language = this.getLanguageFromExtension(path.extname(filePath));
                const chunks = await this.codeSplitter.split(content, language, filePath);

                // Log files with many chunks or large content
                if (chunks.length > 50) {
                    console.warn(`[Context] ⚠️  File ${filePath} generated ${chunks.length} chunks (${Math.round(content.length / 1024)}KB)`);
                } else if (content.length > 100000) {
                    console.log(`📄 Large file ${filePath}: ${Math.round(content.length / 1024)}KB -> ${chunks.length} chunks`);
                }

                // Add chunks to buffer
                for (const chunk of chunks) {
                    chunkBuffer.push({ chunk, codebasePath });
                    totalChunks++;

                    // Process batch when buffer reaches EMBEDDING_BATCH_SIZE
                    if (chunkBuffer.length >= EMBEDDING_BATCH_SIZE) {
                        try {
                            await this.processChunkBuffer(chunkBuffer);
                        } catch (error) {
                            const searchType = isHybrid === true ? 'hybrid' : 'regular';
                            console.error(`[Context] ❌ Failed to process chunk batch for ${searchType}:`, error);
                            if (error instanceof Error) {
                                console.error('[Context] Stack trace:', error.stack);
                            }
                        } finally {
                            chunkBuffer = []; // Always clear buffer, even on failure
                        }
                    }

                    // Check if chunk limit is reached
                    if (totalChunks >= CHUNK_LIMIT) {
                        console.warn(`[Context] ⚠️  Chunk limit of ${CHUNK_LIMIT} reached. Stopping indexing.`);
                        limitReached = true;
                        break; // Exit the inner loop (over chunks)
                    }
                }

                processedFiles++;
                onFileProcessed?.(filePath, i + 1, filePaths.length);

                if (limitReached) {
                    break; // Exit the outer loop (over files)
                }

            } catch (error) {
                console.warn(`[Context] ⚠️  Skipping file ${filePath}: ${error}`);
            }
        }

        // Process any remaining chunks in the buffer
        if (chunkBuffer.length > 0) {
            const searchType = isHybrid === true ? 'hybrid' : 'regular';
            console.log(`📝 Processing final batch of ${chunkBuffer.length} chunks for ${searchType}`);
            try {
                await this.processChunkBuffer(chunkBuffer);
            } catch (error) {
                console.error(`[Context] ❌ Failed to process final chunk batch for ${searchType}:`, error);
                if (error instanceof Error) {
                    console.error('[Context] Stack trace:', error.stack);
                }
            }
        }

        return {
            processedFiles,
            totalChunks,
            status: limitReached ? 'limit_reached' : 'completed'
        };
    }

    /**
 * Process accumulated chunk buffer
 */
    private async processChunkBuffer(chunkBuffer: Array<{ chunk: CodeChunk; codebasePath: string }>): Promise<void> {
        if (chunkBuffer.length === 0) return;

        // Extract chunks and ensure they all have the same codebasePath
        const chunks = chunkBuffer.map(item => item.chunk);
        const codebasePath = chunkBuffer[0].codebasePath;

        // Estimate tokens (rough estimation: 1 token ≈ 4 characters)
        const estimatedTokens = chunks.reduce((sum, chunk) => sum + Math.ceil(chunk.content.length / 4), 0);

        const isHybrid = this.getIsHybrid();
        const searchType = isHybrid === true ? 'hybrid' : 'regular';
        console.log(`[Context] 🔄 Processing batch of ${chunks.length} chunks (~${estimatedTokens} tokens) for ${searchType}`);
        await this.processChunkBatch(chunks, codebasePath);
    }

    /**
     * Process a batch of chunks
     */
    private async processChunkBatch(
        chunks: CodeChunk[], 
        collectionNameOrPath: string,
        projectContext?: ProjectContext,
        provenance?: ProvenanceInfo
    ): Promise<void> {
        const isHybrid = this.getIsHybrid();

        if (this.chunkStatsEnabled) {
            this.logChunkStats(chunks);
        }

        // Determine if this is a collection name or codebase path
        // Collection names follow patterns like "project_x_dataset_y" or "global_knowledge"
        // Codebase paths are file system paths
        const isCollectionName = collectionNameOrPath.startsWith('project_') || 
                                collectionNameOrPath.startsWith('global_') ||
                                collectionNameOrPath.includes('_dataset_');
        
        // Get the actual collection name and codebase path
        const collectionName = isCollectionName ? collectionNameOrPath : this.getCollectionName(collectionNameOrPath);
        const codebasePath = projectContext ? chunks[0]?.metadata?.filePath ? 
            path.dirname(chunks[0].metadata.filePath) : collectionNameOrPath : collectionNameOrPath;

        // Generate embedding vectors - run dense and sparse in parallel for speed
        const chunkContents = chunks.map(chunk => chunk.content);
        const batchStart = performance.now();
        
        const [embeddings, sparseVectors] = await Promise.all([
            this.embedding.embedBatch(chunkContents),
            (isHybrid === true && this.spladeClient?.isEnabled())
                ? this.spladeClient.computeSparseBatch(chunkContents).catch(error => {
                    console.warn('[Context] ⚠️  Failed to compute SPLADE sparse vectors, continuing with dense-only indexing:', error);
                    return undefined;
                })
                : Promise.resolve(undefined)
        ]);

        const batchDuration = performance.now() - batchStart;
        const throughput = (chunks.length / (batchDuration / 1000)).toFixed(1);
        console.log(`[Context] ⚡ Batch processed ${chunks.length} chunks in ${(batchDuration / 1000).toFixed(2)}s (${throughput} chunks/sec, hybrid=${isHybrid})`);

        if (isHybrid === true) {
            // Create hybrid vector documents
            const documents: VectorDocument[] = chunks.map((chunk, index) => {
                if (!chunk.metadata.filePath) {
                    throw new Error(`Missing filePath in chunk metadata at index ${index}`);
                }

                const relativePath = path.relative(codebasePath, chunk.metadata.filePath);
                const fileExtension = path.extname(chunk.metadata.filePath);
                const { filePath, startLine, endLine, ...restMetadata } = chunk.metadata;
                const lang = this.getLanguageFromExtension(fileExtension);
                const chunkIndex = chunk.metadata.chunkIndex ?? index;

                return {
                    id: this.generateId(relativePath, chunk.metadata.startLine || 0, chunk.metadata.endLine || 0, chunk.content, chunkIndex),
                    content: chunk.content, // Full text content for BM25 and storage
                    vector: embeddings[index].vector, // Dense vector
                    relativePath,
                    startLine: chunk.metadata.startLine || 0,
                    endLine: chunk.metadata.endLine || 0,
                    fileExtension,
                    // Project-aware fields
                    projectId: projectContext?.projectId,
                    datasetId: projectContext?.datasetId,
                    sourceType: 'code',
                    // Provenance fields
                    repo: provenance?.repo,
                    branch: provenance?.branch,
                    sha: provenance?.sha,
                    lang,
                    sparse: sparseVectors?.[index],
                    metadata: {
                        ...restMetadata,
                        file_path: chunk.metadata.filePath, // Add absolute path for incremental sync
                        codebasePath,
                        language: chunk.metadata.language || 'unknown',
                        chunkIndex
                    }
                };
            });

            // Store to vector database
            await this.vectorDatabase.insertHybrid(collectionName, documents);
        } else {
            // Create regular vector documents
            const documents: VectorDocument[] = chunks.map((chunk, index) => {
                if (!chunk.metadata.filePath) {
                    throw new Error(`Missing filePath in chunk metadata at index ${index}`);
                }

                const relativePath = path.relative(codebasePath, chunk.metadata.filePath);
                const fileExtension = path.extname(chunk.metadata.filePath);
                const { filePath, startLine, endLine, ...restMetadata } = chunk.metadata;
                const lang = this.getLanguageFromExtension(fileExtension);
                const chunkIndex = chunk.metadata.chunkIndex ?? index;

                return {
                    id: this.generateId(relativePath, chunk.metadata.startLine || 0, chunk.metadata.endLine || 0, chunk.content, chunkIndex),
                    vector: embeddings[index].vector,
                    content: chunk.content,
                    relativePath,
                    startLine: chunk.metadata.startLine || 0,
                    endLine: chunk.metadata.endLine || 0,
                    fileExtension,
                    // Project-aware fields
                    projectId: projectContext?.projectId,
                    datasetId: projectContext?.datasetId,
                    sourceType: 'code',
                    // Provenance fields
                    repo: provenance?.repo,
                    branch: provenance?.branch,
                    sha: provenance?.sha,
                    lang,
                    metadata: {
                        ...restMetadata,
                        file_path: chunk.metadata.filePath, // Add absolute path for incremental sync
                        codebasePath,
                        language: chunk.metadata.language || 'unknown',
                        chunkIndex
                    }
                };
            });

            // Store to vector database
            await this.vectorDatabase.insert(collectionName, documents);
        }
    }

    /**
     * Index web pages with Island Architecture support
     * 
     * Phase 6: Uses ScopeManager for collection naming and dataset_collections table
     */
    async indexWebPages(
        pages: Array<{ url: string; content: string; title?: string; metadata?: Record<string, any> }>,
        project: string,
        dataset: string,
        options?: { forceReindex?: boolean; progressCallback?: (progress: any) => void }
    ): Promise<{ processedPages: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
        const pool = this.postgresPool;
        if (!pool) {
            throw new Error('PostgreSQL pool required for indexWebPages');
        }

        console.log(`[Context] 🌐 Starting web page indexing for project="${project}", dataset="${dataset}"`);
        options?.progressCallback?.({ phase: 'Initializing', percentage: 0 });

        const client = await pool.connect();
        try {
            // 1. Get or create project and dataset
            const { getOrCreateProject, getOrCreateDataset } = await import('./utils/project-helpers');
            const projectRecord = await getOrCreateProject(client, project);
            const datasetRecord = await getOrCreateDataset(client, projectRecord.id, dataset);

            console.log(`[Context] ✅ Project: ${projectRecord.name} (${projectRecord.id})`);
            console.log(`[Context] ✅ Dataset: ${datasetRecord.name} (${datasetRecord.id})`);

            // 2. Get collection name using ScopeManager (Phase 6: Island Architecture)
            const collectionName = this.scopeManager.getCollectionName(project, dataset);
            console.log(`[Context] 📦 Collection: ${collectionName}`);

            // 3. Get or create collection record in dataset_collections table
            const { getOrCreateCollectionRecord, updateCollectionMetadata } = await import('./utils/collection-helpers');
            const collectionId = await getOrCreateCollectionRecord(
                pool,
                datasetRecord.id,
                collectionName,
                this.vectorDatabase.constructor.name === 'QdrantVectorDatabase' ? 'qdrant' : 'postgres',
                this.embedding ? await this.embedding.detectDimension() : 768,
                true // hybrid search enabled
            );

            console.log(`[Context] ✅ Collection record: ${collectionId}`);

            // 4. Ensure collection exists in vector database
            if (typeof (this.vectorDatabase as any).hasCollection === 'function') {
                const exists = await (this.vectorDatabase as any).hasCollection(collectionName);
                if (!exists) {
                    console.log(`[Context] 🔨 Creating collection: ${collectionName}`);
                    if (typeof (this.vectorDatabase as any).createHybridCollection === 'function') {
                        await (this.vectorDatabase as any).createHybridCollection(
                            collectionName,
                            this.embedding ? await this.embedding.detectDimension() : 768
                        );
                    } else {
                        await this.vectorDatabase.createCollection(
                            collectionName,
                            this.embedding ? await this.embedding.detectDimension() : 768
                        );
                    }
                }
            }

            options?.progressCallback?.({ phase: 'Processing pages', percentage: 10 });

            // 5. Process pages and generate chunks
            let processedPages = 0;
            let totalChunks = 0;
            const BATCH_SIZE = 50;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                try {
                    console.log(`[Context] 📄 Processing page: ${page.title || page.url}`);

                    // Parse markdown content
                    const { codeBlocks, proseBlocks } = this.parseMarkdownContent(page.content);

                    // Chunk code blocks using AST splitter
                    const codeChunks: any[] = [];
                    for (const codeBlock of codeBlocks) {
                        const language = codeBlock.language || 'typescript';
                        const chunks = await this.codeSplitter.split(codeBlock.content, language);
                        codeChunks.push(...chunks.map(chunk => ({
                            ...chunk,
                            metadata: {
                                ...chunk.metadata,
                                url: page.url,
                                title: page.title,
                                isCode: true,
                                language: codeBlock.language
                            }
                        })));
                    }

                    // Chunk prose using character-based splitting
                    const proseChunks: any[] = [];
                    const { CharacterTextSplitter } = await import('@langchain/textsplitters');
                    const characterSplitter = new CharacterTextSplitter({
                        chunkSize: 1000,
                        chunkOverlap: 100,
                        separator: '\n\n'
                    });

                    for (const proseBlock of proseBlocks) {
                        const chunks = await characterSplitter.splitText(proseBlock);
                        proseChunks.push(...chunks.map(chunk => ({
                            content: chunk,
                            metadata: {
                                url: page.url,
                                title: page.title,
                                isCode: false
                            }
                        })));
                    }

                    const allChunks = [...codeChunks, ...proseChunks];
                    console.log(`[Context] ✂️  Generated ${allChunks.length} chunks (${codeChunks.length} code, ${proseChunks.length} prose)`);

                    // Prepare documents for vector storage
                    const documents = await this.prepareWebDocuments(
                        allChunks,
                        page,
                        projectRecord.id,
                        datasetRecord.id
                    );

                    // Store in batches
                    for (let j = 0; j < documents.length; j += BATCH_SIZE) {
                        const batch = documents.slice(j, j + BATCH_SIZE);
                        
                        // Store to vector database
                        if (typeof (this.vectorDatabase as any).insertHybrid === 'function' && this.spladeClient?.isEnabled()) {
                            await (this.vectorDatabase as any).insertHybrid(collectionName, batch);
                        } else {
                            await this.vectorDatabase.insert(collectionName, batch);
                        }
                        
                        totalChunks += batch.length;
                    }

                    processedPages++;
                    const progress = Math.round(10 + (processedPages / pages.length) * 85);
                    options?.progressCallback?.({ phase: `Processed ${processedPages}/${pages.length} pages`, percentage: progress });

                } catch (error) {
                    console.error(`[Context] ❌ Error processing page ${page.url}:`, error);
                }
            }

            // 6. Update collection metadata with final point count
            await updateCollectionMetadata(pool, collectionName, totalChunks);

            options?.progressCallback?.({ phase: 'Completed', percentage: 100 });
            console.log(`[Context] ✅ Web page indexing completed! Processed ${processedPages} pages, ${totalChunks} chunks`);

            return {
                processedPages,
                totalChunks,
                status: 'completed'
            };

        } finally {
            client.release();
        }
    }

    /**
     * Parse markdown content to separate code blocks from prose
     */
    private parseMarkdownContent(markdown: string): {
        codeBlocks: Array<{ content: string; language: string }>;
        proseBlocks: string[];
    } {
        const codeBlocks: Array<{ content: string; language: string }> = [];
        const proseBlocks: string[] = [];

        // Regex to match fenced code blocks
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(markdown)) !== null) {
            // Add prose before this code block
            if (match.index > lastIndex) {
                const prose = markdown.slice(lastIndex, match.index).trim();
                if (prose) {
                    proseBlocks.push(prose);
                }
            }

            // Add code block
            const language = match[1] || 'text';
            const content = match[2].trim();
            if (content) {
                codeBlocks.push({ content, language });
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining prose after last code block
        if (lastIndex < markdown.length) {
            const prose = markdown.slice(lastIndex).trim();
            if (prose) {
                proseBlocks.push(prose);
            }
        }

        return { codeBlocks, proseBlocks };
    }

    /**
     * Prepare web documents for vector storage
     */
    private async prepareWebDocuments(
        chunks: any[],
        page: { url: string; title?: string; metadata?: Record<string, any> },
        projectId: string,
        datasetId: string
    ): Promise<VectorDocument[]> {
        const documents: VectorDocument[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await this.embedding.embed(chunk.content);

            // Generate sparse vector if SPLADE is available
            let sparse: { indices: number[]; values: number[] } | undefined;
            if (this.spladeClient?.isEnabled()) {
                try {
                    sparse = await this.spladeClient.computeSparse(chunk.content);
                } catch (error) {
                    console.warn('[Context] Failed to compute sparse vector:', error);
                }
            }

            const doc: VectorDocument = {
                id: `web_${projectId}_${datasetId}_${i}_${Date.now()}`,
                vector: embedding.vector,
                sparse,
                content: chunk.content,
                relativePath: page.url,
                startLine: 0,
                endLine: 0,
                fileExtension: '.md',
                projectId,
                datasetId,
                sourceType: 'web_page',
                metadata: {
                    ...chunk.metadata,
                    title: page.title,
                    domain: new URL(page.url).hostname,
                    ...page.metadata
                }
            };

            documents.push(doc);
        }

        return documents;
    }
    
    /**
     * Store code chunks directly (for incremental sync)
     */
    async storeCodeChunks(
        chunks: any[],
        project: string,
        dataset: string,
        provenance?: { repo?: string; branch?: string; sha?: string }
    ): Promise<void> {
        if (chunks.length === 0) return;
        
        // Get project and dataset IDs if available
        const projectContext = {
            projectId: project, // This should be the ID, not name
            projectName: project,
            datasetId: dataset,  // This should be the ID, not name
            datasetName: dataset
        };
        
        // Prepare chunks in the expected format
        const codeChunks: CodeChunk[] = chunks.map(chunk => ({
            content: chunk.content,
            metadata: {
                ...chunk.metadata,
                filePath: chunk.metadata.file_path || chunk.metadata.filePath,
                startLine: chunk.metadata.start_line || chunk.metadata.startLine || 0,
                endLine: chunk.metadata.end_line || chunk.metadata.endLine || 0,
                language: chunk.metadata.language,
                chunkIndex: chunk.metadata.chunkIndex || 0
            }
        }));
        
        // Use the existing processChunkBatch method
        const codebasePath = chunks[0]?.metadata?.codebasePath || '.';
        await this.processChunkBatch(
            codeChunks,
            codebasePath,
            projectContext,
            provenance
        );
    }
    
    /**
     * Get programming language based on file extension
     */
    private getLanguageFromExtension(ext: string): string {
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.m': 'objective-c',
            '.mm': 'objective-c',
            '.ipynb': 'jupyter'
        };
        return languageMap[ext] || 'text';
    }

    /**
     * Generate unique ID based on chunk content and location
     * @param relativePath Relative path to the file
     * @param startLine Start line number
     * @param endLine End line number
     * @param content Chunk content
     * @returns Hash-based unique ID
     */
    private generateId(relativePath: string, startLine: number, endLine: number, content: string, chunkIndex?: number): string {
        const combinedString = `${relativePath}:${startLine}:${endLine}:${chunkIndex ?? -1}:${content}`;
        const hash = crypto.createHash('sha256').update(combinedString, 'utf-8').digest('hex');
        return `chunk_${hash.substring(0, 16)}`;
    }

    private logChunkStats(chunks: CodeChunk[]): void {
        if (!chunks.length) {
            return;
        }

        const tokenEstimates = chunks.map(chunk => Math.max(1, Math.ceil(chunk.content.length / 4)));
        const totalTokens = tokenEstimates.reduce((sum, value) => sum + value, 0);
        const avgTokens = Math.round(totalTokens / tokenEstimates.length);
        const minTokens = Math.min(...tokenEstimates);
        const maxTokens = Math.max(...tokenEstimates);

        const lineCounts = chunks.map(chunk => {
            const start = typeof chunk.metadata.startLine === 'number' ? chunk.metadata.startLine : 0;
            const end = typeof chunk.metadata.endLine === 'number' ? chunk.metadata.endLine : 0;
            if (start > 0 && end >= start) {
                return Math.max(1, end - start + 1);
            }
            return Math.max(1, chunk.content.split('\n').length);
        });

        const avgLines = Math.round(lineCounts.reduce((sum, value) => sum + value, 0) / lineCounts.length);
        const minLines = Math.min(...lineCounts);
        const maxLines = Math.max(...lineCounts);

        console.log(`[Context] 📏 Chunk batch stats -> count=${chunks.length}, tokens(avg≈${avgTokens}, range ${minTokens}-${maxTokens}), lines(avg≈${avgLines}, range ${minLines}-${maxLines})`);
    }

    /**
     * Read ignore patterns from file (e.g., .gitignore)
     * @param filePath Path to the ignore file
     * @returns Array of ignore patterns
     */
    static async getIgnorePatternsFromFile(filePath: string): Promise<string[]> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')); // Filter out empty lines and comments
        } catch (error) {
            console.warn(`[Context] ⚠️  Could not read ignore file ${filePath}: ${error}`);
            return [];
        }
    }

    /**
     * Load ignore patterns from various ignore files in the codebase
     * This method preserves any existing custom patterns that were added before
     * @param codebasePath Path to the codebase
     */
    private async loadIgnorePatterns(codebasePath: string): Promise<void> {
        try {
            let fileBasedPatterns: string[] = [];

            // Load all .xxxignore files in codebase directory
            const ignoreFiles = await this.findIgnoreFiles(codebasePath);
            for (const ignoreFile of ignoreFiles) {
                const patterns = await this.loadIgnoreFile(ignoreFile, path.basename(ignoreFile));
                fileBasedPatterns.push(...patterns);
            }

            // Load global ~/.context/.contextignore
            const globalIgnorePatterns = await this.loadGlobalIgnoreFile();
            fileBasedPatterns.push(...globalIgnorePatterns);

            // Merge file-based patterns with existing patterns (which may include custom MCP patterns)
            if (fileBasedPatterns.length > 0) {
                this.addCustomIgnorePatterns(fileBasedPatterns);
                console.log(`[Context] 🚫 Loaded total ${fileBasedPatterns.length} ignore patterns from all ignore files`);
            } else {
                console.log('📄 No ignore files found, keeping existing patterns');
            }
        } catch (error) {
            console.warn(`[Context] ⚠️ Failed to load ignore patterns: ${error}`);
            // Continue with existing patterns on error - don't reset them
        }
    }

    /**
     * Find all .xxxignore files in the codebase directory
     * @param codebasePath Path to the codebase
     * @returns Array of ignore file paths
     */
    private async findIgnoreFiles(codebasePath: string): Promise<string[]> {
        try {
            const entries = await fs.promises.readdir(codebasePath, { withFileTypes: true });
            const ignoreFiles: string[] = [];

            for (const entry of entries) {
                if (entry.isFile() &&
                    entry.name.startsWith('.') &&
                    entry.name.endsWith('ignore')) {
                    ignoreFiles.push(path.join(codebasePath, entry.name));
                }
            }

            if (ignoreFiles.length > 0) {
                console.log(`📄 Found ignore files: ${ignoreFiles.map(f => path.basename(f)).join(', ')}`);
            }

            return ignoreFiles;
        } catch (error) {
            console.warn(`[Context] ⚠️ Failed to scan for ignore files: ${error}`);
            return [];
        }
    }

    /**
     * Load global ignore file from ~/.context/.contextignore
     * @returns Array of ignore patterns
     */
    private async loadGlobalIgnoreFile(): Promise<string[]> {
        try {
            const homeDir = require('os').homedir();
            const globalIgnorePath = path.join(homeDir, '.context', '.contextignore');
            return await this.loadIgnoreFile(globalIgnorePath, 'global .contextignore');
        } catch (error) {
            // Global ignore file is optional, don't log warnings
            return [];
        }
    }

    /**
     * Load ignore patterns from a specific ignore file
     * @param filePath Path to the ignore file
     * @param fileName Display name for logging
     * @returns Array of ignore patterns
     */
    private async loadIgnoreFile(filePath: string, fileName: string): Promise<string[]> {
        try {
            await fs.promises.access(filePath);
            console.log(`📄 Found ${fileName} file at: ${filePath}`);

            const ignorePatterns = await Context.getIgnorePatternsFromFile(filePath);

            if (ignorePatterns.length > 0) {
                console.log(`[Context] 🚫 Loaded ${ignorePatterns.length} ignore patterns from ${fileName}`);
                return ignorePatterns;
            } else {
                console.log(`📄 ${fileName} file found but no valid patterns detected`);
                return [];
            }
        } catch (error) {
            if (fileName.includes('global')) {
                console.log(`📄 No ${fileName} file found`);
            }
            return [];
        }
    }

    /**
     * Check if a path matches any ignore pattern
     * @param filePath Path to check
     * @param basePath Base path for relative pattern matching
     * @returns True if path should be ignored
     */
    private matchesIgnorePattern(filePath: string, basePath: string): boolean {
        if (this.ignorePatterns.length === 0) {
            return false;
        }

        const relativePath = path.relative(basePath, filePath);
        const normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize path separators

        for (const pattern of this.ignorePatterns) {
            if (this.isPatternMatch(normalizedPath, pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Simple glob pattern matching
     * @param filePath File path to test
     * @param pattern Glob pattern
     * @returns True if pattern matches
     */
    private isPatternMatch(filePath: string, pattern: string): boolean {
        // Handle directory patterns (ending with /)
        if (pattern.endsWith('/')) {
            const dirPattern = pattern.slice(0, -1);
            const pathParts = filePath.split('/');
            return pathParts.some(part => this.simpleGlobMatch(part, dirPattern));
        }

        // Handle file patterns
        if (pattern.includes('/')) {
            // Pattern with path separator - match exact path
            return this.simpleGlobMatch(filePath, pattern);
        } else {
            // Pattern without path separator - match filename in any directory
            const fileName = path.basename(filePath);
            return this.simpleGlobMatch(fileName, pattern);
        }
    }

    /**
     * Simple glob matching supporting * wildcard
     * @param text Text to test
     * @param pattern Pattern with * wildcards
     * @returns True if pattern matches
     */
    private simpleGlobMatch(text: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
            .replace(/\*/g, '.*'); // Convert * to .*

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text);
    }

    /**
     * Get custom extensions from environment variables
     * Supports CUSTOM_EXTENSIONS as comma-separated list
     * @returns Array of custom extensions
     */
    private getCustomExtensionsFromEnv(): string[] {
        const envExtensions = envManager.get('CUSTOM_EXTENSIONS');
        if (!envExtensions) {
            return [];
        }

        try {
            const extensions = envExtensions
                .split(',')
                .map(ext => ext.trim())
                .filter(ext => ext.length > 0)
                .map(ext => ext.startsWith('.') ? ext : `.${ext}`); // Ensure extensions start with dot

            return extensions;
        } catch (error) {
            console.warn(`[Context] ⚠️  Failed to parse CUSTOM_EXTENSIONS: ${error}`);
            return [];
        }
    }

    /**
     * Get custom ignore patterns from environment variables  
     * Supports CUSTOM_IGNORE_PATTERNS as comma-separated list
     * @returns Array of custom ignore patterns
     */
    private getCustomIgnorePatternsFromEnv(): string[] {
        const envIgnorePatterns = envManager.get('CUSTOM_IGNORE_PATTERNS');
        if (!envIgnorePatterns) {
            return [];
        }

        try {
            const patterns = envIgnorePatterns
                .split(',')
                .map(pattern => pattern.trim())
                .filter(pattern => pattern.length > 0);

            return patterns;
        } catch (error) {
            console.warn(`[Context] ⚠️  Failed to parse CUSTOM_IGNORE_PATTERNS: ${error}`);
            return [];
        }
    }

    private getNumericEnv(varName: string, fallback: number, options?: { allowZero?: boolean; min?: number }): number {
        const rawValue = envManager.get(varName);
        if (!rawValue || rawValue.trim().length === 0) {
            return fallback;
        }

        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) {
            console.warn(`[Context] ⚠️  Invalid numeric value for ${varName} (${rawValue}), using fallback ${fallback}`);
            return fallback;
        }

        const minimum = options?.min ?? (options?.allowZero ? 0 : 1);
        if (parsed < minimum) {
            console.warn(`[Context] ⚠️  ${varName} below minimum (${minimum}), using fallback ${fallback}`);
            return fallback;
        }

        return Math.floor(parsed);
    }

    /**
     * Add custom extensions (from MCP or other sources) without replacing existing ones
     * @param customExtensions Array of custom extensions to add
     */
    addCustomExtensions(customExtensions: string[]): void {
        if (customExtensions.length === 0) return;

        // Ensure extensions start with dot
        const normalizedExtensions = customExtensions.map(ext =>
            ext.startsWith('.') ? ext : `.${ext}`
        );

        // Merge current extensions with new custom extensions, avoiding duplicates
        const mergedExtensions = [...this.supportedExtensions, ...normalizedExtensions];
        const uniqueExtensions: string[] = [...new Set(mergedExtensions)];
        this.supportedExtensions = uniqueExtensions;
        console.log(`[Context] 📎 Added ${customExtensions.length} custom extensions. Total: ${this.supportedExtensions.length} extensions`);
    }

    /**
     * Get current splitter information
     */
    getSplitterInfo(): { type: string; hasBuiltinFallback: boolean; supportedLanguages?: string[] } {
        const splitterName = this.codeSplitter.constructor.name;

        if (splitterName === 'AstCodeSplitter') {
            const { AstCodeSplitter } = require('./splitter/ast-splitter');
            return {
                type: 'ast',
                hasBuiltinFallback: true,
                supportedLanguages: AstCodeSplitter.getSupportedLanguages()
            };
        } else {
            return {
                type: 'langchain',
                hasBuiltinFallback: false
            };
        }
    }

    /**
     * Check if current splitter supports a specific language
     * @param language Programming language
     */
    isLanguageSupported(language: string): boolean {
        const splitterName = this.codeSplitter.constructor.name;

        if (splitterName === 'AstCodeSplitter') {
            const { AstCodeSplitter } = require('./splitter/ast-splitter');
            return AstCodeSplitter.isLanguageSupported(language);
        }

        // LangChain splitter supports most languages
        return true;
    }

    /**
     * Get which strategy would be used for a specific language
     * @param language Programming language
     */
    getSplitterStrategyForLanguage(language: string): { strategy: 'ast' | 'langchain'; reason: string } {
        const splitterName = this.codeSplitter.constructor.name;

        if (splitterName === 'AstCodeSplitter') {
            const { AstCodeSplitter } = require('./splitter/ast-splitter');
            const isSupported = AstCodeSplitter.isLanguageSupported(language);

            return {
                strategy: isSupported ? 'ast' : 'langchain',
                reason: isSupported
                    ? 'Language supported by AST parser'
                    : 'Language not supported by AST, will fallback to LangChain'
            };
        } else {
            return {
                strategy: 'langchain',
                reason: 'Using LangChain splitter directly'
            };
        }
    }

    /**
     * Resolve project and dataset, creating them if they don't exist
     * Requires postgresPool to be configured
     */
    private async resolveProject(
        projectName: string,
        datasetName: string
    ): Promise<ProjectContext> {
        if (!this.postgresPool) {
            throw new Error('PostgreSQL pool not configured. Cannot resolve project context.');
        }

        const client = await this.postgresPool.connect();
        try {
            // Get or create project
            const project = await getOrCreateProject(client, projectName);
            
            // Get or create dataset
            const dataset = await getOrCreateDataset(client, project.id, datasetName);

            return {
                projectId: project.id,
                projectName: project.name,
                datasetId: dataset.id,
                datasetName: dataset.name
            };
        } finally {
            client.release();
        }
    }

    /**
     * Index a codebase with project awareness
     * @param codebasePath Codebase root path
     * @param projectName Project name
     * @param datasetName Dataset name
     * @param options Additional options including provenance info
     * @param progressCallback Optional progress callback function
     * @param forceReindex Whether to recreate the collection even if it exists
     * @returns Indexing statistics
     */
    async indexWithProject(
        codebasePath: string,
        projectName: string,
        datasetName: string,
        options?: {
            repo?: string;
            branch?: string;
            sha?: string;
            progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void;
            forceReindex?: boolean;
        }
    ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
        console.log(`[Context] 🚀 Starting project-aware indexing for project: ${projectName}, dataset: ${datasetName}`);

        // Resolve project context
        const projectContext = await this.resolveProject(projectName, datasetName);
        console.log(`[Context] ✅ Resolved project: ${projectContext.projectId}, dataset: ${projectContext.datasetId}`);

        // Extract provenance info
        const provenance: ProvenanceInfo = {
            repo: options?.repo,
            branch: options?.branch,
            sha: options?.sha
        };

        const isHybrid = this.getIsHybrid();
        const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
        console.log(`[Context] 🚀 Starting to index codebase with ${searchType}: ${codebasePath}`);

        // 1. Load ignore patterns from various ignore files
        await this.loadIgnorePatterns(codebasePath);

        // 2. Get collection name using ScopeManager (Island Architecture)
        const collectionName = this.scopeManager.getCollectionName(projectName, datasetName);
        console.log(`[Context] 📦 Using collection: ${collectionName}`);

        // 3. Create dataset_collections record if PostgreSQL is configured
        console.log(`[Context] 🔍 DEBUG: postgresPool exists? ${!!this.postgresPool}`);
        console.log(`[Context] 🔍 DEBUG: datasetId: ${projectContext.datasetId}`);
        console.log(`[Context] 🔍 DEBUG: collectionName: ${collectionName}`);
        
        if (this.postgresPool) {
            try {
                const { getOrCreateCollectionRecord } = await import('./utils/collection-helpers');
                const collectionId = await getOrCreateCollectionRecord(
                    this.postgresPool,
                    projectContext.datasetId,
                    collectionName,
                    this.vectorDatabase.constructor.name === 'QdrantVectorDatabase' ? 'qdrant' : 'postgres',
                    await this.embedding.detectDimension(),
                    isHybrid === true
                );
                console.log(`[Context] ✅ Collection record created/updated: ${collectionId}`);
            } catch (error) {
                console.error(`[Context] ❌ CRITICAL: Failed to create dataset_collections record:`, error);
                console.error(`[Context] ❌ Dataset ID: ${projectContext.datasetId}, Collection: ${collectionName}`);
                console.error(`[Context] ❌ This means the MCP tools will show 0 vectors!`);
                // Don't throw - allow indexing to continue, but log prominently
            }
        } else {
            console.warn(`[Context] ⚠️  PostgreSQL pool not configured - dataset_collections will not be created`);
            console.warn(`[Context] ⚠️  This means the MCP tools will show 0 vectors!`);
        }

        // 4. Check and prepare vector collection with the scope-based name
        options?.progressCallback?.({ phase: 'Preparing collection...', current: 0, total: 100, percentage: 0 });
        await this.prepareCollectionScoped(collectionName, options?.forceReindex || false);

        // 3. Recursively traverse codebase to get all supported files
        options?.progressCallback?.({ phase: 'Scanning files...', current: 5, total: 100, percentage: 5 });
        const codeFiles = await this.getCodeFiles(codebasePath);
        console.log(`[Context] 📁 Found ${codeFiles.length} code files`);

        if (codeFiles.length === 0) {
            options?.progressCallback?.({ phase: 'No files to index', current: 100, total: 100, percentage: 100 });
            return { indexedFiles: 0, totalChunks: 0, status: 'completed' };
        }

        // 4. Process files with project context
        const indexingStartPercentage = 10;
        const indexingEndPercentage = 100;
        const indexingRange = indexingEndPercentage - indexingStartPercentage;

        let processedFiles = 0;
        let totalChunks = 0;
        const chunkBatch: CodeChunk[] = [];
        // Reduced batch size to prevent SPLADE OOM - configurable via env
        const BATCH_SIZE = parseInt(process.env.CHUNK_BATCH_SIZE || '16', 10);
        // Reduced concurrent batches to prevent GPU memory overload
        const MAX_CONCURRENT_BATCHES = parseInt(process.env.MAX_CONCURRENT_BATCHES || '1', 10);
        const batchQueue: Promise<void>[] = [];

        const processBatchAsync = async (chunks: CodeChunk[]) => {
            await this.processChunkBatch(chunks, collectionName, projectContext, provenance);
            totalChunks += chunks.length;
        };

        for (const filePath of codeFiles) {
            try {
                let fileContent = await fs.promises.readFile(filePath, 'utf-8');
                
                // Sanitize Unicode to prevent "lone leading surrogate" errors
                // Replace invalid Unicode characters with replacement character
                fileContent = fileContent.replace(/[\uD800-\uDFFF]/g, '\uFFFD');
                
                const language = this.getLanguageFromExtension(path.extname(filePath));
                const chunks = await this.codeSplitter.split(fileContent, language, filePath);

                chunks.forEach((chunk, chunkIdx) => {
                    const originalMetadata = chunk.metadata ?? {};
                    chunk.metadata = {
                        ...originalMetadata,
                        startLine: (originalMetadata as any).startLine ?? 1,
                        endLine: (originalMetadata as any).endLine ?? fileContent.split('\n').length,
                        filePath: (originalMetadata as any).filePath || filePath,
                        chunkIndex: chunkIdx
                    };
                });

                for (const chunk of chunks) {
                    chunkBatch.push(chunk);
                    
                    if (chunkBatch.length >= BATCH_SIZE) {
                        // Clone the batch to avoid mutation issues
                        const batchToProcess = [...chunkBatch];
                        chunkBatch.length = 0;
                        
                        // Start processing this batch concurrently
                        const batchPromise = processBatchAsync(batchToProcess);
                        batchQueue.push(batchPromise);
                        
                        // If we hit max concurrent batches, wait for one to complete
                        if (batchQueue.length >= MAX_CONCURRENT_BATCHES) {
                            await Promise.race(batchQueue);
                            // Remove completed promises
                            for (let i = batchQueue.length - 1; i >= 0; i--) {
                                const promise = batchQueue[i];
                                // Check if promise is settled by racing with immediate resolution
                                const settled = await Promise.race([
                                    promise.then(() => true),
                                    Promise.resolve(false)
                                ]);
                                if (settled) {
                                    batchQueue.splice(i, 1);
                                }
                            }
                        }
                    }
                }

                processedFiles++;
                const progressPercentage = indexingStartPercentage + (processedFiles / codeFiles.length) * indexingRange;
                options?.progressCallback?.({
                    phase: `Processing files (${processedFiles}/${codeFiles.length})...`,
                    current: processedFiles,
                    total: codeFiles.length,
                    percentage: Math.round(progressPercentage)
                });
            } catch (error) {
                console.error(`[Context] ❌ Error processing file ${filePath}:`, error);
            }
        }

        // Process remaining chunks
        if (chunkBatch.length > 0) {
            batchQueue.push(processBatchAsync([...chunkBatch]));
        }

        // Wait for all remaining batches to complete
        await Promise.all(batchQueue);

        // Update collection metadata with final point count
        if (this.postgresPool) {
            const { updateCollectionMetadata } = await import('./utils/collection-helpers');
            await updateCollectionMetadata(this.postgresPool, collectionName, totalChunks);
        }

        console.log(`[Context] ✅ Project-aware indexing completed! Processed ${processedFiles} files, generated ${totalChunks} chunks`);
        options?.progressCallback?.({ phase: 'Completed', current: 100, total: 100, percentage: 100 });

        return {
            indexedFiles: processedFiles,
            totalChunks,
            status: 'completed'
        };
    }

    /**
     * Check if the embedding provider is AutoEmbeddingMonster
     */
    isAutoEmbeddingMonster(): boolean {
        return this.embedding.constructor.name === 'AutoEmbeddingMonster';
    }

    /**
     * Dual-model search: Generate both GTE and CodeRank query embeddings
     * and search their respective chunks for comprehensive retrieval
     */
    async dualModelSearch(
        collectionName: string,
        query: string,
        topK: number,
        threshold: number,
        filterExpr?: string,
        hybridEnabled: boolean = false,
        querySparse?: { indices: number[]; values: number[] }
    ): Promise<VectorSearchResult[]> {
        console.log('[Context] 🎯 Using dual-model retrieval (GTE + CodeRank)');

        // Get both embedding models
        const autoEmbedding = this.embedding as any;
        if (!autoEmbedding.getModels) {
            throw new Error('Dual-model search requires AutoEmbeddingMonster');
        }

        const { gte, coderank } = autoEmbedding.getModels();

        // Generate query embeddings from both models in parallel
        const [gteQueryVector, coderankQueryVector] = await Promise.all([
            gte.embed(query),
            coderank.embed(query)
        ]);

        console.log('[Context] ✅ Generated dual query embeddings');
        console.log(`[Context]   GTE dimension: ${gteQueryVector.dimension}`);
        console.log(`[Context]   CodeRank dimension: ${coderankQueryVector.dimension}`);

        // Search GTE chunks with GTE query
        const gteFilter = filterExpr 
            ? `${filterExpr} AND metadata.model_used == "gte"`
            : `metadata.model_used == "gte"`;

        // Search CodeRank chunks with CodeRank query  
        const coderankFilter = filterExpr
            ? `${filterExpr} AND metadata.model_used == "coderank"`
            : `metadata.model_used == "coderank"`;

        const searchPromises: Promise<VectorSearchResult[]>[] = [];

        // GTE search
        if (hybridEnabled && querySparse && typeof (this.vectorDatabase as any).hybridQuery === 'function') {
            searchPromises.push(
                (this.vectorDatabase as any).hybridQuery(
                    collectionName,
                    gteQueryVector.vector,
                    querySparse,
                    { topK: Math.ceil(topK / 2), threshold, filterExpr: gteFilter }
                ).catch((error: Error) => {
                    console.warn('[Context] GTE hybrid search failed:', error);
                    return [];
                })
            );
        } else {
            searchPromises.push(
                this.vectorDatabase.search(
                    collectionName,
                    gteQueryVector.vector,
                    { topK: Math.ceil(topK / 2), threshold, filterExpr: gteFilter }
                ).catch((error: Error) => {
                    console.warn('[Context] GTE search failed:', error);
                    return [];
                })
            );
        }

        // CodeRank search
        searchPromises.push(
            this.vectorDatabase.search(
                collectionName,
                coderankQueryVector.vector,
                { topK: Math.ceil(topK / 2), threshold, filterExpr: coderankFilter }
            ).catch((error: Error) => {
                console.warn('[Context] CodeRank search failed:', error);
                return [];
            })
        );

        // Execute searches in parallel
        const [gteResults, coderankResults] = await Promise.all(searchPromises);

        console.log(`[Context] 📊 Dual-model results:`);
        console.log(`[Context]   GTE: ${gteResults.length} chunks`);
        console.log(`[Context]   CodeRank: ${coderankResults.length} chunks`);

        // Merge and sort by score
        const mergedResults = [...gteResults, ...coderankResults]
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

        console.log(`[Context] ✅ Merged top ${mergedResults.length} results from both models`);

        return mergedResults;
    }
}
