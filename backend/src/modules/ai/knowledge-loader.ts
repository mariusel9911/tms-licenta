import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KnowledgeChunk {
  source: string;  // filename without extension
  heading: string; // nearest ## heading above the chunk
  text: string;    // chunk text (200–400 tokens approx)
}

// ── Module-level cache ─────────────────────────────────────────────────────────

let chunks: KnowledgeChunk[] = [];
let loaded = false;

// ── Loader ─────────────────────────────────────────────────────────────────────

const KNOWLEDGE_DIR = path.join(import.meta.dirname, 'knowledge');

function parseMarkdown(source: string, content: string): KnowledgeChunk[] {
  const result: KnowledgeChunk[] = [];
  const lines = content.split('\n');

  let currentHeading = source;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text.length > 30) {
      result.push({ source, heading: currentHeading, text });
    }
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentHeading = line.replace(/^##\s+/, '');
    } else if (line.startsWith('# ')) {
      flush();
      currentHeading = line.replace(/^#\s+/, '');
    } else {
      buffer.push(line);
      // Split on paragraph boundaries to keep chunks manageable
      if (buffer.length >= 20 && line.trim() === '') {
        flush();
      }
    }
  }
  flush();

  return result;
}

export function loadKnowledgeBase(): void {
  if (loaded) return;

  try {
    const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const source = file.replace('.md', '');
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
      chunks.push(...parseMarkdown(source, content));
    }
    loaded = true;
    logger.info({ chunkCount: chunks.length, fileCount: files.length }, 'Knowledge base loaded');
  } catch (err) {
    logger.error({ err }, 'Failed to load knowledge base');
  }
}

// ── Boundary sources (negative knowledge — always prioritized) ───────────────

const BOUNDARY_SOURCES = new Set(['boundaries']);

// ── Retrieval ──────────────────────────────────────────────────────────────────

/**
 * Compute a simple TF-IDF-like relevance score between a query and a chunk.
 * We tokenize both into lowercase words, then count matching unique terms.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\sșțăâîşţ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

// Common stop-words to ignore
const STOP_WORDS = new Set([
  // English
  'the', 'and', 'for', 'are', 'this', 'that', 'with', 'have', 'from',
  'they', 'been', 'when', 'your', 'can', 'will', 'more', 'not', 'also',
  'all', 'any', 'but', 'use', 'you', 'how', 'its', 'was', 'one', 'out',
  // Romanian
  'cum', 'unde', 'care', 'este', 'sunt', 'din', 'sau', 'mai', 'dar',
  'daca', 'pot', 'vreau', 'imi', 'poti', 'cele', 'cel', 'lui', 'prin',
]);

function getKeywords(text: string): Set<string> {
  return new Set(tokenize(text).filter((t) => !STOP_WORDS.has(t)));
}

function score(query: Set<string>, chunk: KnowledgeChunk): number {
  const chunkWords = getKeywords(chunk.heading + ' ' + chunk.text);
  let matches = 0;
  for (const word of query) {
    if (chunkWords.has(word)) matches++;
  }
  // Bonus for heading match
  const headingWords = getKeywords(chunk.heading);
  for (const word of query) {
    if (headingWords.has(word)) matches += 0.5;
  }
  return matches;
}

/**
 * Retrieve the top-k most relevant knowledge chunks for a user query.
 *
 * Boundary chunks (negative knowledge — features that do NOT exist) get a
 * reserved slot: if any boundary chunk scores > 0, the highest-scoring one
 * is guaranteed to appear in the results. This prevents positive documentation
 * from pushing out critical "this does not exist" context.
 */
export function retrieveContext(query: string, topK = 5): KnowledgeChunk[] {
  if (!loaded) loadKnowledgeBase();
  if (chunks.length === 0) return [];

  const queryKeywords = getKeywords(query);
  if (queryKeywords.size === 0) return chunks.slice(0, topK);

  const scored = chunks
    .map((chunk) => ({ chunk, score: score(queryKeywords, chunk) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Partition into boundary vs regular chunks
  const boundaryHits = scored.filter((s) => BOUNDARY_SOURCES.has(s.chunk.source));
  const regularHits = scored.filter((s) => !BOUNDARY_SOURCES.has(s.chunk.source));

  const results: KnowledgeChunk[] = [];

  // Reserve 1 slot for the best boundary chunk (if any matched)
  if (boundaryHits.length > 0) {
    results.push(boundaryHits[0].chunk);
  }

  // Fill remaining slots from regular chunks
  const remaining = topK - results.length;
  for (let i = 0; i < Math.min(remaining, regularHits.length); i++) {
    results.push(regularHits[i].chunk);
  }

  return results;
}
