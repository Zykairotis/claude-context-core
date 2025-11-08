/**
 * MCP Tool Helpers Tests
 * 
 * Tests for MCP tool helper functions that support multi-dataset search
 */

import { describe, test, expect } from '@jest/globals';
import {
  getDatasetPatterns,
  suggestDatasetPatterns,
  expandDatasetPattern,
  validateDatasetInput,
  formatDatasetExpansion,
  formatDatasetStats,
  formatSearchResults,
  createPatternGuide
} from '../mcp-tools';

describe('MCP Tool Helpers', () => {
  const testDatasets = [
    'local',
    'docs',
    'api-dev',
    'api-prod',
    'db-dev',
    'db-prod',
    'github-main',
    'github-dev',
    'crawl-docs-site'
  ];

  describe('getDatasetPatterns()', () => {
    test('returns pattern information', () => {
      const result = getDatasetPatterns();
      
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('suggestions');
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test('patterns have required properties', () => {
      const result = getDatasetPatterns();
      const first = result.patterns[0];
      
      expect(first).toHaveProperty('pattern');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('description');
      expect(first).toHaveProperty('category');
    });
  });

  describe('suggestDatasetPatterns()', () => {
    test('provides suggestions for available datasets', () => {
      const result = suggestDatasetPatterns(testDatasets);
      
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('suggestions');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    test('suggestions include match counts', () => {
      const result = suggestDatasetPatterns(testDatasets);
      
      if (result.suggestions.length > 0) {
        const first = result.suggestions[0];
        expect(first).toHaveProperty('pattern');
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('matchCount');
        expect(first.matchCount).toBeGreaterThan(0);
      }
    });

    test('suggestions are sorted by match count', () => {
      const result = suggestDatasetPatterns(testDatasets);
      
      for (let i = 1; i < result.suggestions.length; i++) {
        expect(result.suggestions[i - 1].matchCount).toBeGreaterThanOrEqual(
          result.suggestions[i].matchCount
        );
      }
    });
  });

  describe('expandDatasetPattern()', () => {
    test('expands wildcard to all datasets', () => {
      const result = expandDatasetPattern('*', testDatasets);
      
      expect(result.requested).toBe('*');
      expect(result.resolved).toEqual(testDatasets);
      expect(result.expandedFrom).toBe('*');
      expect(result.matchCount).toBe(testDatasets.length);
    });

    test('expands semantic alias', () => {
      const result = expandDatasetPattern('env:dev', testDatasets);
      
      expect(result.requested).toBe('env:dev');
      expect(result.resolved).toContain('api-dev');
      expect(result.resolved).toContain('db-dev');
      expect(result.resolved).toContain('github-dev');
      expect(result.expandedFrom).toBe('env:dev');
    });

    test('expands glob pattern', () => {
      const result = expandDatasetPattern('github-*', testDatasets);
      
      expect(result.requested).toBe('github-*');
      expect(result.resolved).toContain('github-main');
      expect(result.resolved).toContain('github-dev');
      expect(result.expandedFrom).toBe('github-*');
    });

    test('handles undefined as all datasets', () => {
      const result = expandDatasetPattern(undefined, testDatasets);
      
      expect(result.requested).toBe('*');
      expect(result.resolved).toEqual(testDatasets);
      expect(result.matchCount).toBe(testDatasets.length);
    });

    test('handles exact match', () => {
      const result = expandDatasetPattern('local', testDatasets);
      
      expect(result.requested).toBe('local');
      expect(result.resolved).toEqual(['local']);
      expect(result.matchCount).toBe(1);
    });

    test('handles array of datasets', () => {
      const result = expandDatasetPattern(['local', 'docs'], testDatasets);
      
      expect(result.requested).toEqual(['local', 'docs']);
      expect(result.resolved).toContain('local');
      expect(result.resolved).toContain('docs');
      expect(result.matchCount).toBe(2);
    });
  });

  describe('validateDatasetInput()', () => {
    test('validates undefined as valid', () => {
      const result = validateDatasetInput(undefined, testDatasets);
      
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    test('validates empty array as valid', () => {
      const result = validateDatasetInput([], testDatasets);
      
      expect(result.valid).toBe(true);
    });

    test('validates existing dataset', () => {
      const result = validateDatasetInput('local', testDatasets);
      
      expect(result.valid).toBe(true);
    });

    test('invalidates non-existent dataset', () => {
      const result = validateDatasetInput('non-existent', testDatasets);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    test('provides suggestions for invalid semantic alias', () => {
      const result = validateDatasetInput('env:invalid', testDatasets);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('env:invalid');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    test('invalidates glob pattern with no matches', () => {
      const result = validateDatasetInput('nonexistent-*', testDatasets);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('nonexistent-*');
    });

    test('validates glob pattern with matches', () => {
      const result = validateDatasetInput('github-*', testDatasets);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('formatDatasetExpansion()', () => {
    test('formats wildcard expansion', () => {
      const expansion = expandDatasetPattern('*', testDatasets);
      const formatted = formatDatasetExpansion(expansion);
      
      expect(formatted).toContain('Wildcard');
      expect(formatted).toContain(testDatasets.length.toString());
    });

    test('formats semantic alias expansion', () => {
      const expansion = expandDatasetPattern('env:dev', testDatasets);
      const formatted = formatDatasetExpansion(expansion);
      
      expect(formatted).toContain('Pattern');
      expect(formatted).toContain('env:dev');
      expect(formatted).toContain('matched');
    });

    test('formats glob pattern expansion', () => {
      const expansion = expandDatasetPattern('github-*', testDatasets);
      const formatted = formatDatasetExpansion(expansion);
      
      expect(formatted).toContain('Pattern');
      expect(formatted).toContain('github-*');
      expect(formatted).toContain('matched');
    });

    test('formats single dataset', () => {
      const expansion = expandDatasetPattern('local', testDatasets);
      const formatted = formatDatasetExpansion(expansion);
      
      expect(formatted).toContain('1 dataset');
      expect(formatted).toContain('local');
    });

    test('formats no matches', () => {
      const expansion = expandDatasetPattern('non-existent', testDatasets);
      const formatted = formatDatasetExpansion(expansion);
      
      expect(formatted).toContain('No datasets matched');
    });

    test('truncates long lists', () => {
      const manyDatasets = Array.from({ length: 10 }, (_, i) => `dataset-${i}`);
      // Use a glob pattern instead of wildcard to see dataset names
      const expansion = expandDatasetPattern('dataset-*', manyDatasets);
      const formatted = formatDatasetExpansion(expansion);
      
      // Should show match count and truncation
      expect(formatted).toContain('10 dataset(s)');
      expect(formatted).toContain('...');
      expect(formatted).toContain('dataset-');
    });
  });

  describe('formatDatasetStats()', () => {
    const sampleStats = [
      {
        datasetName: 'local',
        projectName: 'my-app',
        chunkCount: 100,
        pageCount: 10,
        lastIndexed: new Date('2025-01-01')
      },
      {
        datasetName: 'docs',
        projectName: 'my-app',
        chunkCount: 200,
        pageCount: 20,
        lastIndexed: new Date('2025-01-02')
      }
    ];

    test('formats stats summary', () => {
      const formatted = formatDatasetStats(sampleStats);
      
      expect(formatted).toContain('2 dataset(s)');
      expect(formatted).toContain('300'); // Total chunks
      expect(formatted).toContain('30');  // Total pages
    });

    test('includes individual dataset info', () => {
      const formatted = formatDatasetStats(sampleStats);
      
      expect(formatted).toContain('local');
      expect(formatted).toContain('docs');
      expect(formatted).toContain('100 chunks');
      expect(formatted).toContain('200 chunks');
    });

    test('handles empty stats', () => {
      const formatted = formatDatasetStats([]);
      
      expect(formatted).toContain('No dataset statistics');
    });

    test('truncates long lists', () => {
      const manyStats = Array.from({ length: 15 }, (_, i) => ({
        datasetName: `dataset-${i}`,
        projectName: 'my-app',
        chunkCount: 100,
        pageCount: 10,
        lastIndexed: new Date()
      }));
      
      const formatted = formatDatasetStats(manyStats);
      
      expect(formatted).toContain('and 5 more datasets');
    });
  });

  describe('formatSearchResults()', () => {
    const sampleResults = [
      {
        document: {
          content: 'This is a test document with some content that should be displayed'
        },
        score: 0.95,
        dataset: {
          project: 'my-app',
          dataset: 'local',
          datasetId: '123'
        }
      },
      {
        document: {
          content: 'Another test document'
        },
        score: 0.85,
        dataset: {
          project: 'my-app',
          dataset: 'docs',
          datasetId: '456'
        }
      }
    ];

    test('formats search results', () => {
      const formatted = formatSearchResults(sampleResults, 'test query', 2);
      
      expect(formatted).toContain('Found 2 result(s)');
      expect(formatted).toContain('test query');
      expect(formatted).toContain('my-app/local');
      expect(formatted).toContain('my-app/docs');
    });

    test('includes scores', () => {
      const formatted = formatSearchResults(sampleResults, 'test', 1);
      
      expect(formatted).toContain('95.0%');
      expect(formatted).toContain('85.0%');
    });

    test('truncates long content', () => {
      const longContent = 'a'.repeat(300);
      const results = [{
        document: { content: longContent },
        score: 0.9,
        dataset: { project: 'test', dataset: 'test', datasetId: '1' }
      }];
      
      const formatted = formatSearchResults(results, 'test', 1);
      
      expect(formatted).toContain('...');
      expect(formatted.length).toBeLessThan(longContent.length + 200);
    });

    test('handles empty results', () => {
      const formatted = formatSearchResults([], 'test query', 0);
      
      expect(formatted).toContain('No results found');
      expect(formatted).toContain('test query');
    });

    test('truncates long result lists', () => {
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        document: { content: `Result ${i}` },
        score: 0.9 - i * 0.05,
        dataset: { project: 'test', dataset: 'test', datasetId: `${i}` }
      }));
      
      const formatted = formatSearchResults(manyResults, 'test', 1);
      
      expect(formatted).toContain('and 5 more results');
    });
  });

  describe('createPatternGuide()', () => {
    test('creates comprehensive pattern guide', () => {
      const guide = createPatternGuide();
      
      expect(guide).toContain('Dataset Pattern Guide');
      expect(guide).toContain('Environment Patterns');
      expect(guide).toContain('Source Patterns');
      expect(guide).toContain('Version Patterns');
      expect(guide).toContain('Branch Patterns');
      expect(guide).toContain('Glob Patterns');
    });

    test('includes semantic alias examples', () => {
      const guide = createPatternGuide();
      
      expect(guide).toContain('env:dev');
      expect(guide).toContain('src:code');
      expect(guide).toContain('ver:latest');
      expect(guide).toContain('branch:main');
    });

    test('includes glob pattern examples', () => {
      const guide = createPatternGuide();
      
      expect(guide).toContain('github-*');
      expect(guide).toContain('*-prod');
      expect(guide).toContain('db-?');
    });

    test('includes special patterns', () => {
      const guide = createPatternGuide();
      
      expect(guide).toContain('*');
      expect(guide).toContain('["local", "docs"]');
    });
  });
});
