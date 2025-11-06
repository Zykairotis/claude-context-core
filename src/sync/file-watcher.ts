/**
 * File Watcher for Automatic Incremental Sync
 * Watches a codebase directory for changes and automatically triggers incremental sync
 */

import chokidar, { FSWatcher } from 'chokidar';
import { incrementalSync } from './incremental-sync';
import type { Context } from '../context';
import type { Pool } from 'pg';

export interface WatcherOptions {
    /** Debounce delay in milliseconds (default: 2000ms) */
    debounceMs?: number;
    /** Callback when sync completes */
    onSync?: (stats: any) => void;
    /** Callback when errors occur */
    onError?: (error: Error) => void;
    /** Callback for file events */
    onEvent?: (event: string, path: string) => void;
}

export interface ActiveWatcher {
    id: string;
    path: string;
    project: string;
    projectId: string;
    dataset: string;
    datasetId: string;
    watcher: FSWatcher;
    startedAt: Date;
    lastSyncAt?: Date;
    syncCount: number;
    options: WatcherOptions;
}

// Global registry of active watchers
const activeWatchers = new Map<string, ActiveWatcher>();

/**
 * Generate a unique watcher ID
 */
function generateWatcherId(path: string, project: string, dataset: string): string {
    return `${project}:${dataset}:${path}`;
}

/**
 * Start watching a codebase for changes
 */
export async function startWatching(
    context: Context,
    dbPool: Pool,
    codebasePath: string,
    project: string,
    projectId: string,
    dataset: string,
    datasetId: string,
    options: WatcherOptions = {}
): Promise<ActiveWatcher> {
    const watcherId = generateWatcherId(codebasePath, project, dataset);
    
    // Check if already watching
    if (activeWatchers.has(watcherId)) {
        throw new Error(`Already watching ${codebasePath} for project ${project}, dataset ${dataset}`);
    }
    
    console.log(`[FileWatcher] Starting watcher for ${codebasePath}`);
    
    // Create watcher with intelligent ignore patterns
    const watcher = chokidar.watch(codebasePath, {
        ignored: [
            /(^|[\/\\])\../,          // Dotfiles
            /node_modules/,            // Node modules
            /\.git/,                   // Git directory
            /dist|build|out/,          // Build directories
            /coverage/,                // Test coverage
            /\.next|\.nuxt/,          // Framework build dirs
            /__pycache__|\.pyc/,      // Python cache
            /target/,                  // Rust/Java build
            /\.vscode|\.idea/,        // IDE directories
        ],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 500,   // Wait 500ms after last change
            pollInterval: 100
        }
    });
    
    let debounceTimer: NodeJS.Timeout | null = null;
    let pendingChanges = new Set<string>();
    
    const triggerSync = async () => {
        try {
            const changeCount = pendingChanges.size;
            console.log(`[FileWatcher] Syncing ${changeCount} changes for ${codebasePath}`);
            pendingChanges.clear();
            
            const stats = await incrementalSync(
                context,
                dbPool,
                codebasePath,
                project,
                projectId,
                dataset,
                datasetId
            );
            
            const activeWatcher = activeWatchers.get(watcherId);
            if (activeWatcher) {
                activeWatcher.lastSyncAt = new Date();
                activeWatcher.syncCount++;
            }
            
            console.log(`[FileWatcher] Sync completed: ${stats.filesCreated} created, ${stats.filesModified} modified, ${stats.filesDeleted} deleted`);
            options.onSync?.(stats);
            
        } catch (error) {
            console.error(`[FileWatcher] Sync failed:`, error);
            const errorObj = error instanceof Error ? error : new Error(String(error));
            options.onError?.(errorObj);
        }
    };
    
    const scheduleSync = (event: string, path: string) => {
        pendingChanges.add(path);
        options.onEvent?.(event, path);
        
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
            triggerSync();
        }, options.debounceMs || 2000);
    };
    
    // Register event handlers
    watcher
        .on('add', path => {
            console.log(`[FileWatcher] File added: ${path}`);
            scheduleSync('add', path);
        })
        .on('change', path => {
            console.log(`[FileWatcher] File changed: ${path}`);
            scheduleSync('change', path);
        })
        .on('unlink', path => {
            console.log(`[FileWatcher] File deleted: ${path}`);
            scheduleSync('unlink', path);
        })
        .on('error', error => {
            console.error(`[FileWatcher] Watcher error:`, error);
            const errorObj = error instanceof Error ? error : new Error(String(error));
            options.onError?.(errorObj);
        });
    
    const activeWatcher: ActiveWatcher = {
        id: watcherId,
        path: codebasePath,
        project,
        projectId,
        dataset,
        datasetId,
        watcher,
        startedAt: new Date(),
        syncCount: 0,
        options
    };
    
    activeWatchers.set(watcherId, activeWatcher);
    
    console.log(`[FileWatcher] Watching ${codebasePath} (ID: ${watcherId})`);
    return activeWatcher;
}

/**
 * Stop watching a codebase
 */
export async function stopWatching(
    path: string,
    project: string,
    dataset: string
): Promise<boolean> {
    const watcherId = generateWatcherId(path, project, dataset);
    const activeWatcher = activeWatchers.get(watcherId);
    
    if (!activeWatcher) {
        return false;
    }
    
    console.log(`[FileWatcher] Stopping watcher for ${path}`);
    await activeWatcher.watcher.close();
    activeWatchers.delete(watcherId);
    
    return true;
}

/**
 * Stop all active watchers
 */
export async function stopAllWatchers(): Promise<number> {
    const count = activeWatchers.size;
    console.log(`[FileWatcher] Stopping all ${count} watchers`);
    
    const closePromises = Array.from(activeWatchers.values()).map(w => w.watcher.close());
    await Promise.all(closePromises);
    
    activeWatchers.clear();
    return count;
}

/**
 * Get all active watchers
 */
export function getActiveWatchers(): ActiveWatcher[] {
    return Array.from(activeWatchers.values());
}

/**
 * Get a specific watcher
 */
export function getWatcher(path: string, project: string, dataset: string): ActiveWatcher | undefined {
    const watcherId = generateWatcherId(path, project, dataset);
    return activeWatchers.get(watcherId);
}

/**
 * Check if a path is being watched
 */
export function isWatching(path: string, project: string, dataset: string): boolean {
    const watcherId = generateWatcherId(path, project, dataset);
    return activeWatchers.has(watcherId);
}
