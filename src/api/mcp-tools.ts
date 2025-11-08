/**
 * MCP Tool Helpers for Multi-Dataset Search
 * 
 * Provides helper functions for MCP tool implementations to leverage
 * the DatasetParser and PatternLibrary capabilities.
 */

import { DatasetParser } from '../utils/dataset-parser';
import { PatternLibrary } from '../utils/pattern-library';

export interface DatasetPatternInfo {
  patterns: Array<{
    pattern: string;
    name: string;
    description: string;
    category: string;
  }>;
  suggestions: Array<{
    pattern: string;
    name: string;
    matchCount: number;
  }>;
}

export interface DatasetExpansionResult {
  requested: string | string[];
  resolved: string[];
  expandedFrom?: string; // Which pattern was expanded
  matchCount: number;
}

/**
 * Get available dataset patterns with descriptions
 * Useful for showing users what patterns they can use
 */
export function getDatasetPatterns(): DatasetPatternInfo {
  return {
    patterns: PatternLibrary.listAliases(),
    suggestions: [] // Filled in when datasets are provided
  };
}

/**
 * Get pattern suggestions for available datasets
 * Shows which patterns would match the current datasets
 */
export function suggestDatasetPatterns(availableDatasets: string[]): DatasetPatternInfo {
  return {
    patterns: PatternLibrary.listAliases(),
    suggestions: PatternLibrary.suggestPatterns(availableDatasets)
  };
}

/**
 * Expand dataset pattern with debugging info
 * Useful for MCP tools to show what pattern resolved to
 */
export function expandDatasetPattern(
  input: string | string[] | undefined,
  availableDatasets: string[]
): DatasetExpansionResult {
  const resolved = DatasetParser.parse(input, availableDatasets);
  
  let expandedFrom: string | undefined;
  
  // Check if it was a semantic alias
  if (typeof input === 'string' && PatternLibrary.isAlias(input)) {
    expandedFrom = input;
  }
  // Check if it was a wildcard
  else if (input === '*' || (Array.isArray(input) && input[0] === '*')) {
    expandedFrom = '*';
  }
  // Check if it was a glob pattern
  else if (typeof input === 'string' && (input.includes('*') || input.includes('?'))) {
    expandedFrom = input;
  }
  
  return {
    requested: input ?? '*',
    resolved,
    expandedFrom,
    matchCount: resolved.length
  };
}

/**
 * Validate dataset input and provide helpful error messages
 */
export function validateDatasetInput(
  input: string | string[] | undefined,
  availableDatasets: string[]
): {
  valid: boolean;
  message?: string;
  suggestions?: string[];
} {
  // Undefined or null is valid (means all datasets)
  if (input === undefined || input === null) {
    return { valid: true };
  }
  
  // Empty array is valid (means all datasets)
  if (Array.isArray(input) && input.length === 0) {
    return { valid: true };
  }
  
  // Check if pattern expands to anything
  const resolved = DatasetParser.parse(input, availableDatasets);
  
  if (resolved.length === 0) {
    const inputStr = Array.isArray(input) ? input.join(', ') : input;
    
    // Check if it's a typo in a semantic alias
    if (typeof input === 'string' && input.includes(':')) {
      const suggestions = PatternLibrary.listAliases()
        .map(a => a.pattern)
        .filter(p => p.startsWith(input.split(':')[0] + ':'))
        .slice(0, 3);
      
      return {
        valid: false,
        message: `Pattern "${input}" does not match any datasets. Did you mean one of these?`,
        suggestions
      };
    }
    
    // Check if it's a glob pattern that doesn't match
    if (typeof input === 'string' && (input.includes('*') || input.includes('?'))) {
      return {
        valid: false,
        message: `Glob pattern "${input}" does not match any available datasets.`,
        suggestions: availableDatasets.slice(0, 5)
      };
    }
    
    // Exact match that doesn't exist
    return {
      valid: false,
      message: `Dataset(s) "${inputStr}" not found.`,
      suggestions: availableDatasets.slice(0, 5)
    };
  }
  
  return { valid: true };
}

/**
 * Format dataset expansion for display in MCP tool responses
 */
