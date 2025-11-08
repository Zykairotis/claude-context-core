/**
 * Multi-Dataset Query Tests
 * 
 * Tests for enhanced multi-dataset search functionality including:
 * - Single dataset queries (backward compatibility)
 * - Array of datasets
 * - Wildcard "*" to search all
 * - Glob patterns
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { DatasetParser } from '../../utils/dataset-parser';

describe('DatasetParser', () => {
  const availableDatasets = [
    'local',
    'docs',
    'api-ref',
    'github-main',
    'github-dev',
    'github-feature-auth',
    'crawl-docs-site',
    'crawl-api-site',
    'prod-db',
    'dev-db',
    'test-db'
  ];

  describe('parse() - Basic Functionality', () => {
    test('returns all datasets when input is undefined', () => {
      const result = DatasetParser.parse(undefined, availableDatasets);
      expect(result).toEqual(availableDatasets);
    });

    test('returns all datasets when input is null', () => {
      const result = DatasetParser.parse(null as any, availableDatasets);
      expect(result).toEqual(availableDatasets);
    });

    test('returns all datasets when input is empty array', () => {
      const result = DatasetParser.parse([], availableDatasets);
      expect(result).toEqual(availableDatasets);
    });

    test('handles single dataset string (exact match)', () => {
      const result = DatasetParser.parse('local', availableDatasets);
      expect(result).toEqual(['local']);
    });

    test('returns empty array for non-existent dataset', () => {
      const result = DatasetParser.parse('non-existent', availableDatasets);
      expect(result).toEqual([]);
    });
  });

  describe('parse() - Array Support', () => {
    test('handles array of multiple datasets', () => {
      const result = DatasetParser.parse(
        ['local', 'docs', 'api-ref'],
        availableDatasets
      );
      expect(result.sort()).toEqual(['api-ref', 'docs', 'local']);
    });

    test('filters out non-existent datasets from array', () => {
      const result = DatasetParser.parse(
        ['local', 'non-existent', 'docs'],
        availableDatasets
      );
      expect(result.sort()).toEqual(['docs', 'local']);
    });

    test('returns empty array when all datasets in array are invalid', () => {
      const result = DatasetParser.parse(
        ['invalid1', 'invalid2'],
        availableDatasets
      );
      expect(result).toEqual([]);
    });

    test('deduplicates datasets in array', () => {
      const result = DatasetParser.parse(
        ['local', 'docs', 'local', 'docs'],
        availableDatasets
      );
      expect(result.sort()).toEqual(['docs', 'local']);
    });
  });

  describe('parse() - Wildcard Support', () => {
    test('expands "*" to all available datasets', () => {
      const result = DatasetParser.parse('*', availableDatasets);
      expect(result).toEqual(availableDatasets);
    });

    test('treats "*" in array as wildcard', () => {
      const result = DatasetParser.parse(['*'], availableDatasets);
      expect(result).toEqual(availableDatasets);
    });

    test('ignores other patterns when "*" is present', () => {
      const result = DatasetParser.parse(['*', 'local'], availableDatasets);
      expect(result).toEqual(availableDatasets);
    });
  });

  describe('parse() - Glob Pattern Support', () => {
    test('matches "github-*" pattern', () => {
      const result = DatasetParser.parse('github-*', availableDatasets);
      expect(result.sort()).toEqual([
        'github-dev',
        'github-feature-auth',
        'github-main'
      ]);
    });

    test('matches "crawl-*" pattern', () => {
      const result = DatasetParser.parse('crawl-*', availableDatasets);
      expect(result.sort()).toEqual(['crawl-api-site', 'crawl-docs-site']);
    });

    test('matches "*-db" pattern (suffix)', () => {
      const result = DatasetParser.parse('*-db', availableDatasets);
      expect(result.sort()).toEqual(['dev-db', 'prod-db', 'test-db']);
    });

    test('matches "*-dev" pattern (environment)', () => {
      const result = DatasetParser.parse('*-dev', availableDatasets);
      expect(result.sort()).toEqual(['github-dev']);
    });

    test('matches "github-*-auth" pattern (infix)', () => {
      const result = DatasetParser.parse('github-*-auth', availableDatasets);
      expect(result).toEqual(['github-feature-auth']);
    });

    test('matches "local*" pattern (prefix only)', () => {
      const result = DatasetParser.parse('local*', availableDatasets);
      expect(result).toEqual(['local']);
    });

    test('returns empty for pattern with no matches', () => {
      const result = DatasetParser.parse('nonexistent-*', availableDatasets);
      expect(result).toEqual([]);
    });
  });

  describe('parse() - Question Mark Pattern', () => {
    test('matches single character with "?"', () => {
      const datasets = ['db1', 'db2', 'db3', 'db10'];
      const result = DatasetParser.parse('db?', datasets);
      expect(result.sort()).toEqual(['db1', 'db2', 'db3']);
    });

    test('handles multiple "?" characters', () => {
      const datasets = ['test-01', 'test-02', 'test-abc'];
      const result = DatasetParser.parse('test-??', datasets);
      expect(result.sort()).toEqual(['test-01', 'test-02']);
    });
  });

  describe('parse() - Mixed Patterns', () => {
    test('combines exact match and pattern in array', () => {
      const result = DatasetParser.parse(
        ['local', 'github-*'],
        availableDatasets
      );
      expect(result.sort()).toEqual([
        'github-dev',
        'github-feature-auth',
        'github-main',
        'local'
      ]);
    });

    test('combines multiple patterns in array', () => {
      const result = DatasetParser.parse(
        ['github-*', 'crawl-*'],
        availableDatasets
      );
      expect(result.sort()).toEqual([
        'crawl-api-site',
        'crawl-docs-site',
        'github-dev',
        'github-feature-auth',
        'github-main'
      ]);
    });

    test('deduplicates results from overlapping patterns', () => {
      const result = DatasetParser.parse(
        ['github-*', 'github-main', '*-main'],
        availableDatasets
      );
      const uniqueResults = Array.from(new Set(result)).sort();
      expect(result.sort()).toEqual(uniqueResults);
    });
  });

  describe('validateDatasets()', () => {
    test('returns only valid datasets', () => {
      const result = DatasetParser.validateDatasets(
        ['local', 'invalid', 'docs'],
        availableDatasets
      );
      expect(result.sort()).toEqual(['docs', 'local']);
    });

    test('warns on invalid datasets by default', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      DatasetParser.validateDatasets(
        ['local', 'invalid'],
        availableDatasets
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Dataset "invalid" not found in available datasets'
      );
      
      consoleSpy.mockRestore();
    });

    test('does not warn when warnOnInvalid is false', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      DatasetParser.validateDatasets(
        ['local', 'invalid'],
        availableDatasets,
        false
      );
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('returns empty array when all datasets are invalid', () => {
      const result = DatasetParser.validateDatasets(
        ['invalid1', 'invalid2'],
        availableDatasets
      );
      expect(result).toEqual([]);
    });
  });

  describe('Pattern Presets', () => {
    test('exports common pattern constants', () => {
      expect(DatasetParser.PATTERNS.ALL).toBe('*');
      expect(DatasetParser.PATTERNS.GITHUB_REPOS).toBe('github-*');
      expect(DatasetParser.PATTERNS.CRAWLED_SITES).toBe('crawl-*');
      expect(DatasetParser.PATTERNS.LOCAL).toBe('local*');
      expect(DatasetParser.PATTERNS.DEV).toBe('*-dev');
      expect(DatasetParser.PATTERNS.PROD).toBe('*-prod');
      expect(DatasetParser.PATTERNS.MAIN_BRANCHES).toBe('*-main');
    });

    test('exports semantic alias constants', () => {
      expect(DatasetParser.PATTERNS.ENV_DEV).toBe('env:dev');
      expect(DatasetParser.PATTERNS.ENV_PROD).toBe('env:prod');
      expect(DatasetParser.PATTERNS.SRC_CODE).toBe('src:code');
      expect(DatasetParser.PATTERNS.SRC_DOCS).toBe('src:docs');
      expect(DatasetParser.PATTERNS.VER_LATEST).toBe('ver:latest');
      expect(DatasetParser.PATTERNS.VER_STABLE).toBe('ver:stable');
      expect(DatasetParser.PATTERNS.BRANCH_MAIN).toBe('branch:main');
    });
  });

  describe('Semantic Aliases', () => {
    test('env:dev pattern expands to development datasets', () => {
      const result = DatasetParser.parse('env:dev', availableDatasets);
      expect(result).toContain('dev-db');
      expect(result).toContain('github-dev');
    });

    test('env:prod pattern expands to production datasets', () => {
      const result = DatasetParser.parse('env:prod', availableDatasets);
      expect(result).toContain('prod-db');
    });

    test('src:code pattern expands to code repositories', () => {
      const result = DatasetParser.parse('src:code', availableDatasets);
      expect(result).toContain('local');
      expect(result).toContain('github-main');
      expect(result).toContain('github-dev');
    });

    test('ver:stable filters out pre-release versions', () => {
      const versionedDatasets = [
        ...availableDatasets,
        'app-v1',
        'app-v2-beta',
        'app-v3-alpha'
      ];
      const result = DatasetParser.parse('ver:stable', versionedDatasets);
      expect(result).toContain('app-v1');
      expect(result).not.toContain('app-v2-beta');
      expect(result).not.toContain('app-v3-alpha');
    });

    test('can combine semantic aliases with exact matches', () => {
      const result = DatasetParser.parse(
        ['env:dev', 'local', 'docs'],
        availableDatasets
      );
      expect(result).toContain('local');
      expect(result).toContain('docs');
      expect(result).toContain('dev-db');
      expect(result).toContain('github-dev');
    });

    test('can combine semantic aliases with glob patterns', () => {
      const result = DatasetParser.parse(
        ['env:prod', 'github-*'],
        availableDatasets
      );
      expect(result).toContain('prod-db');
      expect(result).toContain('github-main');
      expect(result).toContain('github-dev');
    });
  });

  describe('listPatterns()', () => {
    test('returns available pattern descriptions', () => {
      const patterns = DatasetParser.listPatterns();
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('pattern');
      expect(patterns[0]).toHaveProperty('name');
      expect(patterns[0]).toHaveProperty('description');
      expect(patterns[0]).toHaveProperty('category');
    });

    test('includes all categories of patterns', () => {
      const patterns = DatasetParser.listPatterns();
      const categories = new Set(patterns.map(p => p.category));
      
      expect(categories).toContain('Environment');
      expect(categories).toContain('Source');
      expect(categories).toContain('Version');
      expect(categories).toContain('Branch');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty available datasets list', () => {
      const result = DatasetParser.parse('*', []);
      expect(result).toEqual([]);
    });

    test('handles special characters in dataset names', () => {
      const specialDatasets = ['dataset-v1.2', 'dataset_v2', 'dataset+test'];
      const result = DatasetParser.parse('dataset*', specialDatasets);
      expect(result.length).toBe(3);
    });

    test('handles dataset names with dots', () => {
      const dotDatasets = ['config.dev', 'config.prod', 'config.test'];
      const result = DatasetParser.parse('config.*', dotDatasets);
      expect(result.sort()).toEqual(['config.dev', 'config.prod', 'config.test']);
    });

    test('case-sensitive matching', () => {
      const caseDatasets = ['GitHub-Main', 'github-main'];
      const result = DatasetParser.parse('github-*', caseDatasets);
      expect(result).toEqual(['github-main']);
    });

    test('handles very long dataset lists efficiently', () => {
      const largeList = Array.from({ length: 1000 }, (_, i) => `dataset-${i}`);
      const start = Date.now();
      const result = DatasetParser.parse('dataset-5*', largeList);
      const duration = Date.now() - start;
      
      expect(result.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});

describe('Multi-Dataset Query Integration', () => {
  describe('Backward Compatibility', () => {
    test('single string dataset still works', () => {
      // This would be tested with actual queryProject function
      // For now, just validate the parser handles it correctly
      const result = DatasetParser.parse('local', ['local', 'docs']);
      expect(result).toEqual(['local']);
    });

    test('undefined dataset searches all (implicit wildcard)', () => {
      const result = DatasetParser.parse(undefined, ['local', 'docs']);
      expect(result).toEqual(['local', 'docs']);
    });
  });

  describe('Use Case Examples', () => {
    const datasets = [
      'local',
      'github-main',
      'github-dev',
      'github-feature-x',
      'docs',
      'api-docs',
      'prod-config',
      'dev-config'
    ];

    test('Search all GitHub repositories', () => {
      const result = DatasetParser.parse('github-*', datasets);
      expect(result.sort()).toEqual([
        'github-dev',
        'github-feature-x',
        'github-main'
      ]);
    });

    test('Search only documentation datasets', () => {
      const result = DatasetParser.parse(['docs', 'api-docs'], datasets);
      expect(result.sort()).toEqual(['api-docs', 'docs']);
    });

    test('Search all environment configs', () => {
      const result = DatasetParser.parse('*-config', datasets);
      expect(result.sort()).toEqual(['dev-config', 'prod-config']);
    });

    test('Search specific branch and docs', () => {
      const result = DatasetParser.parse(
        ['github-main', 'docs'],
        datasets
      );
      expect(result.sort()).toEqual(['docs', 'github-main']);
    });

    test('Search everything (explicit wildcard)', () => {
      const result = DatasetParser.parse('*', datasets);
      expect(result).toEqual(datasets);
    });
  });
});
