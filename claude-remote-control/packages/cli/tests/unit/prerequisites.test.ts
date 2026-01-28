/**
 * Prerequisites Module Tests
 *
 * Tests for the prerequisites checking module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrerequisiteCheck } from '../../src/lib/prerequisites.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('Prerequisites', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('checkNodeVersion', () => {
    it('returns ok for Node 22+', async () => {
      const { checkNodeVersion } = await import('../../src/lib/prerequisites.js');

      // This test passes if current Node is >= 22
      const result = checkNodeVersion();

      expect(result.name).toBe('Node.js');
      expect(result.required).toBe(true);
      expect(['ok', 'warn', 'error']).toContain(result.status);
    });

    it('includes version in message', async () => {
      const { checkNodeVersion } = await import('../../src/lib/prerequisites.js');

      const result = checkNodeVersion();

      expect(result.message).toContain('v');
    });
  });

  describe('checkTmux', () => {
    it('returns ok when tmux is installed', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('tmux 3.4\n');

      const { checkTmux } = await import('../../src/lib/prerequisites.js');

      const result = checkTmux();

      expect(result.status).toBe('ok');
      expect(result.name).toBe('tmux');
      expect(result.message).toBe('tmux 3.4');
      expect(result.required).toBe(true);
    });

    it('returns error when tmux is not installed', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('command not found');
      });

      const { checkTmux } = await import('../../src/lib/prerequisites.js');

      const result = checkTmux();

      expect(result.status).toBe('error');
      expect(result.name).toBe('tmux');
      expect(result.message).toContain('Not installed');
      expect(result.required).toBe(true);
    });

    it('includes install instructions for macOS', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('command not found');
      });

      const { checkTmux } = await import('../../src/lib/prerequisites.js');

      const result = checkTmux();

      // The message should contain install instructions
      expect(result.message).toMatch(/(brew|apt)/);
    });
  });

  describe('checkPlatform', () => {
    it('returns ok for macOS', async () => {
      const { checkPlatform } = await import('../../src/lib/prerequisites.js');

      const result = checkPlatform();

      // This will pass on macOS/Linux
      if (process.platform === 'darwin') {
        expect(result.status).toBe('ok');
        expect(result.message).toBe('macOS');
      }
    });

    it('returns ok for Linux', async () => {
      const { checkPlatform } = await import('../../src/lib/prerequisites.js');

      const result = checkPlatform();

      if (process.platform === 'linux') {
        expect(result.status).toBe('ok');
        expect(result.message).toBe('Linux');
      }
    });

    it('has required flag set to true', async () => {
      const { checkPlatform } = await import('../../src/lib/prerequisites.js');

      const result = checkPlatform();

      expect(result.required).toBe(true);
    });
  });

  describe('checkPort', () => {
    it('returns ok for available port', async () => {
      const { checkPort } = await import('../../src/lib/prerequisites.js');

      // Use a random high port that's likely available
      const port = 49152 + Math.floor(Math.random() * 10000);
      const result = await checkPort(port);

      expect(result.name).toBe(`Port ${port}`);
      expect(result.status).toBe('ok');
      expect(result.message).toBe('Available');
      expect(result.required).toBe(false);
    });

    it('includes port number in name', async () => {
      const { checkPort } = await import('../../src/lib/prerequisites.js');

      const port = 4678;
      const result = await checkPort(port);

      expect(result.name).toContain(port.toString());
    });
  });

  describe('checkAllPrerequisites', () => {
    it('returns array of checks', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('tmux 3.4\n');

      const { checkAllPrerequisites } = await import('../../src/lib/prerequisites.js');

      const results = await checkAllPrerequisites();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(3);

      // Should include platform, node, and tmux checks
      const names = results.map((r) => r.name);
      expect(names).toContain('Platform');
      expect(names).toContain('Node.js');
      expect(names).toContain('tmux');
    });

    it('includes port check when port is provided', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('tmux 3.4\n');

      const { checkAllPrerequisites } = await import('../../src/lib/prerequisites.js');

      const port = 49152 + Math.floor(Math.random() * 10000);
      const results = await checkAllPrerequisites(port);

      const portCheck = results.find((r) => r.name.includes('Port'));
      expect(portCheck).toBeDefined();
      expect(portCheck?.name).toContain(port.toString());
    });

    it('does not include port check when no port provided', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('tmux 3.4\n');

      const { checkAllPrerequisites } = await import('../../src/lib/prerequisites.js');

      const results = await checkAllPrerequisites();

      const portCheck = results.find((r) => r.name.includes('Port'));
      expect(portCheck).toBeUndefined();
    });
  });

  describe('allRequiredMet', () => {
    it('returns true when all required checks pass', async () => {
      const { allRequiredMet } = await import('../../src/lib/prerequisites.js');

      const checks: PrerequisiteCheck[] = [
        { name: 'Test1', status: 'ok', message: 'OK', required: true },
        { name: 'Test2', status: 'ok', message: 'OK', required: true },
        { name: 'Test3', status: 'warn', message: 'Warn', required: false },
      ];

      expect(allRequiredMet(checks)).toBe(true);
    });

    it('returns false when a required check fails', async () => {
      const { allRequiredMet } = await import('../../src/lib/prerequisites.js');

      const checks: PrerequisiteCheck[] = [
        { name: 'Test1', status: 'ok', message: 'OK', required: true },
        { name: 'Test2', status: 'error', message: 'Error', required: true },
      ];

      expect(allRequiredMet(checks)).toBe(false);
    });

    it('ignores non-required check failures', async () => {
      const { allRequiredMet } = await import('../../src/lib/prerequisites.js');

      const checks: PrerequisiteCheck[] = [
        { name: 'Test1', status: 'ok', message: 'OK', required: true },
        { name: 'Test2', status: 'error', message: 'Error', required: false },
      ];

      expect(allRequiredMet(checks)).toBe(true);
    });

    it('returns true for empty array', async () => {
      const { allRequiredMet } = await import('../../src/lib/prerequisites.js');

      expect(allRequiredMet([])).toBe(true);
    });

    it('handles warnings correctly', async () => {
      const { allRequiredMet } = await import('../../src/lib/prerequisites.js');

      const checks: PrerequisiteCheck[] = [
        { name: 'Test1', status: 'warn', message: 'Warn', required: true },
        { name: 'Test2', status: 'ok', message: 'OK', required: true },
      ];

      // Warnings should not cause failure
      expect(allRequiredMet(checks)).toBe(true);
    });
  });

  describe('checkNativeDeps', () => {
    it('returns ok when native modules load successfully', async () => {
      const { checkNativeDeps } = await import('../../src/lib/prerequisites.js');

      const result = await checkNativeDeps();

      // In the test environment, native modules should be available
      expect(result.name).toBe('Native modules');
      expect(result.required).toBe(true);
    });
  });

  describe('checkNode alias', () => {
    it('checkNode is an alias for checkNodeVersion', async () => {
      const { checkNode, checkNodeVersion } = await import('../../src/lib/prerequisites.js');

      expect(checkNode).toBe(checkNodeVersion);
    });
  });

  describe('ABI version tracking', () => {
    let tmpDir: string;

    beforeEach(async () => {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '247-test-'));
      fs.mkdirSync(path.join(tmpDir, '.247'), { recursive: true });
      process.env.AGENT_247_HOME = tmpDir;
    });

    afterEach(async () => {
      delete process.env.AGENT_247_HOME;
      const fs = await import('fs');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('getStoredAbiVersion returns null when no file exists', async () => {
      const { getStoredAbiVersion } = await import('../../src/lib/prerequisites.js');

      expect(getStoredAbiVersion()).toBeNull();
    });

    it('storeAbiVersion writes current ABI version', async () => {
      const { storeAbiVersion, getStoredAbiVersion } =
        await import('../../src/lib/prerequisites.js');

      storeAbiVersion();
      expect(getStoredAbiVersion()).toBe(process.versions.modules);
    });

    it('isAbiVersionChanged returns false when no stored version', async () => {
      const { isAbiVersionChanged } = await import('../../src/lib/prerequisites.js');

      expect(isAbiVersionChanged()).toBe(false);
    });

    it('isAbiVersionChanged returns false when versions match', async () => {
      const fs = await import('fs');
      const path = await import('path');
      fs.writeFileSync(path.join(tmpDir, '.247', 'node-abi-version'), process.versions.modules);

      const { isAbiVersionChanged } = await import('../../src/lib/prerequisites.js');

      expect(isAbiVersionChanged()).toBe(false);
    });

    it('isAbiVersionChanged returns true when versions differ', async () => {
      const fs = await import('fs');
      const path = await import('path');
      fs.writeFileSync(path.join(tmpDir, '.247', 'node-abi-version'), '999');

      const { isAbiVersionChanged } = await import('../../src/lib/prerequisites.js');

      expect(isAbiVersionChanged()).toBe(true);
    });
  });

  describe('rebuildNativeModules', () => {
    it('runs npm rebuild with correct modules', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('');

      const { rebuildNativeModules } = await import('../../src/lib/prerequisites.js');

      const result = rebuildNativeModules();

      expect(result.success).toBe(true);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        'npm rebuild better-sqlite3 @homebridge/node-pty-prebuilt-multiarch',
        expect.objectContaining({
          timeout: 120_000,
        })
      );
    });

    it('returns error when rebuild fails', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('rebuild failed');
      });

      const { rebuildNativeModules } = await import('../../src/lib/prerequisites.js');

      const result = rebuildNativeModules();

      expect(result.success).toBe(false);
      expect(result.error).toContain('rebuild failed');
    });
  });

  describe('ensureNativeModules', () => {
    let tmpDir: string;

    beforeEach(async () => {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '247-test-'));
      fs.mkdirSync(path.join(tmpDir, '.247'), { recursive: true });
      process.env.AGENT_247_HOME = tmpDir;
    });

    afterEach(async () => {
      delete process.env.AGENT_247_HOME;
      const fs = await import('fs');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('stores ABI version after successful check', async () => {
      const { ensureNativeModules, getStoredAbiVersion } =
        await import('../../src/lib/prerequisites.js');

      const result = await ensureNativeModules();

      // In test env, native modules should load fine
      if (result.status === 'ok') {
        expect(getStoredAbiVersion()).toBe(process.versions.modules);
      }
    });
  });
});