export function formatDatasetExpansion(expansion: DatasetExpansionResult): string {
  const { requested, resolved, expandedFrom, matchCount } = expansion;
  
  if (matchCount === 0) {
    return `⚠️ No datasets matched`;
  }
  
  if (expandedFrom) {
    if (expandedFrom === '*') {
      return `🌟 Wildcard expanded to ${matchCount} dataset(s)`;
    } else if (PatternLibrary.isAlias(expandedFrom)) {
      const aliasInfo = PatternLibrary.listAliases().find(a => a.pattern === expandedFrom);
      const name = aliasInfo?.name || expandedFrom;
      return `🎯 Pattern "${expandedFrom}" (${name}) matched ${matchCount} dataset(s): ${resolved.slice(0, 5).join(', ')}${matchCount > 5 ? '...' : ''}`;
    } else {
      return `🔍 Pattern "${expandedFrom}" matched ${matchCount} dataset(s): ${resolved.slice(0, 5).join(', ')}${matchCount > 5 ? '...' : ''}`;
    }
  }
  
  if (matchCount === 1) {
    return `📁 Searching 1 dataset: ${resolved[0]}`;
  }
  
  return `📁 Searching ${matchCount} datasets: ${resolved.slice(0, 5).join(', ')}${matchCount > 5 ? '...' : ''}`;
}

/**
 * Get dataset statistics summary for MCP tool responses
 */
export function formatDatasetStats(stats: Array<{
  datasetName: string;
  projectName: string;
  chunkCount: number;
  pageCount: number;
  lastIndexed: Date | null;
}>): string {
  if (stats.length === 0) {
    return '📊 No dataset statistics available';
  }
  
  const totalChunks = stats.reduce((sum, s) => sum + s.chunkCount, 0);
  const totalPages = stats.reduce((sum, s) => sum + s.pageCount, 0);
  
  let summary = `📊 ${stats.length} dataset(s) | ${totalChunks.toLocaleString()} chunks | ${totalPages.toLocaleString()} pages\n\n`;
  
  for (const stat of stats.slice(0, 10)) {
    const lastIndexed = stat.lastIndexed 
      ? new Date(stat.lastIndexed).toLocaleDateString()
      : 'Never';
    summary += `• ${stat.projectName}/${stat.datasetName}: ${stat.chunkCount} chunks, ${stat.pageCount} pages (indexed: ${lastIndexed})\n`;
  }
  
  if (stats.length > 10) {
    summary += `\n... and ${stats.length - 10} more datasets`;
  }
  
  return summary.trim();
}

/**
 * Format search results for MCP tool responses
 */
export function formatSearchResults(
  results: Array<{
    document: any;
    score: number;
    dataset?: {
      project: string;
      dataset: string;
      datasetId: string;
    };
  }>,
  query: string,
  matchCount: number
): string {
  if (results.length === 0) {
    return `🔍 No results found for "${query}"`;
  }
  
  let output = `🔍 Found ${results.length} result(s) for "${query}"`;
  
  if (matchCount > 1) {
    output += ` across ${matchCount} dataset(s)`;
  }
  
  output += '\n\n';
  
  for (const [idx, result] of results.slice(0, 5).entries()) {
    const score = (result.score * 100).toFixed(1);
    const datasetInfo = result.dataset 
      ? `${result.dataset.project}/${result.dataset.dataset}`
      : 'unknown';
    
    const content = result.document.content.substring(0, 200);
    const preview = content.length === result.document.content.length 
      ? content 
      : content + '...';
    
    output += `${idx + 1}. [${score}%] ${datasetInfo}\n`;
    output += `   ${preview}\n\n`;
  }
  
  if (results.length > 5) {
    output += `... and ${results.length - 5} more results`;
  }
  
  return output.trim();
}

/**
 * Create a helpful pattern guide for users
 */
export function createPatternGuide(): string {
  const patterns = PatternLibrary.listAliases();
  const categories = new Map<string, typeof patterns>();
  
  // Group by category
  for (const pattern of patterns) {
    const existing = categories.get(pattern.category) || [];
    existing.push(pattern);
    categories.set(pattern.category, existing);
  }
  
  let guide = '📖 Dataset Pattern Guide\n\n';
  
  for (const [category, items] of categories) {
    guide += `**${category} Patterns:**\n`;
    for (const item of items) {
      guide += `• \`${item.pattern}\` - ${item.description}\n`;
    }
    guide += '\n';
  }
  
  guide += '**Glob Patterns:**\n';
  guide += '• `github-*` - Match any dataset starting with "github-"\n';
  guide += '• `*-prod` - Match any dataset ending with "-prod"\n';
  guide += '• `db-?` - Match "db-" followed by single character\n';
  guide += '\n';
  
  guide += '**Special:**\n';
  guide += '• `*` - Match all datasets\n';
  guide += '• `["local", "docs"]` - Array of exact names\n';
  
  return guide;
}
