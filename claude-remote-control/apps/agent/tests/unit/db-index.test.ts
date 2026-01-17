import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock schema module
vi.mock('../../src/db/schema.js', () => ({
  CREATE_TABLES_SQL: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      project TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `,
  SCHEMA_VERSION: 14,
  RETENTION_CONFIG: {
    activeSessionMaxAge: 24 * 60 * 60 * 1000,
    archivedSessionMaxAge: 30 * 24 * 60 * 60 * 1000,
    statusHistoryMaxAge: 7 * 24 * 60 * 60 * 1000,
    cleanupInterval: 60 * 60 * 1000,
  },
}));

describe('Database Index', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Try to close database if it was opened
    try {
      const { closeDatabase } = await import('../../src/db/index.js');
      closeDatabase();
    } catch {
      // Ignore errors
    }
  });

  describe('getDatabase', () => {
    it('throws error if database not initialized', async () => {
      const { getDatabase } = await import('../../src/db/index.js');

      expect(() => getDatabase()).toThrow('Database not initialized');
    });

    it('returns database instance after initialization', async () => {
      const { initTestDatabase, getDatabase } = await import('../../src/db/index.js');

      initTestDatabase();
      const db = getDatabase();

      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(Database);
    });
  });

  describe('initTestDatabase', () => {
    it('creates in-memory database', async () => {
      const { initTestDatabase } = await import('../../src/db/index.js');

      const db = initTestDatabase();

      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(Database);
    });

    it('creates tables in database', async () => {
      const { initTestDatabase } = await import('../../src/db/index.js');

      const db = initTestDatabase();

      // Check that tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('schema_version');
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('status_history');
    });

    it('sets schema version', async () => {
      const { initTestDatabase } = await import('../../src/db/index.js');

      const db = initTestDatabase();

      const version = db
        .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
        .get() as { version: number };

      expect(version.version).toBe(14);
    });
  });

  // Note: initDatabase with file paths is implicitly tested by other agent integration tests
  // The core database functionality (migrations, tables, stats) is tested via initTestDatabase

  describe('closeDatabase', () => {
    it('closes database connection', async () => {
      const { initTestDatabase, closeDatabase, getDatabase } =
        await import('../../src/db/index.js');

      initTestDatabase();
      closeDatabase();

      // After close, getDatabase should throw
      expect(() => getDatabase()).toThrow('Database not initialized');
    });

    it('handles multiple close calls gracefully', async () => {
      const { initTestDatabase, closeDatabase } = await import('../../src/db/index.js');

      initTestDatabase();
      closeDatabase();
      closeDatabase(); // Should not throw
    });
  });

  describe('getDatabaseStats', () => {
    it('returns counts for all tables', async () => {
      const { initTestDatabase, getDatabaseStats } = await import('../../src/db/index.js');

      const db = initTestDatabase();

      // Insert test data
      db.prepare(
        `
        INSERT INTO sessions (id, name, project, created_at, updated_at)
        VALUES ('s1', 'Session 1', 'project1', ${Date.now()}, ${Date.now()})
      `
      ).run();

      db.prepare(
        `
        INSERT INTO status_history (session_id, status, timestamp)
        VALUES ('s1', 'working', ${Date.now()})
      `
      ).run();

      const stats = getDatabaseStats();

      expect(stats.sessions).toBe(1);
      expect(stats.history).toBe(1);
    });

    it('returns zeros for empty database', async () => {
      const { initTestDatabase, getDatabaseStats } = await import('../../src/db/index.js');

      initTestDatabase();

      const stats = getDatabaseStats();

      expect(stats.sessions).toBe(0);
      expect(stats.history).toBe(0);
    });
  });

  describe('Schema migrations', () => {
    it('creates all required columns', async () => {
      const { initTestDatabase } = await import('../../src/db/index.js');

      const db = initTestDatabase();

      // Check sessions table has archived_at column
      const sessionColumns = db.pragma('table_info(sessions)') as Array<{ name: string }>;
      const sessionColumnNames = sessionColumns.map((c) => c.name);
      expect(sessionColumnNames).toContain('archived_at');
    });
  });
});
