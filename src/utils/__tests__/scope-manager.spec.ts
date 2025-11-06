/**
 * Unit tests for ScopeManager
 * Ensures TypeScript implementation matches Python behavior
 */

import { ScopeManager, ScopeLevel } from '../scope-manager';

describe('ScopeManager', () => {
  let scopeManager: ScopeManager;

  beforeEach(() => {
    scopeManager = new ScopeManager();
  });

  describe('resolveScope', () => {
    it('should return GLOBAL when explicitly requested', () => {
      expect(scopeManager.resolveScope('project', 'dataset', 'global')).toBe(ScopeLevel.GLOBAL);
      expect(scopeManager.resolveScope(undefined, undefined, 'global')).toBe(ScopeLevel.GLOBAL);
    });

    it('should return LOCAL when project and dataset provided without explicit scope', () => {
      expect(scopeManager.resolveScope('myproject', 'mydataset')).toBe(ScopeLevel.LOCAL);
      expect(scopeManager.resolveScope('myproject', 'mydataset', 'local')).toBe(ScopeLevel.LOCAL);
    });

    it('should return PROJECT when project and dataset provided with project scope', () => {
      expect(scopeManager.resolveScope('myproject', 'mydataset', 'project')).toBe(ScopeLevel.PROJECT);
    });

    it('should return PROJECT when only project provided', () => {
      expect(scopeManager.resolveScope('myproject')).toBe(ScopeLevel.PROJECT);
      expect(scopeManager.resolveScope('myproject', undefined, 'local')).toBe(ScopeLevel.PROJECT);
    });

    it('should return GLOBAL when no context provided', () => {
      expect(scopeManager.resolveScope()).toBe(ScopeLevel.GLOBAL);
      expect(scopeManager.resolveScope(undefined, undefined)).toBe(ScopeLevel.GLOBAL);
    });

    it('should handle invalid scope requests gracefully', () => {
      expect(scopeManager.resolveScope('project', 'dataset', 'invalid')).toBe(ScopeLevel.LOCAL);
      expect(scopeManager.resolveScope('project', undefined, 'invalid')).toBe(ScopeLevel.PROJECT);
    });
  });

  describe('getCollectionName', () => {
    it('should return global_knowledge for global scope', () => {
      expect(scopeManager.getCollectionName()).toBe('global_knowledge');
      expect(scopeManager.getCollectionName(undefined, undefined, ScopeLevel.GLOBAL)).toBe('global_knowledge');
    });

    it('should return project_{name} for project scope', () => {
      expect(scopeManager.getCollectionName('MyProject')).toBe('project_myproject');
      expect(scopeManager.getCollectionName('my-project')).toBe('project_my_project');
      expect(scopeManager.getCollectionName('my.project')).toBe('project_my_project');
      expect(scopeManager.getCollectionName('MyProject', undefined, ScopeLevel.PROJECT)).toBe('project_myproject');
    });

    it('should return project_{project}_dataset_{dataset} for local scope', () => {
      expect(scopeManager.getCollectionName('MyProject', 'MyDataset')).toBe('project_myproject_dataset_mydataset');
      expect(scopeManager.getCollectionName('my-project', 'my-dataset')).toBe('project_my_project_dataset_my_dataset');
      expect(scopeManager.getCollectionName('my.project', 'my.dataset')).toBe('project_my_project_dataset_my_dataset');
    });

    it('should throw error when project required but missing', () => {
      expect(() => scopeManager.getCollectionName(undefined, undefined, ScopeLevel.PROJECT))
        .toThrow('Project name required for project scope');
    });

    it('should throw error when project or dataset missing for local scope', () => {
      expect(() => scopeManager.getCollectionName(undefined, 'dataset', ScopeLevel.LOCAL))
        .toThrow('Project and dataset names required for local scope');
      expect(() => scopeManager.getCollectionName('project', undefined, ScopeLevel.LOCAL))
        .toThrow('Project and dataset names required for local scope');
    });

    it('should sanitize names correctly', () => {
      // Test various special characters
      expect(scopeManager.getCollectionName('My Project!', 'My Dataset#')).toBe('project_my_project_dataset_my_dataset');
      expect(scopeManager.getCollectionName('my@project', 'my$dataset')).toBe('project_my_project_dataset_my_dataset');
      expect(scopeManager.getCollectionName('my__project', 'my___dataset')).toBe('project_my_project_dataset_my_dataset');
      expect(scopeManager.getCollectionName('_project_', '_dataset_')).toBe('project_project_dataset_dataset');
      expect(scopeManager.getCollectionName('PROJECT123', 'DATASET456')).toBe('project_project123_dataset_dataset456');
    });

    it('should handle edge cases in sanitization', () => {
      // Empty after sanitization should still work
      expect(scopeManager.getCollectionName('123', '456')).toBe('project_123_dataset_456');
      // Unicode characters
      expect(scopeManager.getCollectionName('café', 'naïve')).toBe('project_caf_dataset_na_ve');
      // Very long names
      const longName = 'a'.repeat(100);
      expect(scopeManager.getCollectionName(longName, longName)).toBe(`project_${longName}_dataset_${longName}`);
    });
  });

  describe('getProjectId', () => {
    it('should generate deterministic UUIDs for projects', () => {
      const id1 = scopeManager.getProjectId('myproject');
      const id2 = scopeManager.getProjectId('myproject');
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate different UUIDs for different projects', () => {
      const id1 = scopeManager.getProjectId('project1');
      const id2 = scopeManager.getProjectId('project2');
      expect(id1).not.toBe(id2);
    });

    it('should return consistent default UUID when project is undefined', () => {
      const defaultId1 = scopeManager.getProjectId();
      const defaultId2 = scopeManager.getProjectId();
      expect(defaultId1).toBe(defaultId2);
      expect(defaultId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate consistent UUIDs for known project names', () => {
      // Verify deterministic generation
      const testCases = [
        'myproject',
        'test', 
        'claude-context'
      ];

      testCases.forEach((name) => {
        const id1 = scopeManager.getProjectId(name);
        const id2 = scopeManager.getProjectId(name);
        expect(id1).toBe(id2);
        expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });
    });
  });

  describe('getDatasetId', () => {
    it('should generate deterministic UUIDs for datasets', () => {
      const id1 = scopeManager.getDatasetId('mydataset');
      const id2 = scopeManager.getDatasetId('mydataset');
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate different UUIDs for different datasets', () => {
      const id1 = scopeManager.getDatasetId('dataset1');
      const id2 = scopeManager.getDatasetId('dataset2');
      expect(id1).not.toBe(id2);
    });

    it('should return consistent default UUID when dataset is undefined', () => {
      const defaultId1 = scopeManager.getDatasetId();
      const defaultId2 = scopeManager.getDatasetId();
      expect(defaultId1).toBe(defaultId2);
      expect(defaultId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('filterByScope', () => {
    it('should generate correct filter for GLOBAL scope', () => {
      const filter = scopeManager.filterByScope(ScopeLevel.GLOBAL);
      expect(filter).toEqual({ scope: 'global' });
    });

    it('should generate correct filter for PROJECT scope', () => {
      const projectId = 'proj-123';
      const filter = scopeManager.filterByScope(ScopeLevel.PROJECT, projectId);
      expect(filter).toEqual({ 
        scope: 'project',
        project_id: projectId 
      });
    });

    it('should generate correct filter for LOCAL scope', () => {
      const projectId = 'proj-123';
      const datasetId = 'data-456';
      const filter = scopeManager.filterByScope(ScopeLevel.LOCAL, projectId, datasetId);
      expect(filter).toEqual({ 
        scope: 'local',
        project_id: projectId,
        dataset_id: datasetId
      });
    });

    it('should throw error when project ID missing for PROJECT scope', () => {
      expect(() => scopeManager.filterByScope(ScopeLevel.PROJECT))
        .toThrow('Project ID required for project scope filter');
    });

    it('should throw error when IDs missing for LOCAL scope', () => {
      expect(() => scopeManager.filterByScope(ScopeLevel.LOCAL))
        .toThrow('Project and dataset IDs required for local scope filter');
      expect(() => scopeManager.filterByScope(ScopeLevel.LOCAL, 'proj-123'))
        .toThrow('Project and dataset IDs required for local scope filter');
      expect(() => scopeManager.filterByScope(ScopeLevel.LOCAL, undefined, 'data-456'))
        .toThrow('Project and dataset IDs required for local scope filter');
    });
  });

  describe('getAccessibleScopes', () => {
    it('should return all scopes when project and dataset provided', () => {
      const scopes = scopeManager.getAccessibleScopes('project', 'dataset');
      expect(scopes).toEqual([ScopeLevel.LOCAL, ScopeLevel.PROJECT, ScopeLevel.GLOBAL]);
    });

    it('should return project and global when only project provided', () => {
      const scopes = scopeManager.getAccessibleScopes('project');
      expect(scopes).toEqual([ScopeLevel.PROJECT, ScopeLevel.GLOBAL]);
    });

    it('should return only global when no context provided', () => {
      const scopes = scopeManager.getAccessibleScopes();
      expect(scopes).toEqual([ScopeLevel.GLOBAL]);
    });

    it('should exclude global when includeGlobal is false', () => {
      const scopes1 = scopeManager.getAccessibleScopes('project', 'dataset', false);
      expect(scopes1).toEqual([ScopeLevel.LOCAL, ScopeLevel.PROJECT]);

      const scopes2 = scopeManager.getAccessibleScopes('project', undefined, false);
      expect(scopes2).toEqual([ScopeLevel.PROJECT]);

      const scopes3 = scopeManager.getAccessibleScopes(undefined, undefined, false);
      expect(scopes3).toEqual([ScopeLevel.GLOBAL]); // Still returns global as fallback
    });
  });

  describe('Integration scenarios', () => {
    it('should handle typical codebase indexing flow', () => {
      const project = 'claude-context';
      const dataset = 'core-library';
      
      // Resolve scope
      const scope = scopeManager.resolveScope(project, dataset);
      expect(scope).toBe(ScopeLevel.LOCAL);
      
      // Get collection name
      const collectionName = scopeManager.getCollectionName(project, dataset);
      expect(collectionName).toBe('project_claude_context_dataset_core_library');
      
      // Get IDs for metadata
      const projectId = scopeManager.getProjectId(project);
      const datasetId = scopeManager.getDatasetId(dataset);
      expect(projectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(datasetId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Generate filter for queries
      const filter = scopeManager.filterByScope(scope, projectId, datasetId);
      expect(filter).toEqual({
        scope: 'local',
        project_id: projectId,
        dataset_id: datasetId
      });
    });

    it('should handle web crawl ingestion flow', () => {
      const project = 'documentation';
      const dataset = 'react-docs';
      const requestedScope = 'project'; // Share docs across project
      
      // Resolve scope with explicit request
      const scope = scopeManager.resolveScope(project, dataset, requestedScope);
      expect(scope).toBe(ScopeLevel.PROJECT);
      
      // Get collection name for project-wide sharing
      const collectionName = scopeManager.getCollectionName(project, dataset, scope);
      expect(collectionName).toBe('project_documentation');
      
      // Check accessible scopes for queries
      const accessibleScopes = scopeManager.getAccessibleScopes(project, dataset);
      expect(accessibleScopes).toContain(ScopeLevel.PROJECT);
      expect(accessibleScopes).toContain(ScopeLevel.GLOBAL);
    });

    it('should handle global knowledge base', () => {
      const scope = scopeManager.resolveScope(undefined, undefined, 'global');
      expect(scope).toBe(ScopeLevel.GLOBAL);
      
      const collectionName = scopeManager.getCollectionName(undefined, undefined, scope);
      expect(collectionName).toBe('global_knowledge');
      
      const filter = scopeManager.filterByScope(scope);
      expect(filter).toEqual({ scope: 'global' });
    });
  });
});
