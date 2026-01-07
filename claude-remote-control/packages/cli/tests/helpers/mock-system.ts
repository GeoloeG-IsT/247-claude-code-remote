/**
 * Shared mocking utilities for CLI integration tests
 */
import { vi } from 'vitest';
import { EventEmitter } from 'events';

// ============= TYPES =============

export interface MockFsState {
  files: Map<string, string>;
  directories: Set<string>;
}

export interface MockChildProcess extends EventEmitter {
  pid: number;
  unref: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
}

export interface CapturedOutput {
  logs: string[];
  errors: string[];
  warns: string[];
}

export interface MockSystemState {
  fs: MockFsState;
  runningPids: Set<number>;
  output: CapturedOutput;
  promptResponses: unknown[];
}

// ============= MOCK PATHS =============

export const mockPaths = {
  cliRoot: '/mock/cli',
  agentRoot: '/mock/agent',
  hooksSource: '/mock/hooks',
  hooksDestination: '/mock/.claude-plugins/247-hooks',
  configDir: '/mock/.247',
  configPath: '/mock/.247/config.json',
  profilesDir: '/mock/.247/profiles',
  dataDir: '/mock/.247/data',
  logDir: '/mock/.247/logs',
  pidFile: '/mock/.247/agent.pid',
  nodePath: '/usr/local/bin/node',
  isDev: false,
};

// ============= TEST FIXTURES =============

export const validConfig = {
  machine: { id: 'test-uuid-1234', name: 'Test Machine' },
  agent: { port: 4678 },
  projects: { basePath: '~/Dev', whitelist: [] },
};

export function createConfig(overrides?: Partial<typeof validConfig>) {
  return { ...validConfig, ...overrides };
}

// ============= FACTORY FUNCTIONS =============

export function createMockFsState(): MockFsState {
  return {
    files: new Map(),
    directories: new Set(),
  };
}

export function createMockSystem(): MockSystemState {
  return {
    fs: createMockFsState(),
    runningPids: new Set(),
    output: { logs: [], errors: [], warns: [] },
    promptResponses: [],
  };
}

export function createMockChild(options: { pid?: number } = {}): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.pid = options.pid ?? 99999;
  child.unref = vi.fn();
  child.kill = vi.fn();
  return child;
}

// ============= MOCK IMPLEMENTATIONS =============

export function createFsMock(state: MockFsState) {
  return {
    existsSync: vi.fn((path: string) => state.files.has(path) || state.directories.has(path)),
    readFileSync: vi.fn((path: string) => {
      const content = state.files.get(path);
      if (content === undefined) {
        const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
        (err as NodeJS.ErrnoException).code = 'ENOENT';
        throw err;
      }
      return content;
    }),
    writeFileSync: vi.fn((path: string, content: string) => {
      state.files.set(path, content);
    }),
    mkdirSync: vi.fn((path: string, options?: { recursive?: boolean }) => {
      state.directories.add(path);
      if (options?.recursive) {
        // Add parent directories
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) {
          state.directories.add(parts.slice(0, i + 1).join('/'));
        }
      }
    }),
    unlinkSync: vi.fn((path: string) => {
      state.files.delete(path);
    }),
    readdirSync: vi.fn(() => []),
    lstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
    rmSync: vi.fn(),
    copyFileSync: vi.fn((src: string, dest: string) => {
      const content = state.files.get(src);
      if (content !== undefined) {
        state.files.set(dest, content);
      }
    }),
    symlinkSync: vi.fn(),
    openSync: vi.fn(() => 3), // Fake file descriptor
  };
}

export function createProcessKillMock(runningPids: Set<number>) {
  return vi.fn((pid: number, signal?: string | number) => {
    // Signal 0 is used to check if process exists
    if (signal === 0) {
      if (!runningPids.has(pid)) {
        const err = new Error('ESRCH');
        (err as NodeJS.ErrnoException).code = 'ESRCH';
        throw err;
      }
      return true;
    }
    // SIGTERM or SIGKILL kills the process
    if (signal === 'SIGTERM' || signal === 'SIGKILL' || signal === 15 || signal === 9) {
      runningPids.delete(pid);
    }
    return true;
  });
}

export function createOraMock() {
  const spinnerMock = {
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: '',
  };
  return vi.fn(() => spinnerMock);
}

export function createEnquirerMock(responses: unknown[]) {
  return {
    prompt: vi.fn(() => Promise.resolve(responses.shift())),
  };
}

// ============= CONSOLE CAPTURE =============

export function captureConsole(): CapturedOutput {
  const output: CapturedOutput = { logs: [], errors: [], warns: [] };

  vi.spyOn(console, 'log').mockImplementation((...args) => {
    output.logs.push(args.join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    output.errors.push(args.join(' '));
  });
  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    output.warns.push(args.join(' '));
  });

  return output;
}

// ============= SETUP HELPERS =============

export function setupDefaultDirectories(state: MockFsState) {
  state.directories.add('/mock');
  state.directories.add('/mock/.247');
  state.directories.add('/mock/.247/profiles');
  state.directories.add('/mock/.247/data');
  state.directories.add('/mock/.247/logs');
  state.directories.add('/mock/agent');
  state.directories.add('/mock/hooks');
}

export function setupAgentEntryPoint(state: MockFsState) {
  state.files.set('/mock/agent/dist/index.js', '// agent entry point');
}

export function setupHooksSource(state: MockFsState) {
  state.directories.add('/mock/hooks/.claude-plugin');
  state.files.set('/mock/hooks/.claude-plugin/plugin.json', JSON.stringify({ version: '1.0.0' }));
}

export function setupExistingConfig(state: MockFsState, config = validConfig) {
  state.files.set('/mock/.247/config.json', JSON.stringify(config, null, 2));
}
