/**
 * Pattern Library for Advanced Dataset Matching
 * 
 * Provides semantic aliases and pattern expansion for common dataset queries.
 * Supports environment-based, source-based, and version-based pattern matching.
 */

export type PatternExpander = (datasets: string[]) => string[];

export interface PatternAlias {
  name: string;
  description: string;
  expander: string[] | PatternExpander;
}

/**
 * Advanced Pattern Library with semantic aliases
 */
export class PatternLibrary {
  /**
   * Environment-based patterns
   */
  static readonly ENVIRONMENT_PATTERNS: Record<string, PatternAlias> = {
    'env:dev': {
      name: 'Development Environments',
      description: 'All development, staging, and dev-related datasets',
      expander: ['*-dev', '*-development', '*-staging', 'dev-*', 'development-*', 'staging-*']
    },
    'env:prod': {
      name: 'Production Environments',
      description: 'All production and live datasets',
      expander: ['*-prod', '*-production', '*-live', 'prod-*', 'production-*', 'live-*']
    },
    'env:test': {
      name: 'Testing Environments',
      description: 'All test, QA, and testing datasets',
      expander: ['*-test', '*-testing', '*-qa', 'test-*', 'testing-*', 'qa-*']
    },
    'env:staging': {
      name: 'Staging Environments',
      description: 'Staging and pre-production datasets',
      expander: ['*-staging', '*-stage', 'staging-*', 'stage-*']
    }
  };

  /**
   * Source-based patterns
   */
  static readonly SOURCE_PATTERNS: Record<string, PatternAlias> = {
    'src:code': {
      name: 'Code Repositories',
      description: 'All code repository datasets (GitHub, GitLab, local)',
      expander: ['local', 'github-*', 'gitlab-*', 'bitbucket-*']
    },
    'src:docs': {
      name: 'Documentation',
      description: 'All documentation and wiki datasets',
      expander: ['docs', 'documentation', '*-docs', 'wiki', '*-wiki', 'readme', '*-readme']
    },
    'src:api': {
      name: 'API Documentation',
      description: 'API reference and external API datasets',
      expander: ['api-*', '*-api', 'api-docs', 'api-ref', 'swagger', 'openapi']
    },
    'src:web': {
      name: 'Web Crawled Content',
      description: 'All web-crawled and external web content',
      expander: ['crawl-*', 'web-*', '*-crawl', '*-web', 'site-*']
    },
    'src:db': {
      name: 'Database Content',
      description: 'Database dumps and database-sourced datasets',
      expander: ['db-*', '*-db', 'database-*', '*-database', 'sql-*']
    },
    'src:external': {
      name: 'External Sources',
      description: 'All external and third-party datasets',
      expander: ['external-*', 'third-party-*', 'vendor-*', 'integration-*']
    }
  };

