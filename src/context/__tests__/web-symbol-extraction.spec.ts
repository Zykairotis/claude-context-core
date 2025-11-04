import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Context } from '../../context';
import type { VectorDatabase } from '../../vectordb';
import type { Embedding } from '../../embedding';
import type { Pool, PoolClient } from 'pg';

describe('Web Content Symbol Extraction', () => {
  let context: Context;
  let mockVectorDb: jest.Mocked<VectorDatabase>;
  let mockEmbedding: jest.Mocked<Embedding>;
  let mockPoolClient: jest.Mocked<PoolClient>;
  let mockPool: jest.Mocked<Pool>;
  let insertedDocuments: any[] = [];

  beforeEach(() => {
    insertedDocuments = [];

    // Mock vector database with document capture
    mockVectorDb = {
      hasCollection: jest.fn(async () => false),
      createHybridCollection: jest.fn(async () => {}),
      createCollection: jest.fn(async () => {}),
      dropCollection: jest.fn(async () => {}),
      insertHybrid: jest.fn(async (collection: string, docs: any[]) => {
        insertedDocuments.push(...docs);
      }),
      insert: jest.fn(async (collection: string, docs: any[]) => {
        insertedDocuments.push(...docs);
      }),
      search: jest.fn(async () => []),
      delete: jest.fn(async () => {}),
      deleteByDataset: jest.fn(async () => 0),
      query: jest.fn(async () => []),
      listCollections: jest.fn(async () => []),
      checkCollectionLimit: jest.fn(async () => true),
      getCollectionStats: jest.fn(async () => null),
      hybridSearch: jest.fn(async () => [])
    } as any;

    // Mock embedding
    mockEmbedding = {
      detectDimension: jest.fn(async () => 1536),
      embedBatch: jest.fn(async (texts: string[]) =>
        texts.map(text => ({
          vector: Array(1536).fill(0.1),
          dimension: 1536
        }))
      ),
      getProvider: jest.fn(() => 'test'),
      embed: jest.fn(async () => ({
        vector: Array(1536).fill(0.1),
        dimension: 1536
      }))
    } as any;

    // Mock PostgreSQL pool client
    mockPoolClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('projects')) {
          return { rows: [{ id: 'project-123', name: 'test-project' }] };
        }
        if (sql.includes('datasets')) {
          return { rows: [{ id: 'dataset-123', name: 'test-dataset' }] };
        }
        return { rows: [] };
      }),
      release: jest.fn()
    } as any;

    // Mock PostgreSQL pool
    mockPool = {
      connect: jest.fn(async () => mockPoolClient)
    } as any;

    // Create context with mocks
    context = new Context({
      vectorDatabase: mockVectorDb,
      embedding: mockEmbedding,
      postgresPool: mockPool
    });
  });

  it('should extract function symbols from TypeScript code', async () => {
    const pages = [
      {
        url: 'https://docs.example.com/api',
        content: `
# API Documentation

Here's how to use our API:

\`\`\`typescript
function fetchUser(userId: string): Promise<User> {
  return fetch(\`/api/users/\${userId}\`).then(res => res.json());
}

async function createUser(data: UserData): Promise<User> {
  const response = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response.json();
}
\`\`\`

These functions handle user operations.
        `,
        title: 'API Guide'
      }
    ];

    await context.indexWebPages(pages, 'test-project', 'test-dataset');

    // Find code chunks with symbols
    const codeChunks = insertedDocuments.filter(doc => 
      doc.metadata?.symbol?.name
    );

    expect(codeChunks.length).toBeGreaterThan(0);

    // Check for extracted function symbols
    const functionSymbols = codeChunks.filter(doc =>
      doc.metadata.symbol.kind === 'function'
    );

    expect(functionSymbols.length).toBeGreaterThanOrEqual(1);

    // Verify symbol metadata
    const fetchUserSymbol = functionSymbols.find(doc =>
      doc.metadata.symbol.name === 'fetchUser'
    );

    if (fetchUserSymbol) {
      expect(fetchUserSymbol.metadata.symbol).toMatchObject({
        name: 'fetchUser',
        kind: 'function'
      });
    }
  });

  it('should extract class symbols from Python code', async () => {
    const pages = [
      {
        url: 'https://docs.example.com/classes',
        content: `
# Class Documentation

\`\`\`python
class UserManager:
    def __init__(self, db):
        self.db = db
    
    def get_user(self, user_id):
        return self.db.query(User).get(user_id)
    
    def create_user(self, username, email):
        user = User(username=username, email=email)
        self.db.add(user)
        self.db.commit()
        return user
\`\`\`
        `
      }
    ];

    await context.indexWebPages(pages, 'test-project', 'test-dataset');

    const classChunks = insertedDocuments.filter(doc =>
      doc.metadata?.symbol?.kind === 'class'
    );

    expect(classChunks.length).toBeGreaterThan(0);

    const userManagerClass = classChunks.find(doc =>
      doc.metadata.symbol.name === 'UserManager'
    );

    if (userManagerClass) {
      expect(userManagerClass.metadata.symbol.kind).toBe('class');
    }
  });

  it('should extract interface symbols from TypeScript', async () => {
    const pages = [
      {
        url: 'https://docs.example.com/types',
        content: `
# Type Definitions

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthResponse {
  token: string;
  user: User;
  expiresAt: number;
}

type UserRole = 'admin' | 'user' | 'guest';
\`\`\`
        `
      }
    ];

    await context.indexWebPages(pages, 'test-project', 'test-dataset');

    const typeSymbols = insertedDocuments.filter(doc =>
      doc.metadata?.symbol?.kind === 'interface' || 
      doc.metadata?.symbol?.kind === 'type'
    );

    expect(typeSymbols.length).toBeGreaterThan(0);
  });

  it('should handle mixed code and prose content', async () => {
    const pages = [
      {
        url: 'https://docs.example.com/guide',
        content: `
# Complete Guide

This guide shows you how to use our library.

## Installation

First, install the package:

\`\`\`bash
npm install my-library
\`\`\`

## Usage

Import and use the main function:

\`\`\`typescript
import { initialize } from 'my-library';

function setupApp() {
  const app = initialize({
    apiKey: process.env.API_KEY
  });
  return app;
}
\`\`\`

The function returns an initialized app instance.

## Configuration

Set these environment variables...
        `
      }
    ];

    await context.indexWebPages(pages, 'test-project', 'test-dataset');

    // Should have both code chunks with symbols and text chunks without
    const codeChunksWithSymbols = insertedDocuments.filter(doc =>
      doc.metadata?.symbol?.name
    );
    
    const textChunks = insertedDocuments.filter(doc =>
      !doc.metadata?.symbol
    );

    expect(codeChunksWithSymbols.length).toBeGreaterThan(0);
    expect(textChunks.length).toBeGreaterThan(0);
  });

  it('should handle code without parseable symbols gracefully', async () => {
    const pages = [
      {
        url: 'https://docs.example.com/snippet',
        content: `
# Code Snippet

\`\`\`javascript
// Just a simple expression
const x = 5 + 3;
console.log(x);
\`\`\`
        `
      }
    ];

    // Should not throw an error
    await expect(
      context.indexWebPages(pages, 'test-project', 'test-dataset')
    ).resolves.toBeDefined();

    expect(insertedDocuments.length).toBeGreaterThan(0);
  });

  it('should preserve symbol metadata through the pipeline', async () => {
    const pages = [
      {
        url: 'https://react.dev/hooks',
        content: `
# React Hooks

\`\`\`typescript
function useCounter(initialValue: number = 0) {
  const [count, setCount] = useState(initialValue);
  
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  
  return { count, increment, decrement };
}
\`\`\`
        `,
        title: 'React Hooks Guide',
        domain: 'react.dev'
      }
    ];

    await context.indexWebPages(pages, 'test-project', 'test-dataset');

    const hookChunks = insertedDocuments.filter(doc =>
      doc.content.includes('useCounter')
    );

    expect(hookChunks.length).toBeGreaterThan(0);

    // Verify all metadata is preserved
    const hookChunk = hookChunks[0];
    expect(hookChunk.metadata).toMatchObject({
      sourceType: 'web',
      ingestedAt: expect.any(String)
    });

    // Symbol metadata should be present if AST extraction succeeded
    if (hookChunk.metadata.symbol) {
      expect(hookChunk.metadata.symbol).toHaveProperty('name');
      expect(hookChunk.metadata.symbol).toHaveProperty('kind');
    }
  });

  it('should extract symbols from multiple code blocks in one page', async () => {
    const pages = [
      {
        url: 'https://docs.example.com/tutorial',
        content: `
# Tutorial

## Step 1: Define Models

\`\`\`typescript
interface Product {
  id: string;
  name: string;
  price: number;
}
\`\`\`

## Step 2: Create Service

\`\`\`typescript
class ProductService {
  async getProduct(id: string): Promise<Product> {
    // Implementation
  }
}
\`\`\`

## Step 3: Use It

\`\`\`typescript
function displayProduct(productId: string) {
  const service = new ProductService();
  return service.getProduct(productId);
}
\`\`\`
        `
      }
    ];

    await context.indexWebPages(pages, 'test-project', 'test-dataset');

    const symbolChunks = insertedDocuments.filter(doc =>
      doc.metadata?.symbol?.name
    );

    // Should have extracted symbols from multiple code blocks
    expect(symbolChunks.length).toBeGreaterThanOrEqual(2);

    // Check for different symbol kinds
    const kinds = new Set(symbolChunks.map(doc => doc.metadata.symbol.kind));
    expect(kinds.size).toBeGreaterThan(1);
  });
});
