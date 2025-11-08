/**
 * Dataset Parser Utility
 * 
 * Handles parsing of dataset input specifications including:
 * - Single dataset names
 * - Arrays of dataset names
 * - Wildcard "*" for all datasets
 * - Glob patterns like "github-*", "*-prod", etc.
 * - Semantic aliases like "env:dev", "src:code", "ver:latest"
 */

import { PatternLibrary } from './pattern-library';

export class DatasetParser {
  /**
   * Parse dataset input into a normalized array of dataset names
   * 
   * @param input - Dataset specification (string, array, or undefined)
   * @param availableDatasets - List of available dataset names
   * @returns Array of dataset names to query
   * 
   * @example
   * // Single dataset
   * parse("local", ["local", "docs"]) // => ["local"]
   * 
   * // Multiple datasets
   * parse(["local", "docs"], [...]) // => ["local", "docs"]
   * 
   * // Wildcard - all datasets
   * parse("*", ["local", "docs", "github-main"]) // => ["local", "docs", "github-main"]
   * 
   * // Glob pattern
   * parse("github-*", ["local", "github-main", "github-dev"]) // => ["github-main", "github-dev"]
   */
  static parse(
    input: string | string[] | undefined,
    availableDatasets: string[]
  ): string[] {
    // Handle undefined (search all datasets)
    if (input === undefined || input === null) {
      return availableDatasets;
    }
    
    // Normalize to array
    const datasets = Array.isArray(input) ? input : [input];
    
    // Handle empty array
    if (datasets.length === 0) {
      return availableDatasets;
    }
    
    // Handle wildcard - explicit "search all"
    if (datasets.length === 1 && datasets[0] === '*') {
      return availableDatasets;
    }
    
    // Process each pattern and collect matches
    const matches = new Set<string>();
    
    for (const pattern of datasets) {
      const patternMatches = this.matchPattern(pattern, availableDatasets);
      patternMatches.forEach(match => matches.add(match));
    }
    
    return Array.from(matches);
  }
  
  /**
   * Match a single pattern against available datasets
   * 
   * @param pattern - Dataset name, glob pattern, or semantic alias
   * @param available - List of available dataset names
   * @returns Array of matching dataset names
   */
  private static matchPattern(
    pattern: string,
    available: string[]
  ): string[] {
    // Check for semantic aliases first (env:dev, src:code, etc.)
    if (PatternLibrary.isAlias(pattern)) {
      return PatternLibrary.expand(pattern, available);
    }
    
    // Check if pattern contains glob characters
    if (pattern.includes('*') || pattern.includes('?')) {
      return this.matchGlobPattern(pattern, available);
    }
    
    // Exact match
    return available.includes(pattern) ? [pattern] : [];
  }
  
  /**
   * Match glob pattern against available datasets
   * 
   * Supports:
   * - * (matches any characters)
   * - ? (matches single character)
   * - Character classes [abc] (matches any char in brackets)
   * 
   * @param pattern - Glob pattern
   * @param available - List of available dataset names
   * @returns Array of matching dataset names
   */
  private static matchGlobPattern(
    pattern: string,
    available: string[]
  ): string[] {
    // Convert glob pattern to regex
    const regexPattern = this.globToRegex(pattern);
    const regex = new RegExp(regexPattern);
    
    return available.filter(dataset => regex.test(dataset));
  }
  
  /**
   * Convert glob pattern to regular expression
   * 
   * @param pattern - Glob pattern
   * @returns Regular expression string
   */
  private static globToRegex(pattern: string): string {
    // Escape special regex characters except glob chars
    let result = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
      .replace(/\*/g, '.*')                    // * matches any characters
      .replace(/\?/g, '.');                    // ? matches single character
    
    // Handle character classes [abc]
    // Already handled by escaping above - just restore brackets
    result = result.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
    
    return `^${result}$`;
  }
  
  /**
   * Validate dataset names exist in available list
   * Returns only valid dataset names and logs warnings for invalid ones
   * 
   * @param datasets - Dataset names to validate
   * @param available - List of available dataset names
   * @returns Array of valid dataset names
   */
  static validateDatasets(
    datasets: string[],
    available: string[],
    warnOnInvalid: boolean = true
  ): string[] {
    const valid: string[] = [];
    const availableSet = new Set(available);
    
    for (const dataset of datasets) {
      if (availableSet.has(dataset)) {
        valid.push(dataset);
      } else if (warnOnInvalid) {
        console.warn(`Dataset "${dataset}" not found in available datasets`);
      }
    }
    
    return valid;
  }
  
  /**
   * Common dataset pattern presets
   * Includes both glob patterns and semantic aliases
   */
  static readonly PATTERNS = {
    // Wildcard
    ALL: '*',
    
    // Glob patterns
    GITHUB_REPOS: 'github-*',
    CRAWLED_SITES: 'crawl-*',
    LOCAL: 'local*',
    DEV: '*-dev',
    PROD: '*-prod',
    MAIN_BRANCHES: '*-main',
    
    // Semantic aliases - Environment
    ENV_DEV: 'env:dev',
    ENV_PROD: 'env:prod',
    ENV_TEST: 'env:test',
    ENV_STAGING: 'env:staging',
    
    // Semantic aliases - Source
    SRC_CODE: 'src:code',
    SRC_DOCS: 'src:docs',
    SRC_API: 'src:api',
    SRC_WEB: 'src:web',
    SRC_DB: 'src:db',
    SRC_EXTERNAL: 'src:external',
    
    // Semantic aliases - Version
    VER_LATEST: 'ver:latest',
    VER_STABLE: 'ver:stable',
    VER_UNSTABLE: 'ver:unstable',
    
    // Semantic aliases - Branch
    BRANCH_MAIN: 'branch:main',
    BRANCH_FEATURE: 'branch:feature',
    BRANCH_HOTFIX: 'branch:hotfix',
    BRANCH_RELEASE: 'branch:release',
  } as const;
  
  /**
   * Get list of available pattern aliases with descriptions
   */
  static listPatterns(): Array<{
    pattern: string;
    name: string;
    description: string;
    category: string;
  }> {
    return PatternLibrary.listAliases();
  }
}
