/**
 * Unit tests for Auto-Scoping System
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  generateProjectId,
  verifyProjectId,
  parseProjectId,
  generateDatasetName,
  autoDetectScope,
  AutoScoping
} from '../auto-scoping';

describe('Auto-Scoping System', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), 'auto-scope-test-' + Math.random().toString(36).substring(7));
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  describe('generateProjectId', () => {
    it('should generate deterministic project ID with 8-char hashes', async () => {
      const testPath = path.join(tempDir, 'test-project');
      await fs.mkdir(testPath, { recursive: true });
      
      const id1 = await generateProjectId(testPath);
      const id2 = await generateProjectId(testPath);
      
      // Should be deterministic
      expect(id1.id).toBe(id2.id);
      expect(id1.pathHash).toBe(id2.pathHash);
      
      // Check hash lengths
      expect(id1.prefix).toHaveLength(8);
      expect(id1.suffix).toHaveLength(8);
      
      // Check format
      expect(id1.id).toMatch(/^[A-Za-z0-9]{8}-test-project-[A-Za-z0-9]{8}$/);
    });
    
    it('should sanitize folder names correctly', async () => {
      const testPath = path.join(tempDir, 'My.Special-Project!@#');
      await fs.mkdir(testPath, { recursive: true });
      
      const id = await generateProjectId(testPath);
      
      // Special characters should be replaced with dashes
      expect(id.folderName).toBe('My.Special-Project!@#');
      expect(id.id).toMatch(/^[A-Za-z0-9]{8}-my-special-project-[A-Za-z0-9]{8}$/);
    });
    
    it('should generate different IDs for different paths', async () => {
      const path1 = path.join(tempDir, 'project-a');
      const path2 = path.join(tempDir, 'project-b');
      await fs.mkdir(path1, { recursive: true });
      await fs.mkdir(path2, { recursive: true });
      
      const id1 = await generateProjectId(path1);
      const id2 = await generateProjectId(path2);
      
      // Different paths should have different IDs
      expect(id1.id).not.toBe(id2.id);
      expect(id1.prefix).not.toBe(id2.prefix);
      expect(id1.suffix).not.toBe(id2.suffix);
    });
    
    it('should handle same folder names in different locations', async () => {
      const path1 = path.join(tempDir, 'company-a', 'my-app');
      const path2 = path.join(tempDir, 'company-b', 'my-app');
      await fs.mkdir(path1, { recursive: true });
      await fs.mkdir(path2, { recursive: true });
      
      const id1 = await generateProjectId(path1);
      const id2 = await generateProjectId(path2);
      
      // Same folder name but different paths
      expect(id1.folderName).toBe('my-app');
      expect(id2.folderName).toBe('my-app');
      
      // But different IDs due to different paths
      expect(id1.id).not.toBe(id2.id);
      expect(id1.prefix).not.toBe(id2.prefix);
      expect(id1.suffix).not.toBe(id2.suffix);
    });
    
    it('should throw error for non-existent path', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');
      
      await expect(generateProjectId(nonExistentPath)).rejects.toThrow('Path does not exist');
    });
  });
  
  describe('verifyProjectId', () => {
    it('should verify correct project ID', async () => {
      const testPath = path.join(tempDir, 'verify-test');
      await fs.mkdir(testPath, { recursive: true });
      
      const id = await generateProjectId(testPath);
      const isValid = await verifyProjectId(id, testPath);
      
      expect(isValid).toBe(true);
    });
    
    it('should reject incorrect path', async () => {
      const path1 = path.join(tempDir, 'project-one');
      const path2 = path.join(tempDir, 'project-two');
      await fs.mkdir(path1, { recursive: true });
      await fs.mkdir(path2, { recursive: true });
      
      const id = await generateProjectId(path1);
      const isValid = await verifyProjectId(id, path2);
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('parseProjectId', () => {
    it('should parse valid project ID', () => {
      const projectId = 'Wx4aBcDe-my-project-Ty8cDeFg';
      const parsed = parseProjectId(projectId);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.prefix).toBe('Wx4aBcDe');
      expect(parsed?.folderName).toBe('my-project');
      expect(parsed?.suffix).toBe('Ty8cDeFg');
    });
    
    it('should handle folder names with dashes', () => {
      const projectId = 'Wx4aBcDe-my-awesome-project-Ty8cDeFg';
      const parsed = parseProjectId(projectId);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.prefix).toBe('Wx4aBcDe');
      expect(parsed?.folderName).toBe('my-awesome-project');
      expect(parsed?.suffix).toBe('Ty8cDeFg');
    });
    
    it('should return null for invalid format', () => {
      const invalid1 = 'not-a-valid-id';
      const invalid2 = 'short-id';
      const invalid3 = 'Wx4aB-project-Ty8cD'; // Wrong hash length
      
      expect(parseProjectId(invalid1)).toBeNull();
      expect(parseProjectId(invalid2)).toBeNull();
      expect(parseProjectId(invalid3)).toBeNull();
    });
  });
  
  describe('generateDatasetName', () => {
    it('should generate local dataset name', () => {
      const dataset = generateDatasetName('local');
      
      expect(dataset.name).toBe('local');
      expect(dataset.source).toBe('local');
      expect(dataset.identifier).toBeUndefined();
    });
    
    it('should generate github dataset name', () => {
      const dataset = generateDatasetName('github', 'nodejs/node');
      
      expect(dataset.name).toBe('github-nodejs-node');
      expect(dataset.source).toBe('github');
      expect(dataset.identifier).toBe('nodejs/node');
    });
    
    it('should generate crawl dataset name', () => {
      const dataset = generateDatasetName('crawl', 'https://docs.nodejs.org');
      
      expect(dataset.name).toBe('crawl-docs-nodejs-org');
      expect(dataset.source).toBe('crawl');
      expect(dataset.identifier).toBe('https://docs.nodejs.org');
    });
    
    it('should generate manual dataset name', () => {
      const dataset = generateDatasetName('manual', 'experiments');
      
      expect(dataset.name).toBe('manual-experiments');
      expect(dataset.source).toBe('manual');
      expect(dataset.identifier).toBe('experiments');
    });
    
    it('should throw error for missing identifiers', () => {
      expect(() => generateDatasetName('github')).toThrow('GitHub dataset requires repo identifier');
      expect(() => generateDatasetName('crawl')).toThrow('Crawl dataset requires URL identifier');
      expect(() => generateDatasetName('manual')).toThrow('Manual dataset requires identifier');
    });
    
    it('should sanitize identifiers', () => {
      const github = generateDatasetName('github', 'Microsoft/TypeScript');
      expect(github.name).toBe('github-microsoft-typescript');
      
      const crawl = generateDatasetName('crawl', 'https://api.example.com/v2/docs');
      expect(crawl.name).toBe('crawl-api-example-com');
      
      const manual = generateDatasetName('manual', 'Test@Dataset#123');
      expect(manual.name).toBe('manual-test-dataset-123');
    });
  });
  
  describe('autoDetectScope', () => {
    it('should auto-detect project and dataset for local indexing', async () => {
      const testPath = path.join(tempDir, 'auto-detect-test');
      await fs.mkdir(testPath, { recursive: true });
      
      const scope = await autoDetectScope(testPath, 'local');
      
      expect(scope.projectId).toMatch(/^[A-Za-z0-9]{8}-auto-detect-test-[A-Za-z0-9]{8}$/);
      expect(scope.datasetName).toBe('local');
      expect(scope.source).toBe('detected');
      expect(scope.detectedFrom).toBe(testPath);
      expect(scope.timestamp).toBeDefined();
    });
    
    it('should use overrides when provided', async () => {
      const testPath = path.join(tempDir, 'override-test');
      await fs.mkdir(testPath, { recursive: true });
      
      const scope = await autoDetectScope(testPath, 'local', {
        project: 'custom-project-id',
        dataset: 'custom-dataset'
      });
      
      expect(scope.projectId).toBe('custom-project-id');
      expect(scope.datasetName).toBe('custom-dataset');
      expect(scope.source).toBe('override');
    });
    
    it('should detect GitHub dataset correctly', async () => {
      const testPath = path.join(tempDir, 'github-test');
      await fs.mkdir(testPath, { recursive: true });
      
      const scope = await autoDetectScope(testPath, 'github', {
        identifier: 'microsoft/vscode'
      });
      
      expect(scope.projectId).toMatch(/^[A-Za-z0-9]{8}-github-test-[A-Za-z0-9]{8}$/);
      expect(scope.datasetName).toBe('github-microsoft-vscode');
      expect(scope.source).toBe('detected');
    });
    
    it('should detect crawl dataset correctly', async () => {
      const testPath = path.join(tempDir, 'crawl-test');
      await fs.mkdir(testPath, { recursive: true });
      
      const scope = await autoDetectScope(testPath, 'crawl', {
        identifier: 'https://docs.example.com'
      });
      
      expect(scope.projectId).toMatch(/^[A-Za-z0-9]{8}-crawl-test-[A-Za-z0-9]{8}$/);
      expect(scope.datasetName).toBe('crawl-docs-example-com');
      expect(scope.source).toBe('detected');
    });
  });
  
  describe('AutoScoping namespace', () => {
    it('should export all functions through namespace', () => {
      expect(AutoScoping.generateProjectId).toBeDefined();
      expect(AutoScoping.verifyProjectId).toBeDefined();
      expect(AutoScoping.parseProjectId).toBeDefined();
      expect(AutoScoping.generateDatasetName).toBeDefined();
      expect(AutoScoping.autoDetectScope).toBeDefined();
      expect(AutoScoping.CONFIG).toBeDefined();
      expect(AutoScoping.CONFIG.HASH_LENGTH).toBe(8);
    });
  });
});
