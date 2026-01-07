import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock paths module
const mockPaths = {
  configDir: '/mock/.247',
  configPath: '/mock/.247/config.json',
  dataDir: '/mock/.247/data',
  logDir: '/mock/.247/logs',
  pidFile: '/mock/.247/agent.pid',
  agentRoot: '/mock/agent',
  hooksSource: '/mock/agent/hooks',
  hooksDestination: '/mock/.claude-plugins/247-hooks',
  isDev: false,
  nodePath: '/usr/local/bin/node',
};

vi.mock('../../src/lib/paths.js', () => ({
  getAgentPaths: () => mockPaths,
  ensureDirectories: vi.fn(),
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  symlinkSync: vi.fn(),
  unlinkSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  lstatSync: vi.fn(),
  rmSync: vi.fn(),
}));

describe('CLI Hooks Installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Reset mock paths to defaults
    mockPaths.isDev = false;
  });

  describe('getHooksStatus', () => {
    it('returns not installed if plugin.json missing', async () => {
      const { existsSync, lstatSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.installed).toBe(false);
      expect(status.path).toBe('/mock/.claude-plugins/247-hooks');
    });

    it('returns installed status with version info', async () => {
      const { existsSync, lstatSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.installed).toBe(true);
      expect(status.isSymlink).toBe(false);
      expect(status.sourceVersion).toBe('1.0.0');
      expect(status.installedVersion).toBe('1.0.0');
    });

    it('detects when update is needed', async () => {
      const { existsSync, lstatSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);

      // Return different versions for source and installed
      let readCount = 0;
      vi.mocked(readFileSync).mockImplementation(() => {
        readCount++;
        if (readCount === 1) return JSON.stringify({ version: '2.0.0' }); // source
        return JSON.stringify({ version: '1.0.0' }); // installed
      });

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.needsUpdate).toBe(true);
      expect(status.sourceVersion).toBe('2.0.0');
      expect(status.installedVersion).toBe('1.0.0');
    });

    it('detects symlink installation', async () => {
      const { existsSync, lstatSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => true } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.isSymlink).toBe(true);
    });
  });

  describe('installHooks', () => {
    it('returns error if source not found', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { installHooks } = await import('../../src/hooks/installer.js');
      const result = installHooks();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('creates parent directory if needed', async () => {
      const { existsSync, mkdirSync, readdirSync, copyFileSync, lstatSync, readFileSync } =
        await import('fs');

      // Source exists, parent doesn't, plugin.json doesn't
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr === '/mock/agent/hooks') return true;
        if (pathStr === '/mock/.claude-plugins') return false;
        if (pathStr === '/mock/.claude-plugins/247-hooks') return false;
        if (pathStr.includes('plugin.json')) return false;
        return false;
      });

      vi.mocked(readdirSync).mockReturnValue([]);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const { installHooks } = await import('../../src/hooks/installer.js');
      const result = installHooks();

      expect(mkdirSync).toHaveBeenCalledWith('/mock/.claude-plugins', { recursive: true });
    });

    it('skips if already installed and up to date', async () => {
      const { existsSync, lstatSync, readFileSync, copyFileSync, symlinkSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const { installHooks } = await import('../../src/hooks/installer.js');
      const result = installHooks();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(false);
      expect(result.updated).toBe(false);
      expect(copyFileSync).not.toHaveBeenCalled();
      expect(symlinkSync).not.toHaveBeenCalled();
    });

    it('uses symlink in dev mode', async () => {
      mockPaths.isDev = true;

      const { existsSync, lstatSync, readFileSync, symlinkSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr === '/mock/agent/hooks') return true;
        if (pathStr.includes('plugin.json')) return false;
        return false;
      });
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const { installHooks } = await import('../../src/hooks/installer.js');
      const result = installHooks();

      expect(result.success).toBe(true);
      expect(symlinkSync).toHaveBeenCalledWith(
        '/mock/agent/hooks',
        '/mock/.claude-plugins/247-hooks',
        'dir'
      );
    });

    it('copies files in production mode', async () => {
      mockPaths.isDev = false;

      const { existsSync, lstatSync, readFileSync, mkdirSync, readdirSync, copyFileSync } =
        await import('fs');

      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr === '/mock/agent/hooks') return true;
        if (pathStr.includes('plugin.json')) return false;
        if (pathStr === '/mock/.claude-plugins') return true;
        return false;
      });
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file1.js', isDirectory: () => false } as any,
        { name: 'file2.js', isDirectory: () => false } as any,
      ]);

      const { installHooks } = await import('../../src/hooks/installer.js');
      const result = installHooks();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(true);
      expect(copyFileSync).toHaveBeenCalled();
    });

    it('removes existing installation before update', async () => {
      const { existsSync, lstatSync, readFileSync, rmSync, readdirSync } = await import('fs');

      // First call to existsSync for source, then various checks
      let existsCalls = 0;
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        existsCalls++;
        if (pathStr === '/mock/agent/hooks') return true;
        if (pathStr.includes('.claude-plugins/247-hooks')) return existsCalls < 10; // Exists initially, then removed
        if (pathStr === '/mock/.claude-plugins') return true;
        return false;
      });

      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);

      // Different versions to trigger update
      let readCount = 0;
      vi.mocked(readFileSync).mockImplementation(() => {
        readCount++;
        if (readCount <= 1) return JSON.stringify({ version: '2.0.0' });
        return JSON.stringify({ version: '1.0.0' });
      });

      vi.mocked(readdirSync).mockReturnValue([]);

      const { installHooks } = await import('../../src/hooks/installer.js');
      const result = installHooks();

      expect(rmSync).toHaveBeenCalledWith('/mock/.claude-plugins/247-hooks', {
        recursive: true,
        force: true,
      });
    });

    it('force reinstalls even if up to date', async () => {
      const { existsSync, lstatSync, readFileSync, rmSync, readdirSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      vi.mocked(readdirSync).mockReturnValue([]);

      const { installHooks } = await import('../../src/hooks/installer.js');
      const result = installHooks({ force: true });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(rmSync).toHaveBeenCalled();
    });
  });

  describe('uninstallHooks', () => {
    it('returns success if already uninstalled', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(true);
    });

    it('removes symlink installation', async () => {
      const { existsSync, lstatSync, unlinkSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => true } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(true);
      expect(unlinkSync).toHaveBeenCalledWith('/mock/.claude-plugins/247-hooks');
    });

    it('removes directory installation', async () => {
      const { existsSync, lstatSync, rmSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(true);
      expect(rmSync).toHaveBeenCalledWith('/mock/.claude-plugins/247-hooks', {
        recursive: true,
        force: true,
      });
    });

    it('returns error on failure', async () => {
      const { existsSync, lstatSync, rmSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      vi.mocked(rmSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });
});
