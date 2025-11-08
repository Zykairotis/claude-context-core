import { v4 as uuidv4 } from 'uuid';

export interface ProgressUpdate {
  operationId: string;
  operation: string;
  project: string;
  dataset?: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  phase: string;
  progress: number; // 0-100
  message: string;
  details?: any;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export class ProgressTracker {
  private static instance: ProgressTracker;
  private progressMap: Map<string, ProgressUpdate>;
  private ttl: number = 3600000; // 1 hour TTL
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    this.progressMap = new Map();
    
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  static getInstance(): ProgressTracker {
    if (!ProgressTracker.instance) {
      ProgressTracker.instance = new ProgressTracker();
    }
    return ProgressTracker.instance;
  }

  /**
   * Start tracking a new operation
   */
  startOperation(
    operation: string,
    project: string,
    dataset?: string,
    customId?: string
  ): string {
    const operationId = customId || uuidv4();
    const now = new Date().toISOString();
    
    const progress: ProgressUpdate = {
      operationId,
      operation,
      project,
      dataset,
      status: 'started',
      phase: 'Initializing',
      progress: 0,
      message: `Starting ${operation} for project ${project}`,
      startedAt: now,
      updatedAt: now
    };

    this.progressMap.set(operationId, progress);
    
    console.log(`[ProgressTracker] Started operation ${operationId}: ${operation} for ${project}/${dataset || 'default'}`);
    
    return operationId;
  }

  /**
   * Update progress for an operation
   */
  updateProgress(
    operationId: string,
    updates: Partial<Pick<ProgressUpdate, 'status' | 'phase' | 'progress' | 'message' | 'details' | 'error'>>
  ): void {
    const progress = this.progressMap.get(operationId);
    if (!progress) {
      console.warn(`[ProgressTracker] Operation ${operationId} not found`);
      return;
    }

    const now = new Date().toISOString();
    Object.assign(progress, {
      ...updates,
      updatedAt: now
    });

    // Set completedAt if status is completed or failed
    if (updates.status === 'completed' || updates.status === 'failed') {
      progress.completedAt = now;
    }

    this.progressMap.set(operationId, progress);
    
    console.log(
      `[ProgressTracker] Updated ${operationId}: ${progress.phase} - ${progress.progress}% - ${progress.message}`
    );
  }

  /**
   * Complete an operation
   */
  completeOperation(operationId: string, details?: any): void {
    this.updateProgress(operationId, {
      status: 'completed',
      progress: 100,
      phase: 'Complete',
      message: 'Operation completed successfully',
      details
    });
  }

  /**
   * Fail an operation
   */
  failOperation(operationId: string, error: string, details?: any): void {
    this.updateProgress(operationId, {
      status: 'failed',
      phase: 'Failed',
      message: 'Operation failed',
      error,
      details
    });
  }

  /**
   * Get progress for a specific operation
   */
  getProgress(operationId: string): ProgressUpdate | undefined {
    return this.progressMap.get(operationId);
  }

  /**
   * Get all progress for a project
   */
  getProjectProgress(project: string): ProgressUpdate[] {
    const results: ProgressUpdate[] = [];
    
    for (const progress of this.progressMap.values()) {
      if (progress.project === project) {
        results.push(progress);
      }
    }

    return results.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): ProgressUpdate[] {
    const results: ProgressUpdate[] = [];
    
    for (const progress of this.progressMap.values()) {
      if (progress.status === 'started' || progress.status === 'in_progress') {
        results.push(progress);
      }
    }

    return results.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Get all operations (limited to last 100)
   */
  getAllOperations(limit: number = 100): ProgressUpdate[] {
    const results = Array.from(this.progressMap.values())
      .sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

    return results.slice(0, limit);
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [id, progress] of this.progressMap.entries()) {
      // Keep active operations
      if (progress.status === 'started' || progress.status === 'in_progress') {
        continue;
      }

      // Remove completed/failed operations older than TTL
      const updatedTime = new Date(progress.updatedAt).getTime();
      if (now - updatedTime > this.ttl) {
        entriesToDelete.push(id);
      }
    }

    for (const id of entriesToDelete) {
      this.progressMap.delete(id);
    }

    if (entriesToDelete.length > 0) {
      console.log(`[ProgressTracker] Cleaned up ${entriesToDelete.length} old entries`);
    }
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Helper function for easier access
export function getProgressTracker(): ProgressTracker {
  return ProgressTracker.getInstance();
}
