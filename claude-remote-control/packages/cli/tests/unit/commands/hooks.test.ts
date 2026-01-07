/**
 * Hooks Command Tests
 *
 * Tests for the hooks command that manages Claude Code hooks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    bold: (s: string) => s,
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Mock ora
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  text: '',
};
vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner),
}));

// Mock hooks installer
vi.mock('../../../src/hooks/installer.js', () => ({
  installHooks: vi.fn(),
  uninstallHooks: vi.fn(),
  getHooksStatus: vi.fn(),
}));

describe('Hooks Command', () => {
  let consoleLogs: string[];
  let consoleErrors: string[];
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let exitMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset spinner mocks
    mockSpinner.start.mockClear().mockReturnThis();
    mockSpinner.succeed.mockClear().mockReturnThis();
    mockSpinner.fail.mockClear().mockReturnThis();
    mockSpinner.info.mockClear().mockReturnThis();

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

    // Mock process.exit to throw so we can catch it
    exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    exitMock.mockRestore();
  });

  describe('install subcommand', () => {
    it('shows info when hooks already installed', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: false,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install']);

      expect(mockSpinner.info).toHaveBeenCalledWith('Hooks are already installed');
    });

    it('suggests update when available and already installed', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: true,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install']);

      expect(consoleLogs.some((log) => log.includes('update is available'))).toBe(true);
      expect(consoleLogs.some((log) => log.includes('--force'))).toBe(true);
    });

    it('installs hooks successfully', async () => {
      const { getHooksStatus, installHooks } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        path: '',
        isSymlink: false,
        needsUpdate: false,
      });
      vi.mocked(installHooks).mockReturnValue({
        success: true,
        path: '/test/hooks/247-hooks',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install']);

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Hooks installed successfully');
    });

    it('force reinstalls when --force is set', async () => {
      const { getHooksStatus, installHooks } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: false,
      });
      vi.mocked(installHooks).mockReturnValue({
        success: true,
        path: '/test/hooks/247-hooks',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install', '--force']);

      expect(installHooks).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('shows failure message on install error', async () => {
      const { getHooksStatus, installHooks } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        path: '',
        isSymlink: false,
        needsUpdate: false,
      });
      vi.mocked(installHooks).mockReturnValue({
        success: false,
        error: 'Permission denied',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');

      try {
        await hooksCommand.parseAsync(['node', 'hooks', 'install']);
      } catch {
        // Expected process.exit
      }

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    });
  });

  describe('uninstall subcommand', () => {
    it('shows info when hooks not installed', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        path: '',
        isSymlink: false,
        needsUpdate: false,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'uninstall']);

      expect(mockSpinner.info).toHaveBeenCalledWith('Hooks are not installed');
    });

    it('uninstalls hooks successfully', async () => {
      const { getHooksStatus, uninstallHooks } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: false,
      });
      vi.mocked(uninstallHooks).mockReturnValue({ success: true });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'uninstall']);

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Hooks uninstalled successfully');
    });

    it('shows failure message on uninstall error', async () => {
      const { getHooksStatus, uninstallHooks } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: false,
      });
      vi.mocked(uninstallHooks).mockReturnValue({
        success: false,
        error: 'Directory not empty',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');

      try {
        await hooksCommand.parseAsync(['node', 'hooks', 'uninstall']);
      } catch {
        // Expected process.exit
      }

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Directory not empty'));
    });
  });

  describe('status subcommand', () => {
    it('shows not installed status', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        path: '',
        isSymlink: false,
        needsUpdate: false,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'status']);

      expect(consoleLogs.some((log) => log.includes('Not installed'))).toBe(true);
      expect(consoleLogs.some((log) => log.includes('247 hooks install'))).toBe(true);
    });

    it('shows installed status with details', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/home/user/.claude-plugins/247-hooks',
        isSymlink: true,
        needsUpdate: false,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'status']);

      expect(consoleLogs.some((log) => log.includes('Installed'))).toBe(true);
      expect(consoleLogs.some((log) => log.includes('Symlink (dev mode)'))).toBe(true);
      expect(consoleLogs.some((log) => log.includes('Up to date'))).toBe(true);
    });

    it('shows update available', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/home/user/.claude-plugins/247-hooks',
        isSymlink: false,
        needsUpdate: true,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'status']);

      expect(consoleLogs.some((log) => log.includes('Update available'))).toBe(true);
    });
  });

  describe('update subcommand', () => {
    it('shows info when hooks not installed', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        path: '',
        isSymlink: false,
        needsUpdate: false,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'update']);

      expect(mockSpinner.info).toHaveBeenCalledWith('Hooks are not installed');
    });

    it('shows success when already up to date', async () => {
      const { getHooksStatus } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: false,
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'update']);

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Hooks are already up to date');
    });

    it('updates hooks when update available', async () => {
      const { getHooksStatus, installHooks } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: true,
      });
      vi.mocked(installHooks).mockReturnValue({
        success: true,
        path: '/test/hooks/247-hooks',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'update']);

      expect(installHooks).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Hooks updated successfully');
    });

    it('shows failure message on update error', async () => {
      const { getHooksStatus, installHooks } = await import('../../../src/hooks/installer.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        path: '/test/hooks',
        isSymlink: false,
        needsUpdate: true,
      });
      vi.mocked(installHooks).mockReturnValue({
        success: false,
        error: 'Update failed',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');

      try {
        await hooksCommand.parseAsync(['node', 'hooks', 'update']);
      } catch {
        // Expected process.exit
      }

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Update failed'));
    });
  });
});
