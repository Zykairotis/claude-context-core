/**
 * Scope management for knowledge island isolation.
 * 
 * This module provides three-tier scope management:
 * - Global: Shared knowledge across all projects
 * - Project: All datasets within a project  
 * - Local: Per-dataset within a project
 * 
 * Ported from Python implementation in services/crawl4ai-runner/app/storage/scope_manager.py
 */

import * as crypto from 'crypto';

/**
 * Knowledge scope levels
 */
export enum ScopeLevel {
  GLOBAL = 'global',
  PROJECT = 'project',
  LOCAL = 'local'
}

/**
 * Manages knowledge scope for storage and retrieval.
 * 
 * This class handles collection naming, scope resolution,
 * and filter generation for database queries.
 */
export class ScopeManager {
  // DNS namespace UUID for deterministic UUID generation
  private readonly DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  
  /**
   * Generate UUID v5 using crypto module
   * Implementation based on RFC 4122
   */
  private uuidv5(name: string, namespace: string): string {
    const hash = crypto.createHash('sha1');
    
    // Convert namespace UUID string to bytes
    const namespaceBytes = namespace.replace(/-/g, '');
    const nsBytes = Buffer.from(namespaceBytes, 'hex');
    
    // Create SHA1 hash of namespace + name
    hash.update(nsBytes);
    hash.update(name, 'utf8');
    const hashBytes = hash.digest();
    
    // Set version (5) and variant bits according to RFC 4122
    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50; // Version 5
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80; // Variant 10
    
    // Format as UUID string
    const hex = hashBytes.toString('hex');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }
  
  constructor(
    private defaultScope: ScopeLevel = ScopeLevel.LOCAL
  ) {}
  
  /**
   * Determine the appropriate scope level.
   * 
   * Logic:
   * - If requested_scope is 'global', return global
   * - If project AND dataset provided:
   *   - requested_scope='local' or default -> local
   *   - requested_scope='project' -> project
   * - If only project provided -> project
   * - Otherwise -> global
   */
  resolveScope(
    project?: string,
    dataset?: string,
    requestedScope?: string
  ): ScopeLevel {
    // Handle explicit global request
    if (requestedScope === 'global') {
      return ScopeLevel.GLOBAL;
    }
    
    // Convert requested scope to enum if valid
    let scopeEnum: ScopeLevel | undefined;
    if (requestedScope) {
      try {
        scopeEnum = requestedScope as ScopeLevel;
        if (!Object.values(ScopeLevel).includes(scopeEnum)) {
          scopeEnum = undefined;
        }
      } catch {
        scopeEnum = undefined;
      }
    }
    
    // Determine scope based on available context
    if (project && dataset) {
      // Both project and dataset: can be local or project
      if (scopeEnum === ScopeLevel.PROJECT) {
        return ScopeLevel.PROJECT;
      } else {
        return ScopeLevel.LOCAL;
      }
    } else if (project) {
      // Only project: must be project scope
      return ScopeLevel.PROJECT;
    } else {
      // No context: global scope
      return ScopeLevel.GLOBAL;
    }
  }
  
  /**
   * Generate collection name based on scope.
   * 
   * Collection naming:
   * - Global: 'global_knowledge'
   * - Project: 'project_{sanitized_project_name}'
   * - Local: 'project_{sanitized_project}_dataset_{sanitized_dataset}'
   */
  getCollectionName(
    project?: string,
    dataset?: string,
    scope?: ScopeLevel
  ): string {
    const resolvedScope = scope || this.resolveScope(project, dataset);
    
    if (resolvedScope === ScopeLevel.GLOBAL) {
      return 'global_knowledge';
    } else if (resolvedScope === ScopeLevel.PROJECT) {
      if (!project) {
        throw new Error('Project name required for project scope');
      }
      return `project_${this.sanitizeName(project)}`;
    } else {  // LOCAL
      if (!project || !dataset) {
        throw new Error('Project and dataset names required for local scope');
      }
      return `project_${this.sanitizeName(project)}_dataset_${this.sanitizeName(dataset)}`;
    }
  }
  
  /**
   * Generate deterministic UUID for project.
   * Uses uuid5 to ensure same project name always generates same UUID.
   */
  getProjectId(project?: string): string {
    if (!project) {
      return this.uuidv5('default', this.DNS_NAMESPACE);
    }
    return this.uuidv5(project, this.DNS_NAMESPACE);
  }
  
  /**
   * Generate deterministic UUID for dataset.
   * Uses uuid5 to ensure same dataset name always generates same UUID.
   */
  getDatasetId(dataset?: string): string {
    if (!dataset) {
      return this.uuidv5('default', this.DNS_NAMESPACE);
    }
    return this.uuidv5(dataset, this.DNS_NAMESPACE);
  }
  
  /**
   * Generate database filter for scope.
   * 
   * Filters:
   * - Global: scope='global'
   * - Project: scope='project' AND project_id=X
   * - Local: scope='local' AND project_id=X AND dataset_id=Y
   */
  filterByScope(
    scope: ScopeLevel,
    projectId?: string,
    datasetId?: string
  ): Record<string, any> {
    const filters: Record<string, any> = { scope: scope };
    
    if (scope === ScopeLevel.PROJECT) {
      if (!projectId) {
        throw new Error('Project ID required for project scope filter');
      }
      filters.project_id = projectId;
    } else if (scope === ScopeLevel.LOCAL) {
      if (!projectId || !datasetId) {
        throw new Error('Project and dataset IDs required for local scope filter');
      }
      filters.project_id = projectId;
      filters.dataset_id = datasetId;
    }
    
    return filters;
  }
  
  /**
   * Get list of accessible scopes given context.
   * 
   * Access rules:
   * - With project + dataset: can access local, project, global
   * - With project only: can access project, global
   * - No context: can access global only
   */
  getAccessibleScopes(
    project?: string,
    dataset?: string,
    includeGlobal: boolean = true
  ): ScopeLevel[] {
    const scopes: ScopeLevel[] = [];
    
    if (project && dataset) {
      scopes.push(ScopeLevel.LOCAL);
      scopes.push(ScopeLevel.PROJECT);
    } else if (project) {
      scopes.push(ScopeLevel.PROJECT);
    }
    
    if (includeGlobal) {
      scopes.push(ScopeLevel.GLOBAL);
    }
    
    return scopes.length > 0 ? scopes : [ScopeLevel.GLOBAL];
  }
  
  /**
   * Sanitize name for use in collection identifiers.
   * Replace non-alphanumeric characters with underscores and lowercase.
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')     // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_')              // Remove consecutive underscores  
      .replace(/^_+|_+$/g, '');         // Remove leading/trailing underscores
  }
}

// Export singleton instance for convenience
export const scopeManager = new ScopeManager();
