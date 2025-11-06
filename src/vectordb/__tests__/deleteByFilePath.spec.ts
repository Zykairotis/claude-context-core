/**
 * Tests for deleteByFilePath method
 */

import { QdrantVectorDatabase } from '../qdrant-vectordb';
import { PostgresDualVectorDatabase } from '../postgres-dual-vectordb';

describe('VectorDatabase deleteByFilePath', () => {
  describe('QdrantVectorDatabase', () => {
    let db: QdrantVectorDatabase;

    beforeEach(() => {
      db = new QdrantVectorDatabase({ url: 'http://localhost:6333' });
    });

    it('should have deleteByFilePath method', () => {
      expect(typeof db.deleteByFilePath).toBe('function');
    });

    it('should accept correct parameters', async () => {
      // Mock the client method to avoid actual API calls
      const mockDeletePoints = jest.fn().mockResolvedValue({ status: 'ok' });
      (db as any).client = {
        deletePoints: mockDeletePoints
      };

      await db.deleteByFilePath('test_collection', 'src/file.ts', 'proj-123', 'data-456');

      expect(mockDeletePoints).toHaveBeenCalledWith('test_collection', {
        filter: {
          must: [
            { key: 'relative_path', match: { value: 'src/file.ts' } },
            { key: 'project_id', match: { value: 'proj-123' } },
            { key: 'dataset_id', match: { value: 'data-456' } }
          ]
        }
      });
    });

    it('should work without optional projectId/datasetId', async () => {
      const mockDeletePoints = jest.fn().mockResolvedValue({ status: 'ok' });
      (db as any).client = {
        deletePoints: mockDeletePoints
      };

      await db.deleteByFilePath('test_collection', 'src/file.ts');

      expect(mockDeletePoints).toHaveBeenCalledWith('test_collection', {
        filter: {
          must: [
            { key: 'relative_path', match: { value: 'src/file.ts' } }
          ]
        }
      });
    });

    it('should handle 404 errors gracefully', async () => {
      const mockDeletePoints = jest.fn().mockRejectedValue({
        message: '404 Not Found'
      });
      (db as any).client = {
        deletePoints: mockDeletePoints
      };

      const result = await db.deleteByFilePath('missing_collection', 'src/file.ts');

      expect(result).toBe(0);
    });
  });

  describe('PostgresDualVectorDatabase (basic checks)', () => {
    it('should have deleteByFilePath method defined', () => {
      // Can't fully test without DB connection, but verify method exists
      expect(PostgresDualVectorDatabase.prototype.deleteByFilePath).toBeDefined();
      expect(typeof PostgresDualVectorDatabase.prototype.deleteByFilePath).toBe('function');
    });
  });
});
