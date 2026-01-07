/**
 * Logs Command Tests
 *
 * Tests for the logs command that views agent logs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    yellow: (s: string) => s,
    red: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock paths
vi.mock('../../../src/lib/paths.js', () => ({
  getAgentPaths: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('Logs Command', () => {
  let consoleLogs: string[];
  let consoleErrors: string[];
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let mockProcess: NodeJS.Process;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Capture console output
    consoleLogs = [];
    consoleErrors = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn((...args) => {
      consoleLogs.push(args.join(' '));
    });
    console.error = vi.fn((...args) => {
      consoleErrors.push(args.join(' '));
    });

    // Mock process.exit
    mockProcess = { ...process };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('shows message when no logs exist', async () => {
    const { existsSync } = await import('fs');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');

    vi.mocked(getAgentPaths).mockReturnValue({
      logDir: '/home/user/Library/Logs/247-agent',
    } as any);
    vi.mocked(existsSync).mockReturnValue(false);

    const { logsCommand } = await import('../../../src/commands/logs.js');
    await logsCommand.parseAsync(['node', 'logs']);

    expect(consoleLogs.some((log) => log.includes('No logs found'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('agent.log'))).toBe(true);
  });

  it('uses error log file when --errors option is set', async () => {
    const { existsSync } = await import('fs');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { spawn } = await import('child_process');

    vi.mocked(getAgentPaths).mockReturnValue({
      logDir: '/home/user/Library/Logs/247-agent',
    } as any);
    vi.mocked(existsSync).mockReturnValue(true);

    const mockTail = new EventEmitter() as any;
    mockTail.kill = vi.fn();
    vi.mocked(spawn).mockReturnValue(mockTail);

    const { logsCommand } = await import('../../../src/commands/logs.js');
    // Parse without waiting
    logsCommand.parseAsync(['node', 'logs', '--errors']);

    // Wait for spawn to be called
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(spawn).toHaveBeenCalledWith(
      'tail',
      expect.arrayContaining([expect.stringContaining('agent.error.log')]),
      { stdio: 'inherit' }
    );
  });

  it('spawns tail with correct arguments', async () => {
    const { existsSync } = await import('fs');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { spawn } = await import('child_process');

    vi.mocked(getAgentPaths).mockReturnValue({
      logDir: '/home/user/Library/Logs/247-agent',
    } as any);
    vi.mocked(existsSync).mockReturnValue(true);

    const mockTail = new EventEmitter() as any;
    mockTail.kill = vi.fn();
    vi.mocked(spawn).mockReturnValue(mockTail);

    const { logsCommand } = await import('../../../src/commands/logs.js');
    logsCommand.parseAsync(['node', 'logs', '-n', '100']);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(spawn).toHaveBeenCalledWith(
      'tail',
      ['-n', '100', expect.stringContaining('agent.log')],
      { stdio: 'inherit' }
    );
  });

  it('spawns tail with -f flag when following', async () => {
    const { existsSync } = await import('fs');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { spawn } = await import('child_process');

    vi.mocked(getAgentPaths).mockReturnValue({
      logDir: '/home/user/Library/Logs/247-agent',
    } as any);
    vi.mocked(existsSync).mockReturnValue(true);

    const mockTail = new EventEmitter() as any;
    mockTail.kill = vi.fn();
    vi.mocked(spawn).mockReturnValue(mockTail);

    const { logsCommand } = await import('../../../src/commands/logs.js');
    logsCommand.parseAsync(['node', 'logs', '--follow']);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(spawn).toHaveBeenCalledWith('tail', expect.arrayContaining(['-f']), {
      stdio: 'inherit',
    });
  });

  it('handles tail spawn error', async () => {
    const { existsSync } = await import('fs');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { spawn } = await import('child_process');

    vi.mocked(getAgentPaths).mockReturnValue({
      logDir: '/home/user/Library/Logs/247-agent',
    } as any);
    vi.mocked(existsSync).mockReturnValue(true);

    const mockTail = new EventEmitter() as any;
    mockTail.kill = vi.fn();
    vi.mocked(spawn).mockReturnValue(mockTail);

    // Mock process.exit
    const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    const { logsCommand } = await import('../../../src/commands/logs.js');
    logsCommand.parseAsync(['node', 'logs']);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Emit error
    try {
      mockTail.emit('error', new Error('spawn ENOENT'));
    } catch {
      // Expected exit
    }

    expect(consoleErrors.some((log) => log.includes('Failed to read logs'))).toBe(true);

    exitMock.mockRestore();
  });

  it('uses default of 50 lines', async () => {
    const { existsSync } = await import('fs');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { spawn } = await import('child_process');

    vi.mocked(getAgentPaths).mockReturnValue({
      logDir: '/home/user/Library/Logs/247-agent',
    } as any);
    vi.mocked(existsSync).mockReturnValue(true);

    const mockTail = new EventEmitter() as any;
    mockTail.kill = vi.fn();
    vi.mocked(spawn).mockReturnValue(mockTail);

    const { logsCommand } = await import('../../../src/commands/logs.js');
    logsCommand.parseAsync(['node', 'logs']);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(spawn).toHaveBeenCalledWith('tail', ['-n', '50', expect.any(String)], {
      stdio: 'inherit',
    });
  });
});
