/**
 * Heartbeat route tests
 * Tests for ghost session prevention and tmux validation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';

// Track execSync mock behavior
let tmuxSessionExists = true;

// Mock config
const mockConfig = {
  machine: { id: 'test-machine', name: 'Test Machine' },
  projects: {
    basePath: '/tmp/test-projects',
    whitelist: ['allowed-project'],
  },
  editor: {
    enabled: false,
    portRange: { start: 4680, end: 4699 },
    idleTimeout: 60000,
  },
  dashboard: {
    apiUrl: 'http://localhost:3001/api',
    apiKey: 'test-key',
  },
};

vi.mock('../../src/config.js', () => ({
  config: mockConfig,
  loadConfig: () => mockConfig,
  default: mockConfig,
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process - key mock for tmux session existence
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    if (callback) callback(null, { stdout: '', stderr: '' });
  }),
  execSync: vi.fn((cmd: string) => {
    // Check for tmux has-session command
    if (cmd.includes('tmux has-session')) {
      if (!tmuxSessionExists) {
        throw new Error('session not found');
      }
      return '';
    }
    return '';
  }),
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    proc.pid = 12345;
    return proc;
  }),
}));

// Mock node-pty
vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as any;
    proc.write = vi.fn();
    proc.resize = vi.fn();
    proc.kill = vi.fn();
    proc.onData = (cb: any) => proc.on('data', cb);
    proc.onExit = (cb: any) => proc.on('exit', cb);
    return proc;
  }),
}));

// Mock terminal
vi.mock('../../src/terminal.js', () => ({
  createTerminal: vi.fn(() => ({
    write: vi.fn(),
    resize: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
    kill: vi.fn(),
    detach: vi.fn(),
    captureHistory: vi.fn().mockResolvedValue(''),
    isExistingSession: vi.fn().mockReturnValue(false),
  })),
}));

// Mock editor
vi.mock('../../src/editor.js', () => ({
  initEditor: vi.fn(),
  getOrStartEditor: vi.fn(),
  stopEditor: vi.fn(),
  getEditorStatus: vi.fn().mockReturnValue({ running: false }),
  getAllEditors: vi.fn().mockReturnValue([]),
  updateEditorActivity: vi.fn(),
  shutdownAllEditors: vi.fn(),
}));

// Mock git functions
vi.mock('../../src/git.js', () => ({
  cloneRepo: vi.fn(),
  extractProjectName: vi.fn(),
  listFiles: vi.fn().mockResolvedValue([]),
  getFileContent: vi.fn().mockResolvedValue({ content: '', type: 'text' }),
  openFileInEditor: vi.fn().mockResolvedValue({ success: true }),
  getChangesSummary: vi.fn().mockResolvedValue({ staged: [], unstaged: [], untracked: [] }),
}));

describe('Heartbeat Route - Ghost Session Prevention', () => {
  let server: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmuxSessionExists = true; // Reset to default

    const { createServer } = await import('../../src/server.js');
    server = await createServer();
  });

  afterEach(() => {
    if (server?.close) {
      server.close();
    }
  });

  describe('POST /api/heartbeat', () => {
    it('accepts heartbeat when tmux session exists', async () => {
      tmuxSessionExists = true;

      const res = await request(server).post('/api/heartbeat').send({
        tmux_session: 'project--existing-session-42',
        cwd: '/Users/test/projects/project',
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('rejects heartbeat when tmux session does not exist (ghost prevention)', async () => {
      tmuxSessionExists = false;

      const res = await request(server).post('/api/heartbeat').send({
        tmux_session: 'project--ghost-session-99',
        cwd: '/Users/test/projects/project',
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });

    it('rejects heartbeat without tmux_session field', async () => {
      const res = await request(server).post('/api/heartbeat').send({
        cwd: '/Users/test/projects/project',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing tmux_session');
    });

    it('validates tmux session existence before processing metrics', async () => {
      tmuxSessionExists = false;

      const res = await request(server)
        .post('/api/heartbeat')
        .send({
          tmux_session: 'project--ghost-session-99',
          model: { id: 'claude-3-opus', display_name: 'Claude 3 Opus' },
          cost: { total_cost_usd: 1.5, total_duration_ms: 60000 },
          context_window: {
            context_window_size: 200000,
            current_usage: {
              input_tokens: 50000,
              output_tokens: 10000,
              cache_read_input_tokens: 5000,
            },
          },
        });

      // Should reject even with full valid payload
      expect(res.status).toBe(404);
    });
  });
});
