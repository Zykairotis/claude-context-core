/**
 * Pattern Library Tests
 * 
 * Tests for semantic alias expansion and advanced pattern matching
 */

import { describe, test, expect } from '@jest/globals';
import { PatternLibrary } from '../pattern-library';

describe('PatternLibrary', () => {
  const testDatasets = [
    // Development environments
    'api-dev',
    'db-dev',
    'frontend-development',
    'backend-staging',
    
    // Production environments
    'api-prod',
    'db-production',
    'frontend-live',
    'backend-prod',
    
    // Test environments
    'api-test',
    'db-testing',
    'frontend-qa',
    
    // Code repositories
    'local',
    'github-main',
    'github-dev',
    'github-feature-auth',
    'gitlab-api',
    'bitbucket-web',
    
    // Documentation
    'docs',
    'api-docs',
    'user-guide-docs',
    'wiki',
    'readme',
    
    // Web content
    'crawl-example-com',
    'crawl-docs-site',
    'web-scrape-data',
    
    // Versions
    'app-v1',
    'app-v2.0',
    'app-v2.1',
    'app-v3.0.0',
    'lib-v1-beta',
    'lib-v2-alpha',
    'lib-v3',
    
    // Branches
    'repo-main',
    'repo-master',
    'repo-feature-login',
    'repo-hotfix-bug123',
    'repo-release-v2',
    
    // Databases
    'db-prod',
    'postgres-db',
    'mysql-database'
  ];

  describe('Environment Patterns', () => {
    test('env:dev matches development datasets', () => {
      const result = PatternLibrary.expand('env:dev', testDatasets);
      expect(result.sort()).toEqual([
        'api-dev',
        'backend-staging',
        'db-dev',
        'frontend-development',
        'github-dev'
      ].sort());
    });

    test('env:prod matches production datasets', () => {
      const result = PatternLibrary.expand('env:prod', testDatasets);
      expect(result.sort()).toEqual([
        'api-prod',
        'backend-prod',
        'db-prod',
        'db-production',
        'frontend-live'
      ].sort());
    });

    test('env:test matches testing datasets', () => {
      const result = PatternLibrary.expand('env:test', testDatasets);
      expect(result.sort()).toEqual([
        'api-test',
        'db-testing',
        'frontend-qa'
      ].sort());
    });

    test('env:staging matches staging datasets', () => {
      const result = PatternLibrary.expand('env:staging', testDatasets);
      expect(result).toContain('backend-staging');
    });
  });

  describe('Source Patterns', () => {
    test('src:code matches code repository datasets', () => {
      const result = PatternLibrary.expand('src:code', testDatasets);
      expect(result.sort()).toEqual([
        'bitbucket-web',
        'github-dev',
        'github-feature-auth',
        'github-main',
        'gitlab-api',
        'local'
      ].sort());
    });

    test('src:docs matches documentation datasets', () => {
      const result = PatternLibrary.expand('src:docs', testDatasets);
      expect(result.sort()).toContain('docs');
      expect(result.sort()).toContain('api-docs');
      expect(result.sort()).toContain('wiki');
      expect(result.sort()).toContain('readme');
    });

    test('src:api matches API-related datasets', () => {
      const result = PatternLibrary.expand('src:api', testDatasets);
      expect(result).toContain('api-docs');
      expect(result).toContain('api-dev');
      expect(result).toContain('api-prod');
      expect(result).toContain('api-test');
    });

    test('src:web matches web-crawled content', () => {
      const result = PatternLibrary.expand('src:web', testDatasets);
      // bitbucket-web matches *-web pattern
      expect(result.sort()).toEqual([
        'bitbucket-web',
        'crawl-docs-site',
        'crawl-example-com',
        'web-scrape-data'
      ].sort());
    });

    test('src:db matches database datasets', () => {
      const result = PatternLibrary.expand('src:db', testDatasets);
      expect(result).toContain('db-dev');
      expect(result).toContain('db-prod');
      expect(result).toContain('postgres-db');
      expect(result).toContain('mysql-database');
    });
  });

  describe('Version Patterns', () => {
    test('ver:latest finds highest version for each base', () => {
      const result = PatternLibrary.expand('ver:latest', testDatasets);
      
      // Should include latest versions
      expect(result).toContain('app-v3.0.0'); // Latest app
      expect(result).toContain('lib-v3');      // Latest lib
      
      // Should not include older versions
      expect(result).not.toContain('app-v1');
      expect(result).not.toContain('app-v2.0');
      expect(result).not.toContain('lib-v1-beta');
    });

    test('ver:stable excludes pre-release versions', () => {
      const result = PatternLibrary.expand('ver:stable', testDatasets);
      
      // Should include stable versions
      expect(result).toContain('app-v1');
      expect(result).toContain('app-v2.0');
      expect(result).toContain('lib-v3');
      
      // Should exclude pre-release
      expect(result).not.toContain('lib-v1-beta');
      expect(result).not.toContain('lib-v2-alpha');
    });

    test('ver:unstable includes only pre-release versions', () => {
      const result = PatternLibrary.expand('ver:unstable', testDatasets);
      
      // Should include pre-release
      expect(result).toContain('lib-v1-beta');
      expect(result).toContain('lib-v2-alpha');
      
      // Should exclude stable
      expect(result).not.toContain('app-v1');
      expect(result).not.toContain('lib-v3');
    });
  });

  describe('Branch Patterns', () => {
    test('branch:main matches main and master branches', () => {
      const result = PatternLibrary.expand('branch:main', testDatasets);
      expect(result.sort()).toEqual([
        'github-main',
        'repo-main',
        'repo-master'
      ].sort());
    });

    test('branch:feature matches feature branches', () => {
      const result = PatternLibrary.expand('branch:feature', testDatasets);
      expect(result).toContain('repo-feature-login');
      expect(result).toContain('github-feature-auth');
    });

    test('branch:hotfix matches hotfix branches', () => {
      const result = PatternLibrary.expand('branch:hotfix', testDatasets);
      expect(result).toContain('repo-hotfix-bug123');
    });

    test('branch:release matches release branches', () => {
      const result = PatternLibrary.expand('branch:release', testDatasets);
      expect(result).toContain('repo-release-v2');
    });
  });

  describe('Pattern Recognition', () => {
    test('isAlias recognizes valid aliases', () => {
      expect(PatternLibrary.isAlias('env:dev')).toBe(true);
      expect(PatternLibrary.isAlias('src:code')).toBe(true);
      expect(PatternLibrary.isAlias('ver:latest')).toBe(true);
      expect(PatternLibrary.isAlias('branch:main')).toBe(true);
    });

    test('isAlias rejects invalid aliases', () => {
      expect(PatternLibrary.isAlias('invalid:pattern')).toBe(false);
      expect(PatternLibrary.isAlias('github-*')).toBe(false);
      expect(PatternLibrary.isAlias('local')).toBe(false);
    });

    test('expand returns empty array for unknown aliases', () => {
      const result = PatternLibrary.expand('unknown:alias', testDatasets);
      expect(result).toEqual([]);
    });
  });

  describe('Pattern Listing', () => {
    test('listAliases returns all available aliases', () => {
      const aliases = PatternLibrary.listAliases();
      
      expect(aliases.length).toBeGreaterThan(0);
      
      // Check structure
      const first = aliases[0];
      expect(first).toHaveProperty('pattern');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('description');
      expect(first).toHaveProperty('category');
      
      // Check categories exist
      const categories = new Set(aliases.map(a => a.category));
      expect(categories).toContain('Environment');
      expect(categories).toContain('Source');
      expect(categories).toContain('Version');
      expect(categories).toContain('Branch');
    });

    test('suggestPatterns finds relevant patterns', () => {
      const suggestions = PatternLibrary.suggestPatterns(testDatasets);
      
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Check structure
      const first = suggestions[0];
      expect(first).toHaveProperty('pattern');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('matchCount');
      expect(first.matchCount).toBeGreaterThan(0);
      
      // Should be sorted by match count (descending)
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].matchCount).toBeGreaterThanOrEqual(
          suggestions[i].matchCount
        );
      }
    });

    test('suggestPatterns only includes patterns with matches', () => {
      const emptyDatasets: string[] = [];
      const suggestions = PatternLibrary.suggestPatterns(emptyDatasets);
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('Complex Scenarios', () => {
    test('handles datasets with no version patterns', () => {
      const noVersionDatasets = ['local', 'docs', 'api'];
      const result = PatternLibrary.expand('ver:latest', noVersionDatasets);
      expect(result).toEqual([]);
    });

    test('handles datasets with no environment indicators', () => {
      const neutralDatasets = ['local', 'backup', 'archive'];
      const result = PatternLibrary.expand('env:dev', neutralDatasets);
      expect(result).toEqual([]);
    });

    test('version sorting handles different version formats', () => {
      const versionDatasets = [
        'app-v1',
        'app-v1.0',
        'app-v1.0.0',
        'app-v2',
        'app-v10',
        'app-v2.5',
        'app-v2.15',
        'app-v3.0.1'
      ];
      
      const result = PatternLibrary.expand('ver:latest', versionDatasets);
      
      // v10 is latest (not v3 which would be if string-sorted)
      expect(result).toContain('app-v10');
      expect(result).not.toContain('app-v1');
      expect(result).not.toContain('app-v2');
    });

    test('deduplicates overlapping pattern results', () => {
      // Some datasets might match multiple sub-patterns
      const result = PatternLibrary.expand('src:code', testDatasets);
      const uniqueResults = Array.from(new Set(result));
      
      expect(result).toEqual(uniqueResults);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty dataset list', () => {
      const result = PatternLibrary.expand('env:dev', []);
      expect(result).toEqual([]);
    });

    test('handles dataset names with special characters', () => {
      const specialDatasets = [
        'api.v2-dev',
        'backup-prod',
        'web-crawl@site.com'
      ];
      
      const devResult = PatternLibrary.expand('env:dev', specialDatasets);
      expect(devResult).toContain('api.v2-dev');
      
      const prodResult = PatternLibrary.expand('env:prod', specialDatasets);
      expect(prodResult).toContain('backup-prod');
    });

    test('case-sensitive matching', () => {
      const mixedCaseDatasets = ['API-DEV', 'api-dev', 'Api-Dev'];
      const result = PatternLibrary.expand('env:dev', mixedCaseDatasets);
      
      // Should match lowercase variants
      expect(result).toContain('api-dev');
      // May not match uppercase depending on pattern definition
    });
  });
});
