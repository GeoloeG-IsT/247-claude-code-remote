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

// Mock crypto for UUID generation
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

describe('Environments Database', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Create fresh in-memory database with schema
    mockDb = new Database(':memory:');
    mockDb.exec(`
      CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        icon TEXT,
        is_default INTEGER DEFAULT 0,
        variables TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_environments (
        session_name TEXT PRIMARY KEY,
        environment_id TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    if (mockDb) {
      mockDb.close();
      mockDb = null;
    }
  });

  describe('createEnvironment', () => {
    it('creates environment with required fields', async () => {
      const { createEnvironment } = await import('../../src/db/environments.js');

      const env = createEnvironment({
        name: 'Test Env',
        provider: 'anthropic',
        variables: { API_KEY: 'test-key' },
      });

      expect(env.name).toBe('Test Env');
      expect(env.provider).toBe('anthropic');
      expect(env.variables).toEqual({ API_KEY: 'test-key' });
      expect(env.isDefault).toBe(true); // First environment is default
    });

    it('makes first environment default automatically', async () => {
      const { createEnvironment } = await import('../../src/db/environments.js');

      const first = createEnvironment({
        name: 'First Env',
        provider: 'anthropic',
        variables: {},
      });

      expect(first.isDefault).toBe(true);

      const second = createEnvironment({
        name: 'Second Env',
        provider: 'openai',
        variables: {},
        isDefault: false,
      });

      expect(second.isDefault).toBe(false);
    });

    it('unsets other defaults when creating default', async () => {
      const { createEnvironment, getEnvironment } = await import('../../src/db/environments.js');

      const first = createEnvironment({
        name: 'First',
        provider: 'anthropic',
        variables: {},
        isDefault: true,
      });

      const second = createEnvironment({
        name: 'Second',
        provider: 'openai',
        variables: {},
        isDefault: true,
      });

      // Reload first to check it's no longer default
      const firstUpdated = getEnvironment(first.id);
      expect(firstUpdated?.isDefault).toBe(false);
      expect(second.isDefault).toBe(true);
    });

    it('includes icon when provided', async () => {
      const { createEnvironment } = await import('../../src/db/environments.js');

      const env = createEnvironment({
        name: 'With Icon',
        provider: 'anthropic',
        variables: {},
        icon: 'brain',
      });

      expect(env.icon).toBe('brain');
    });
  });

  describe('getEnvironment', () => {
    it('returns environment by ID', async () => {
      const { createEnvironment, getEnvironment } = await import('../../src/db/environments.js');

      const created = createEnvironment({
        name: 'Test',
        provider: 'anthropic',
        variables: { KEY: 'value' },
      });

      const found = getEnvironment(created.id);

      expect(found).toBeDefined();
      expect(found?.name).toBe('Test');
      expect(found?.variables).toEqual({ KEY: 'value' });
    });

    it('returns undefined for non-existent ID', async () => {
      const { getEnvironment } = await import('../../src/db/environments.js');

      const found = getEnvironment('non-existent');

      expect(found).toBeUndefined();
    });
  });

  describe('getAllEnvironments', () => {
    it('returns all environments sorted by name', async () => {
      const { createEnvironment, getAllEnvironments } =
        await import('../../src/db/environments.js');

      createEnvironment({ name: 'Zulu', provider: 'anthropic', variables: {} });
      createEnvironment({ name: 'Alpha', provider: 'openai', variables: {} });
      createEnvironment({ name: 'Mike', provider: 'anthropic', variables: {} });

      const all = getAllEnvironments();

      expect(all).toHaveLength(3);
      expect(all[0].name).toBe('Alpha');
      expect(all[1].name).toBe('Mike');
      expect(all[2].name).toBe('Zulu');
    });

    it('returns empty array when no environments', async () => {
      const { getAllEnvironments } = await import('../../src/db/environments.js');

      const all = getAllEnvironments();

      expect(all).toEqual([]);
    });
  });

  describe('getEnvironmentsMetadata', () => {
    it('returns metadata without variable values', async () => {
      const { createEnvironment, getEnvironmentsMetadata } =
        await import('../../src/db/environments.js');

      createEnvironment({
        name: 'Secret Env',
        provider: 'anthropic',
        variables: { SECRET_KEY: 'super-secret-value' },
      });

      const metadata = getEnvironmentsMetadata();

      expect(metadata).toHaveLength(1);
      expect(metadata[0].name).toBe('Secret Env');
      expect(metadata[0].variableKeys).toEqual(['SECRET_KEY']);
      expect((metadata[0] as any).variables).toBeUndefined();
    });
  });

  describe('updateEnvironment', () => {
    it('updates environment name', async () => {
      const { createEnvironment, updateEnvironment } = await import('../../src/db/environments.js');

      const created = createEnvironment({
        name: 'Original',
        provider: 'anthropic',
        variables: {},
      });

      const updated = updateEnvironment(created.id, { name: 'Updated' });

      expect(updated?.name).toBe('Updated');
    });

    it('merges variables instead of replacing', async () => {
      const { createEnvironment, updateEnvironment } = await import('../../src/db/environments.js');

      const created = createEnvironment({
        name: 'Test',
        provider: 'anthropic',
        variables: { KEY1: 'value1', KEY2: 'value2' },
      });

      const updated = updateEnvironment(created.id, {
        variables: { KEY2: 'updated', KEY3: 'new' },
      });

      expect(updated?.variables).toEqual({
        KEY1: 'value1',
        KEY2: 'updated',
        KEY3: 'new',
      });
    });

    it('returns null for non-existent ID', async () => {
      const { updateEnvironment } = await import('../../src/db/environments.js');

      const result = updateEnvironment('non-existent', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('unsets other defaults when setting as default', async () => {
      const { createEnvironment, updateEnvironment, getEnvironment } =
        await import('../../src/db/environments.js');

      const first = createEnvironment({
        name: 'First',
        provider: 'anthropic',
        variables: {},
        isDefault: true,
      });

      const second = createEnvironment({
        name: 'Second',
        provider: 'openai',
        variables: {},
      });

      updateEnvironment(second.id, { isDefault: true });

      const firstUpdated = getEnvironment(first.id);
      const secondUpdated = getEnvironment(second.id);

      expect(firstUpdated?.isDefault).toBe(false);
      expect(secondUpdated?.isDefault).toBe(true);
    });
  });

  describe('deleteEnvironment', () => {
    it('deletes existing environment', async () => {
      const { createEnvironment, deleteEnvironment, getEnvironment } =
        await import('../../src/db/environments.js');

      const created = createEnvironment({
        name: 'To Delete',
        provider: 'anthropic',
        variables: {},
      });

      const result = deleteEnvironment(created.id);

      expect(result).toBe(true);
      expect(getEnvironment(created.id)).toBeUndefined();
    });

    it('returns false for non-existent ID', async () => {
      const { deleteEnvironment } = await import('../../src/db/environments.js');

      const result = deleteEnvironment('non-existent');

      expect(result).toBe(false);
    });

    it('promotes another environment to default when deleting default', async () => {
      const { createEnvironment, deleteEnvironment, getEnvironment } =
        await import('../../src/db/environments.js');

      const first = createEnvironment({
        name: 'First',
        provider: 'anthropic',
        variables: {},
        isDefault: true,
      });

      const second = createEnvironment({
        name: 'Second',
        provider: 'openai',
        variables: {},
      });

      deleteEnvironment(first.id);

      const secondUpdated = getEnvironment(second.id);
      expect(secondUpdated?.isDefault).toBe(true);
    });
  });

  describe('getDefaultEnvironment', () => {
    it('returns default environment', async () => {
      const { createEnvironment, getDefaultEnvironment } =
        await import('../../src/db/environments.js');

      createEnvironment({
        name: 'First',
        provider: 'anthropic',
        variables: {},
        isDefault: false,
      });

      createEnvironment({
        name: 'Default',
        provider: 'openai',
        variables: {},
        isDefault: true,
      });

      const defaultEnv = getDefaultEnvironment();

      expect(defaultEnv?.name).toBe('Default');
    });

    it('returns undefined when no environments', async () => {
      const { getDefaultEnvironment } = await import('../../src/db/environments.js');

      const defaultEnv = getDefaultEnvironment();

      expect(defaultEnv).toBeUndefined();
    });
  });

  describe('Session Environment Tracking', () => {
    it('sets and gets session environment', async () => {
      const { createEnvironment, setSessionEnvironment, getSessionEnvironment } =
        await import('../../src/db/environments.js');

      const env = createEnvironment({
        name: 'Session Env',
        provider: 'anthropic',
        variables: {},
      });

      setSessionEnvironment('test-session', env.id);
      const foundId = getSessionEnvironment('test-session');

      expect(foundId).toBe(env.id);
    });

    it('returns undefined for untracked session', async () => {
      const { getSessionEnvironment } = await import('../../src/db/environments.js');

      const foundId = getSessionEnvironment('untracked-session');

      expect(foundId).toBeUndefined();
    });

    it('clears session environment', async () => {
      const {
        createEnvironment,
        setSessionEnvironment,
        getSessionEnvironment,
        clearSessionEnvironment,
      } = await import('../../src/db/environments.js');

      const env = createEnvironment({
        name: 'Session Env',
        provider: 'anthropic',
        variables: {},
      });

      setSessionEnvironment('test-session', env.id);
      clearSessionEnvironment('test-session');

      const foundId = getSessionEnvironment('test-session');
      expect(foundId).toBeUndefined();
    });
  });

  describe('getEnvironmentVariables', () => {
    it('returns variables for specified environment', async () => {
      const { createEnvironment, getEnvironmentVariables } =
        await import('../../src/db/environments.js');

      const env = createEnvironment({
        name: 'Test',
        provider: 'anthropic',
        variables: { API_KEY: 'test-key', OTHER: 'value' },
      });

      const vars = getEnvironmentVariables(env.id);

      expect(vars).toEqual({ API_KEY: 'test-key', OTHER: 'value' });
    });

    it('falls back to default environment', async () => {
      const { createEnvironment, getEnvironmentVariables } =
        await import('../../src/db/environments.js');

      createEnvironment({
        name: 'Default',
        provider: 'anthropic',
        variables: { DEFAULT_KEY: 'default-value' },
        isDefault: true,
      });

      const vars = getEnvironmentVariables('non-existent-id');

      expect(vars).toEqual({ DEFAULT_KEY: 'default-value' });
    });

    it('returns empty object when no environments', async () => {
      const { getEnvironmentVariables } = await import('../../src/db/environments.js');

      const vars = getEnvironmentVariables();

      expect(vars).toEqual({});
    });
  });

  describe('ensureDefaultEnvironment', () => {
    it('creates default Anthropic environment if none exist', async () => {
      const { ensureDefaultEnvironment, getAllEnvironments } =
        await import('../../src/db/environments.js');

      ensureDefaultEnvironment();

      const envs = getAllEnvironments();
      expect(envs).toHaveLength(1);
      expect(envs[0].name).toBe('Anthropic (Default)');
      expect(envs[0].provider).toBe('anthropic');
      expect(envs[0].isDefault).toBe(true);
    });

    it('does not create if environments exist', async () => {
      const { createEnvironment, ensureDefaultEnvironment, getAllEnvironments } =
        await import('../../src/db/environments.js');

      createEnvironment({
        name: 'Existing',
        provider: 'openai',
        variables: {},
      });

      ensureDefaultEnvironment();

      const envs = getAllEnvironments();
      expect(envs).toHaveLength(1);
      expect(envs[0].name).toBe('Existing');
    });
  });
});
