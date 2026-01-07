/**
 * Database History Tests
 *
 * Tests for status history tracking functionality.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Mock the database module
let mockDb: Database.Database | null = null;

vi.mock('../../src/db/index.js', () => ({
  getDatabase: () => {
    if (!mockDb) {
      throw new Error('Database not initialized');
    }
    return mockDb;
  },
}));

describe('Status History Database', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Create fresh in-memory database with schema
    mockDb = new Database(':memory:');
    mockDb.exec(`
      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_name TEXT NOT NULL,
        status TEXT NOT NULL,
        attention_reason TEXT,
        event TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_session ON status_history(session_name);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON status_history(timestamp);
    `);
  });

  afterEach(() => {
    if (mockDb) {
      mockDb.close();
      mockDb = null;
    }
  });

  describe('recordStatusChange', () => {
    it('records status change with all fields', async () => {
      const { recordStatusChange } = await import('../../src/db/history.js');

      recordStatusChange('test-session-1', 'needs_attention', 'permission', 'PreToolUse');

      const result = mockDb!
        .prepare('SELECT * FROM status_history WHERE session_name = ?')
        .get('test-session-1') as any;

      expect(result).toBeDefined();
      expect(result.session_name).toBe('test-session-1');
      expect(result.status).toBe('needs_attention');
      expect(result.attention_reason).toBe('permission');
      expect(result.event).toBe('PreToolUse');
      expect(typeof result.timestamp).toBe('number');
    });

    it('records status change without attention reason', async () => {
      const { recordStatusChange } = await import('../../src/db/history.js');

      recordStatusChange('test-session-2', 'working', null, 'PostToolUse');

      const result = mockDb!
        .prepare('SELECT * FROM status_history WHERE session_name = ?')
        .get('test-session-2') as any;

      expect(result.attention_reason).toBeNull();
    });

    it('records status change without event', async () => {
      const { recordStatusChange } = await import('../../src/db/history.js');

      recordStatusChange('test-session-3', 'idle', null, null);

      const result = mockDb!
        .prepare('SELECT * FROM status_history WHERE session_name = ?')
        .get('test-session-3') as any;

      expect(result.event).toBeNull();
    });

    it('records multiple status changes for same session', async () => {
      const { recordStatusChange } = await import('../../src/db/history.js');

      recordStatusChange('multi-session', 'init', null, 'Start');
      recordStatusChange('multi-session', 'working', null, 'Processing');
      recordStatusChange('multi-session', 'needs_attention', 'input', 'WaitingInput');

      const results = mockDb!
        .prepare('SELECT * FROM status_history WHERE session_name = ? ORDER BY timestamp')
        .all('multi-session') as any[];

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('init');
      expect(results[1].status).toBe('working');
      expect(results[2].status).toBe('needs_attention');
    });
  });

  describe('getSessionHistory', () => {
    beforeEach(async () => {
      // Insert with explicit timestamps to ensure ordering
      const now = Date.now();
      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('session-a', 'init', null, 'Start', now - 3000);

      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('session-a', 'working', null, 'Processing', now - 2000);

      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('session-a', 'idle', null, 'Stop', now - 1000);

      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('session-b', 'working', null, 'Processing', now);
    });

    it('returns history for specific session', async () => {
      const { getSessionHistory } = await import('../../src/db/history.js');

      const history = getSessionHistory('session-a');

      expect(history).toHaveLength(3);
      history.forEach((entry) => {
        expect(entry.session_name).toBe('session-a');
      });
    });

    it('returns history in descending order by timestamp', async () => {
      const { getSessionHistory } = await import('../../src/db/history.js');

      const history = getSessionHistory('session-a');

      // Most recent first (descending order)
      expect(history[0].status).toBe('idle');
      expect(history[1].status).toBe('working');
      expect(history[2].status).toBe('init');
    });

    it('respects limit parameter', async () => {
      const { getSessionHistory } = await import('../../src/db/history.js');

      const history = getSessionHistory('session-a', 2);

      expect(history).toHaveLength(2);
    });

    it('returns empty array for non-existent session', async () => {
      const { getSessionHistory } = await import('../../src/db/history.js');

      const history = getSessionHistory('non-existent');

      expect(history).toEqual([]);
    });
  });

  describe('getRecentHistory', () => {
    beforeEach(async () => {
      // Insert with explicit timestamps to ensure ordering
      const now = Date.now();
      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('session-a', 'init', null, 'Start', now - 2000);

      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('session-b', 'working', null, 'Processing', now - 1000);

      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('session-a', 'working', null, 'Processing', now);
    });

    it('returns all recent history across sessions', async () => {
      const { getRecentHistory } = await import('../../src/db/history.js');

      const history = getRecentHistory();

      expect(history).toHaveLength(3);
    });

    it('returns in descending order by timestamp', async () => {
      const { getRecentHistory } = await import('../../src/db/history.js');

      const history = getRecentHistory();

      // Check timestamps are in descending order
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i + 1].timestamp);
      }
    });

    it('respects limit parameter', async () => {
      const { getRecentHistory } = await import('../../src/db/history.js');

      const history = getRecentHistory(2);

      expect(history).toHaveLength(2);
    });
  });

  describe('getHistoryInRange', () => {
    it('returns history within time range', async () => {
      const { recordStatusChange, getHistoryInRange } = await import('../../src/db/history.js');

      const now = Date.now();
      const hourAgo = now - 60 * 60 * 1000;
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      // Insert with known timestamps
      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('range-test', 'init', null, 'Start', twoHoursAgo);

      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('range-test', 'working', null, 'Processing', hourAgo);

      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run('range-test', 'idle', null, 'Stop', now);

      // Get history from 90 minutes ago to now
      const ninetyMinutesAgo = now - 90 * 60 * 1000;
      const history = getHistoryInRange(ninetyMinutesAgo, now);

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('idle');
      expect(history[1].status).toBe('working');
    });

    it('returns empty array for empty range', async () => {
      const { getHistoryInRange } = await import('../../src/db/history.js');

      const history = getHistoryInRange(0, 1);

      expect(history).toEqual([]);
    });
  });

  describe('cleanupOldHistory', () => {
    it('deletes entries older than max age', async () => {
      const { cleanupOldHistory } = await import('../../src/db/history.js');

      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

      // Insert old entry
      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, timestamp)
        VALUES (?, ?, ?)
      `
        )
        .run('old-session', 'working', twoDaysAgo);

      // Insert recent entry
      mockDb!
        .prepare(
          `
        INSERT INTO status_history (session_name, status, timestamp)
        VALUES (?, ?, ?)
      `
        )
        .run('recent-session', 'working', oneHourAgo);

      // Cleanup entries older than 1 day
      const oneDayMs = 24 * 60 * 60 * 1000;
      const deleted = cleanupOldHistory(oneDayMs);

      expect(deleted).toBe(1);

      const remaining = mockDb!.prepare('SELECT * FROM status_history').all();
      expect(remaining).toHaveLength(1);
    });

    it('returns 0 when nothing to clean', async () => {
      const { recordStatusChange, cleanupOldHistory } = await import('../../src/db/history.js');

      recordStatusChange('new-session', 'working', null, null);

      const deleted = cleanupOldHistory(24 * 60 * 60 * 1000);

      expect(deleted).toBe(0);
    });
  });

  describe('getHistoryStats', () => {
    it('returns correct statistics', async () => {
      const { recordStatusChange, getHistoryStats } = await import('../../src/db/history.js');

      recordStatusChange('stats-test', 'init', null, null);
      recordStatusChange('stats-test', 'working', null, null);
      recordStatusChange('stats-test', 'working', null, null);
      recordStatusChange('stats-test', 'needs_attention', 'permission', null);
      recordStatusChange('stats-test', 'idle', null, null);

      const stats = getHistoryStats();

      expect(stats.totalEntries).toBe(5);
      expect(stats.entriesByStatus['init']).toBe(1);
      expect(stats.entriesByStatus['working']).toBe(2);
      expect(stats.entriesByStatus['needs_attention']).toBe(1);
      expect(stats.entriesByStatus['idle']).toBe(1);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
      expect(stats.newestEntry!).toBeGreaterThanOrEqual(stats.oldestEntry!);
    });

    it('returns null timestamps when empty', async () => {
      const { getHistoryStats } = await import('../../src/db/history.js');

      const stats = getHistoryStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
      expect(stats.entriesByStatus).toEqual({});
    });
  });

  describe('deleteSessionHistory', () => {
    it('deletes all history for a session', async () => {
      const { recordStatusChange, deleteSessionHistory, getSessionHistory } =
        await import('../../src/db/history.js');

      recordStatusChange('to-delete', 'init', null, null);
      recordStatusChange('to-delete', 'working', null, null);
      recordStatusChange('keep-this', 'working', null, null);

      const deleted = deleteSessionHistory('to-delete');

      expect(deleted).toBe(2);
      expect(getSessionHistory('to-delete')).toEqual([]);
      expect(getSessionHistory('keep-this')).toHaveLength(1);
    });

    it('returns 0 for non-existent session', async () => {
      const { deleteSessionHistory } = await import('../../src/db/history.js');

      const deleted = deleteSessionHistory('non-existent');

      expect(deleted).toBe(0);
    });
  });
});
