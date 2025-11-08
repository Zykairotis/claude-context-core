/**
 * Auto-Watch Manager - Automatically starts file watchers on server startup
 * Manages persistent watch configurations and auto-recovery
 */

import { Context } from '../context';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { startWatching, stopWatching, getActiveWatchers, ActiveWatcher } from './file-watcher';

export interface WatchConfig {
    enabled: boolean;
    path: string;
    project: string;
    projectId: string;
    dataset: string;
    datasetId: string;
    autoStart: boolean;
    debounceMs?: number;
    createdAt: Date;
    lastStarted?: Date;
}

export interface AutoWatchOptions {
    configPath?: string;
    autoRecover?: boolean;
    pollInterval?: number;
    onWatchStart?: (config: WatchConfig) => void;
    onWatchStop?: (config: WatchConfig) => void;
    onWatchError?: (config: WatchConfig, error: Error) => void;
}

export class AutoWatchManager {
    private context: Context;
    private pool: Pool;
    private configs: Map<string, WatchConfig> = new Map();
    private configPath: string;
    private autoRecover: boolean;
    private pollInterval: number;
    private pollTimer?: NodeJS.Timeout;
    private wsCallbacks: any;

    constructor(
        context: Context,
        pool: Pool,
        options: AutoWatchOptions = {}
    ) {
        this.context = context;
        this.pool = pool;
        this.configPath = options.configPath || path.join(process.cwd(), '.context', 'watch-config.json');
        this.autoRecover = options.autoRecover !== false;
        this.pollInterval = options.pollInterval || 30000; // 30 seconds
        this.wsCallbacks = {
            onWatchStart: options.onWatchStart,
            onWatchStop: options.onWatchStop,
            onWatchError: options.onWatchError
        };
    }

    /**
     * Initialize and start auto-watching
     */
    async initialize(): Promise<void> {
        console.log('[AutoWatchManager] Initializing...');
        
        // Load configurations from database
        await this.loadConfigsFromDatabase();
        
        // Also load from file if exists (for persistence across DB resets)
        await this.loadConfigsFromFile();
        
        // Start all auto-start watchers
        await this.startAllAutoWatchers();
        
        // Start health check polling if auto-recover is enabled
        if (this.autoRecover) {
            this.startHealthCheckPolling();
        }
        
        console.log(`[AutoWatchManager] Initialized with ${this.configs.size} watch configurations`);
    }

