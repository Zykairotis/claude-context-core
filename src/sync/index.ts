/**
 * Sync Module - Incremental Local Indexing
 * Exports utilities for hash calculation, change detection, file metadata, and incremental sync
 */

export * from './hash-calculator';
export * from './change-detector';
export * from './file-metadata';
export * from './incremental-sync';
export * from './file-watcher';

/**
 * Re-export types for convenience
 */
export type {
    FileChange,
    ChangeSummary
} from './change-detector';

export type {
    FileMetadata
} from './file-metadata';

export type {
    SyncStats,
    SyncOptions,
    SyncProgress
} from './incremental-sync';

export type {
    WatcherOptions,
    ActiveWatcher
} from './file-watcher';
