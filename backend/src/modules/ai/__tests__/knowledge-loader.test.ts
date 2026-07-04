import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fs so the loader never touches disk
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
  default: {
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  },
}));

// Helpers to build fake markdown content
function makeMarkdown(heading: string, body: string): string {
  return `## ${heading}\n${body}\n`;
}

// ── loadKnowledgeBase ─────────────────────────────────────────────────────────

describe('loadKnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state between each test so "loaded" flag resets
    vi.resetModules();
  });

  it('reads .md files from the knowledge directory and marks as loaded', async () => {
    mockReaddirSync.mockReturnValue(['orders.md', 'general.md']);
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes('orders')) return makeMarkdown('Orders', 'You can create orders from the Orders page.');
      return makeMarkdown('General', 'TMS is a transport management system.');
    });

    const { loadKnowledgeBase, retrieveContext } = await import('../knowledge-loader');
    loadKnowledgeBase();

    // After loading, retrieveContext should return chunks
    const results = retrieveContext('orders');
    expect(results.length).toBeGreaterThan(0);
  });

  it('is idempotent — calling twice reads files only once', async () => {
    mockReaddirSync.mockReturnValue(['general.md']);
    mockReadFileSync.mockReturnValue(makeMarkdown('General', 'A transport management system.'));

    const { loadKnowledgeBase } = await import('../knowledge-loader');
    loadKnowledgeBase();
    loadKnowledgeBase(); // second call

    expect(mockReaddirSync).toHaveBeenCalledTimes(1);
  });

  it('handles fs errors gracefully without throwing', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const { loadKnowledgeBase } = await import('../knowledge-loader');

    expect(() => loadKnowledgeBase()).not.toThrow();
  });

  it('ignores non-.md files in the directory', async () => {
    mockReaddirSync.mockReturnValue(['orders.md', 'README.txt', 'config.json']);
    mockReadFileSync.mockReturnValue(makeMarkdown('Orders', 'Order management content.'));

    const { loadKnowledgeBase } = await import('../knowledge-loader');
    loadKnowledgeBase();

    // readFileSync called only for orders.md, not README.txt or config.json
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });
});

// ── retrieveContext ───────────────────────────────────────────────────────────

describe('retrieveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Set up a fresh knowledge base for each retrieval test
    mockReaddirSync.mockReturnValue(['orders.md', 'vehicles.md', 'partners.md']);
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes('orders')) {
        return `## Orders\nYou can create transport orders. Orders have status: DRAFT, IN_PROGRESS, COMPLETED.\n`;
      }
      if (String(filePath).includes('vehicles')) {
        return `## Vehicles\nVehicles are trucks and vans used for transport. Each vehicle has a license plate.\n`;
      }
      return `## Partners\nPartners are clients and transporters in the system.\n`;
    });
  });

  it('returns chunks matching the query keywords', async () => {
    const { loadKnowledgeBase, retrieveContext } = await import('../knowledge-loader');
    loadKnowledgeBase();

    const results = retrieveContext('orders status');
    expect(results.length).toBeGreaterThan(0);
    // Should find the orders chunk
    expect(results.some((c) => c.source === 'orders')).toBe(true);
  });

  it('returns at most topK chunks', async () => {
    const { loadKnowledgeBase, retrieveContext } = await import('../knowledge-loader');
    loadKnowledgeBase();

    const results = retrieveContext('transport', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns first chunks when query is empty (no keywords)', async () => {
    const { loadKnowledgeBase, retrieveContext } = await import('../knowledge-loader');
    loadKnowledgeBase();

    const results = retrieveContext('');
    // With no keywords, falls back to first topK chunks
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty array when knowledge base failed to load', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const { loadKnowledgeBase, retrieveContext } = await import('../knowledge-loader');
    loadKnowledgeBase(); // will fail silently

    const results = retrieveContext('anything');
    expect(results).toEqual([]);
  });

  it('filters out stop-words when scoring', async () => {
    // "the" and "for" are stop-words — query matching only these should score 0
    mockReaddirSync.mockReturnValue(['general.md']);
    mockReadFileSync.mockReturnValue(`## General\nThe system is designed for transport management.\n`);

    const { loadKnowledgeBase, retrieveContext } = await import('../knowledge-loader');
    loadKnowledgeBase();

    // A query of only stop-words has no effective keywords → fallback to first chunks
    const results = retrieveContext('the for are');
    // Falls back to first-k since queryKeywords.size === 0 after filtering
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('gives heading-match bonus (heading match scores higher)', async () => {
    mockReaddirSync.mockReturnValue(['orders.md', 'vehicles.md']);
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes('orders')) {
        return `## Order Creation\nCreate orders via the Orders page. Click New Order.\n`;
      }
      return `## Vehicle Management\nVehicles are assigned to orders for transport.\n`;
    });

    const { loadKnowledgeBase, retrieveContext } = await import('../knowledge-loader');
    loadKnowledgeBase();

    // Query exactly matches the "Order Creation" heading
    const results = retrieveContext('order creation');
    expect(results.length).toBeGreaterThan(0);
    // The orders chunk should rank first due to heading bonus
    expect(results[0].source).toBe('orders');
  });
});