  /**
   * Version-based patterns
   */
  static readonly VERSION_PATTERNS: Record<string, PatternAlias> = {
    'ver:latest': {
      name: 'Latest Version',
      description: 'Most recent version of versioned datasets',
      expander: (datasets: string[]): string[] => {
        // Extract datasets with version numbers, excluding unstable releases
        const versionRegex = /v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/;
        const versioned = datasets
          .filter(ds => {
            // Exclude unstable versions
            const lower = ds.toLowerCase();
            return !(
              lower.includes('alpha') ||
              lower.includes('beta') ||
              lower.includes('rc') ||
              lower.includes('dev') ||
              lower.includes('canary') ||
              lower.includes('nightly') ||
              lower.includes('snapshot')
            );
          })
          .map(ds => {
            const match = ds.match(versionRegex);
            if (!match) return null;
            
            const [full, major, minor = '0', patch = '0'] = match;
            const version = [
              parseInt(major, 10),
              parseInt(minor, 10),
              parseInt(patch, 10)
            ];
            
            return { name: ds, version, versionStr: full };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (versioned.length === 0) return [];

        // Group by base name (without version)
        const grouped = new Map<string, typeof versioned[0][]>();
        for (const item of versioned) {
          const baseName = item.name.replace(item.versionStr, '').replace(/[-_]+$/, '');
          const group = grouped.get(baseName) || [];
          group.push(item);
          grouped.set(baseName, group);
        }

        // Get latest from each group
        const latest: string[] = [];
        for (const [_base, group] of grouped) {
          group.sort((a, b) => {
            for (let i = 0; i < 3; i++) {
              if (a.version[i] !== b.version[i]) {
                return b.version[i] - a.version[i]; // Descending
              }
            }
            return 0;
          });
          latest.push(group[0].name);
        }

        return latest;
      }
    },
    'ver:stable': {
      name: 'Stable Versions',
      description: 'Stable releases (no alpha, beta, rc, dev)',
      expander: (datasets: string[]): string[] => {
        return datasets.filter(ds => {
          const lower = ds.toLowerCase();
          return !(
            lower.includes('alpha') ||
            lower.includes('beta') ||
            lower.includes('rc') ||
            lower.includes('dev') ||
            lower.includes('canary') ||
            lower.includes('nightly') ||
            lower.includes('snapshot')
          );
        });
      }
    },
    'ver:unstable': {
      name: 'Unstable Versions',
      description: 'Pre-release and development versions',
      expander: (datasets: string[]): string[] => {
        return datasets.filter(ds => {
          const lower = ds.toLowerCase();
          return (
            lower.includes('alpha') ||
            lower.includes('beta') ||
            lower.includes('rc') ||
            lower.includes('dev') ||
            lower.includes('canary') ||
            lower.includes('nightly') ||
            lower.includes('snapshot')
          );
        });
      }
    }
  };

  /**
   * Branch-based patterns
   */
  static readonly BRANCH_PATTERNS: Record<string, PatternAlias> = {
    'branch:main': {
      name: 'Main Branches',
      description: 'Main, master, and production branches',
      expander: ['*-main', '*-master', 'main-*', 'master-*', 'main', 'master']
    },
    'branch:feature': {
      name: 'Feature Branches',
      description: 'Feature development branches',
      expander: ['*-feature-*', 'feature-*', '*-feat-*', 'feat-*']
    },
    'branch:hotfix': {
      name: 'Hotfix Branches',
      description: 'Hotfix and patch branches',
      expander: ['*-hotfix-*', 'hotfix-*', '*-patch-*', 'patch-*']
    },
    'branch:release': {
      name: 'Release Branches',
      description: 'Release preparation branches',
      expander: ['*-release-*', 'release-*', '*-rel-*', 'rel-*']
    }
  };

  /**
   * All available patterns combined
   */
  static readonly ALL_PATTERNS: Record<string, PatternAlias> = {
    ...PatternLibrary.ENVIRONMENT_PATTERNS,
    ...PatternLibrary.SOURCE_PATTERNS,
    ...PatternLibrary.VERSION_PATTERNS,
    ...PatternLibrary.BRANCH_PATTERNS
  };

  /**
   * Expand a pattern using the pattern library
   * 
   * @param pattern - Pattern to expand (e.g., "env:dev", "src:code")
   * @param availableDatasets - List of available dataset names
   * @returns Array of matching dataset names
   */
  static expand(
    pattern: string,
    availableDatasets: string[]
  ): string[] {
    const alias = this.ALL_PATTERNS[pattern];
    
    if (!alias) {
      return []; // Pattern not found
    }

    // Function-based expander
    if (typeof alias.expander === 'function') {
      return alias.expander(availableDatasets);
    }

    // Array-based expander - parse each glob pattern
    const results = new Set<string>();
    for (const subPattern of alias.expander) {
      const matches = this.matchGlobPattern(subPattern, availableDatasets);
      matches.forEach((match: string) => results.add(match));
    }

    return Array.from(results);
  }

  /**
   * Match a glob pattern against available datasets
   * Internal helper to avoid circular dependency with DatasetParser
   */
  private static matchGlobPattern(pattern: string, datasets: string[]): string[] {
    // Check if it's a glob pattern
    if (pattern.includes('*') || pattern.includes('?')) {
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
        .replace(/\*/g, '.*')                    // * matches any characters
        .replace(/\?/g, '.');                    // ? matches single character
      
      const regex = new RegExp(`^${regexPattern}$`);
      return datasets.filter(ds => regex.test(ds));
    }
    
    // Exact match
    return datasets.includes(pattern) ? [pattern] : [];
  }

  /**
   * Check if a pattern is a known alias
   * 
   * @param pattern - Pattern to check
   * @returns True if pattern is a known alias
   */
  static isAlias(pattern: string): boolean {
    return pattern in this.ALL_PATTERNS;
  }

  /**
   * Get all available pattern aliases with descriptions
   * 
   * @returns Array of pattern information
   */
  static listAliases(): Array<{
    pattern: string;
    name: string;
    description: string;
    category: string;
  }> {
    const aliases: Array<{
      pattern: string;
      name: string;
      description: string;
      category: string;
    }> = [];

    const addCategory = (
      patterns: Record<string, PatternAlias>,
      category: string
    ) => {
      for (const [pattern, alias] of Object.entries(patterns)) {
        aliases.push({
          pattern,
          name: alias.name,
          description: alias.description,
          category
        });
      }
    };

    addCategory(this.ENVIRONMENT_PATTERNS, 'Environment');
    addCategory(this.SOURCE_PATTERNS, 'Source');
    addCategory(this.VERSION_PATTERNS, 'Version');
    addCategory(this.BRANCH_PATTERNS, 'Branch');

    return aliases;
  }

  /**
   * Find suggested patterns based on dataset names
   * 
   * @param availableDatasets - List of available datasets
   * @returns Suggested pattern aliases that would match datasets
   */
  static suggestPatterns(availableDatasets: string[]): Array<{
    pattern: string;
    name: string;
    matchCount: number;
  }> {
    const suggestions: Array<{
      pattern: string;
      name: string;
      matchCount: number;
    }> = [];

    for (const [pattern, alias] of Object.entries(this.ALL_PATTERNS)) {
      const matches = this.expand(pattern, availableDatasets);
      if (matches.length > 0) {
        suggestions.push({
          pattern,
          name: alias.name,
          matchCount: matches.length
        });
      }
    }

    // Sort by match count (descending)
    return suggestions.sort((a, b) => b.matchCount - a.matchCount);
  }
}
