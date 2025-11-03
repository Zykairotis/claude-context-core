import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadMcpDefaults,
  saveMcpDefaults,
  clearMcpDefaults,
  getMcpConfigPath
} from '../mcp-config';

const tempDir = path.join(os.tmpdir(), 'mcp-config-test');
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalContextHome = process.env.CLAUDE_CONTEXT_HOME;

describe('mcp-config', () => {
  beforeEach(async () => {
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir;
    process.env.CLAUDE_CONTEXT_HOME = tempDir;
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }

    if (originalContextHome === undefined) {
      delete process.env.CLAUDE_CONTEXT_HOME;
    } else {
      process.env.CLAUDE_CONTEXT_HOME = originalContextHome;
    }

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty defaults when file missing', async () => {
    const defaults = await loadMcpDefaults();
    expect(defaults).toEqual({});
  });

  it('persists and loads defaults', async () => {
    await saveMcpDefaults({ project: 'alpha', dataset: 'docs' });
    const loaded = await loadMcpDefaults();
    expect(loaded).toEqual({ project: 'alpha', dataset: 'docs' });
  });

  it('clears stored defaults', async () => {
    await saveMcpDefaults({ project: 'alpha' });
    await clearMcpDefaults();
    const loaded = await loadMcpDefaults();
    expect(loaded).toEqual({});
  });

  it('exposes config path under ~/.context', () => {
    const configPath = getMcpConfigPath();
    expect(configPath).toContain(path.join(tempDir, '.context'));
    expect(configPath.endsWith('claude-mcp.json')).toBe(true);
  });
});