    /**
     * Load watch configurations from database
     */
    private async loadConfigsFromDatabase(): Promise<void> {
        const client = await this.pool.connect();
        try {
            // Check if watch_configs table exists
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'claude_context' 
                    AND table_name = 'watch_configs'
                );
            `);
            
            if (!tableExists.rows[0].exists) {
                // Create table if it doesn't exist
                await client.query(`
                    CREATE TABLE IF NOT EXISTS claude_context.watch_configs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        path TEXT NOT NULL,
                        project_id UUID NOT NULL REFERENCES claude_context.projects(id),
                        project_name TEXT NOT NULL,
                        dataset_id UUID NOT NULL REFERENCES claude_context.datasets(id),
                        dataset_name TEXT NOT NULL,
                        enabled BOOLEAN DEFAULT true,
                        auto_start BOOLEAN DEFAULT true,
                        debounce_ms INTEGER DEFAULT 2000,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        last_started TIMESTAMPTZ,
                        UNIQUE(path, project_id, dataset_id)
                    );
                `);
                console.log('[AutoWatchManager] Created watch_configs table');
            }
            
            // Load all enabled configs
            const result = await client.query(`
                SELECT 
                    wc.*,
                    p.name as project_name,
                    d.name as dataset_name
                FROM claude_context.watch_configs wc
                JOIN claude_context.projects p ON p.id = wc.project_id
                JOIN claude_context.datasets d ON d.id = wc.dataset_id
                WHERE wc.enabled = true
            `);
            
            for (const row of result.rows) {
                const configKey = `${row.project_name}:${row.dataset_name}:${row.path}`;
                this.configs.set(configKey, {
                    enabled: row.enabled,
                    path: row.path,
                    project: row.project_name,
                    projectId: row.project_id,
                    dataset: row.dataset_name,
                    datasetId: row.dataset_id,
                    autoStart: row.auto_start,
                    debounceMs: row.debounce_ms,
                    createdAt: row.created_at,
                    lastStarted: row.last_started
                });
            }
            
            console.log(`[AutoWatchManager] Loaded ${result.rows.length} watch configs from database`);
            
        } finally {
            client.release();
        }
    }

    /**
     * Load configurations from file (backup/override)
     */
    private async loadConfigsFromFile(): Promise<void> {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = await fs.promises.readFile(this.configPath, 'utf-8');
                const fileConfigs = JSON.parse(content);
                
                // Merge with existing configs
                for (const [key, config] of Object.entries(fileConfigs) as [string, WatchConfig][]) {
                    if (config.enabled && config.autoStart) {
                        this.configs.set(key, {
                            ...config,
                            createdAt: new Date(config.createdAt),
                            lastStarted: config.lastStarted ? new Date(config.lastStarted) : undefined
                        });
                    }
                }
                
                console.log(`[AutoWatchManager] Loaded ${Object.keys(fileConfigs).length} configs from file`);
            }
        } catch (error) {
            console.warn('[AutoWatchManager] Could not load config file:', error);
        }
    }

    /**
     * Save current configurations to file
     */
    private async saveConfigsToFile(): Promise<void> {
        try {
            const dir = path.dirname(this.configPath);
            await fs.promises.mkdir(dir, { recursive: true });
            
            const configObj: Record<string, WatchConfig> = {};
            for (const [key, config] of this.configs.entries()) {
                configObj[key] = config;
            }
            
            await fs.promises.writeFile(
                this.configPath,
                JSON.stringify(configObj, null, 2),
                'utf-8'
            );
            
            console.log(`[AutoWatchManager] Saved ${this.configs.size} configs to file`);
        } catch (error) {
            console.error('[AutoWatchManager] Failed to save config file:', error);
        }
    }

    /**
     * Start all auto-start watchers
     */
    private async startAllAutoWatchers(): Promise<void> {
        const autoStartConfigs = Array.from(this.configs.values())
            .filter(c => c.enabled && c.autoStart);
        
        console.log(`[AutoWatchManager] Starting ${autoStartConfigs.length} auto-start watchers...`);
        
        for (const config of autoStartConfigs) {
            try {
                await this.startWatcher(config);
            } catch (error) {
                console.error(`[AutoWatchManager] Failed to start watcher for ${config.path}:`, error);
                this.wsCallbacks.onWatchError?.(config, error as Error);
            }
        }
    }

    /**
     * Start a single watcher
     */
    private async startWatcher(config: WatchConfig): Promise<void> {
        console.log(`[AutoWatchManager] Starting watcher for ${config.path} (${config.project}/${config.dataset})`);
        
        // Check if path exists
        if (!fs.existsSync(config.path)) {
            throw new Error(`Path does not exist: ${config.path}`);
        }
        
        // Start the watcher
        await startWatching(
            this.context,
            this.pool,
            config.path,
            config.project,
            config.projectId,
            config.dataset,
            config.datasetId,
            {
                debounceMs: config.debounceMs || 2000,
                onSync: (stats) => {
                    console.log(`[AutoWatchManager] Sync completed for ${config.path}:`, stats);
                },
                onError: (error) => {
                    console.error(`[AutoWatchManager] Sync error for ${config.path}:`, error);
                    this.wsCallbacks.onWatchError?.(config, error);
                },
                onEvent: (event, filePath) => {
                    // Silent - too many events
                }
            }
        );
        
        // Update last started time
        config.lastStarted = new Date();
        await this.updateDatabaseConfig(config);
        this.wsCallbacks.onWatchStart?.(config);
        
        console.log(`[AutoWatchManager] Successfully started watcher for ${config.path}`);
    }

    /**
     * Start health check polling
     */
    private startHealthCheckPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
        
        this.pollTimer = setInterval(() => {
            this.checkAndRecoverWatchers();
        }, this.pollInterval);
        
        console.log(`[AutoWatchManager] Started health check polling every ${this.pollInterval}ms`);
    }

    /**
     * Check and recover dead watchers
     */
    private async checkAndRecoverWatchers(): Promise<void> {
        const activeWatchers = getActiveWatchers();
        const activeKeys = new Set(activeWatchers.map(w => w.id));
        
        // Find configs that should be running but aren't
        for (const [key, config] of this.configs.entries()) {
            if (config.enabled && config.autoStart && !activeKeys.has(key)) {
                console.log(`[AutoWatchManager] Recovering dead watcher: ${key}`);
                try {
                    await this.startWatcher(config);
                } catch (error) {
                    console.error(`[AutoWatchManager] Failed to recover watcher ${key}:`, error);
                }
            }
        }
    }

    /**
     * Add a new watch configuration
     */
    async addWatchConfig(
        path: string,
        project: string,
        dataset: string,
        options: { autoStart?: boolean; debounceMs?: number } = {}
    ): Promise<WatchConfig> {
        const client = await this.pool.connect();
        try {
            // Get project and dataset IDs
            const projectResult = await client.query(
                'SELECT id FROM claude_context.projects WHERE name = $1',
                [project]
            );
            
            if (projectResult.rows.length === 0) {
                throw new Error(`Project not found: ${project}`);
            }
            
            const projectId = projectResult.rows[0].id;
            
            const datasetResult = await client.query(
                'SELECT id FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
                [projectId, dataset]
            );
            
            if (datasetResult.rows.length === 0) {
                throw new Error(`Dataset not found: ${dataset}`);
            }
            
            const datasetId = datasetResult.rows[0].id;
            
            // Insert into database
            await client.query(`
                INSERT INTO claude_context.watch_configs 
                (path, project_id, project_name, dataset_id, dataset_name, auto_start, debounce_ms)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (path, project_id, dataset_id) 
                DO UPDATE SET 
                    enabled = true,
                    auto_start = EXCLUDED.auto_start,
                    debounce_ms = EXCLUDED.debounce_ms
            `, [
                path,
                projectId,
                project,
                datasetId,
                dataset,
                options.autoStart !== false,
                options.debounceMs || 2000
            ]);
            
            // Create config object
            const config: WatchConfig = {
                enabled: true,
                path,
                project,
                projectId,
                dataset,
                datasetId,
                autoStart: options.autoStart !== false,
                debounceMs: options.debounceMs || 2000,
                createdAt: new Date()
            };
            
            // Add to configs
            const key = `${project}:${dataset}:${path}`;
            this.configs.set(key, config);
            
            // Save to file
            await this.saveConfigsToFile();
            
            // Start if auto-start
            if (config.autoStart) {
                await this.startWatcher(config);
            }
            
            return config;
            
        } finally {
            client.release();
        }
    }

    /**
     * Remove a watch configuration
     */
    async removeWatchConfig(path: string, project: string, dataset: string): Promise<boolean> {
        const key = `${project}:${dataset}:${path}`;
        const config = this.configs.get(key);
        
        if (!config) {
            return false;
        }
        
        // Stop watcher if running
        await stopWatching(path, project, dataset);
        
        // Remove from database
        const client = await this.pool.connect();
        try {
            await client.query(`
                DELETE FROM claude_context.watch_configs
                WHERE path = $1 AND project_id = $2 AND dataset_id = $3
            `, [path, config.projectId, config.datasetId]);
        } finally {
            client.release();
        }
        
        // Remove from configs
        this.configs.delete(key);
        
        // Save to file
        await this.saveConfigsToFile();
        
        this.wsCallbacks.onWatchStop?.(config);
        
        return true;
    }

    /**
     * Update database config
     */
    private async updateDatabaseConfig(config: WatchConfig): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(`
                UPDATE claude_context.watch_configs
                SET last_started = $1
                WHERE path = $2 AND project_id = $3 AND dataset_id = $4
            `, [config.lastStarted, config.path, config.projectId, config.datasetId]);
        } catch (error) {
            // Ignore errors - not critical
        } finally {
            client.release();
        }
    }

    /**
     * Get all watch configurations
     */
    getConfigs(): WatchConfig[] {
        return Array.from(this.configs.values());
    }

    /**
     * Get active watchers
     */
    getActiveWatchers(): ActiveWatcher[] {
        return getActiveWatchers();
    }

    /**
     * Stop all watchers and cleanup
     */
    async shutdown(): Promise<void> {
        console.log('[AutoWatchManager] Shutting down...');
        
        // Stop health check polling
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        
        // Stop all watchers
        for (const watcher of getActiveWatchers()) {
            await stopWatching(watcher.path, watcher.project, watcher.dataset);
        }
        
        // Save final state
        await this.saveConfigsToFile();
        
        console.log('[AutoWatchManager] Shutdown complete');
    }
}

/**
 * Global auto-watch manager instance
 */
let globalManager: AutoWatchManager | null = null;

/**
 * Initialize global auto-watch manager
 */
export async function initializeAutoWatchManager(
    context: Context,
    pool: Pool,
    options?: AutoWatchOptions
): Promise<AutoWatchManager> {
    if (!globalManager) {
        globalManager = new AutoWatchManager(context, pool, options);
        await globalManager.initialize();
    }
    return globalManager;
}

/**
 * Get global auto-watch manager
 */
export function getAutoWatchManager(): AutoWatchManager | null {
    return globalManager;
}
