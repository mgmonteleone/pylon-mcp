import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

describe('Environment Variable Validation', () => {
  const serverPath = join(process.cwd(), 'dist', 'index.js');
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw error when PYLON_CACHE_TTL is non-numeric', async () => {
    const result = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
      const child = spawn('node', [serverPath], {
        env: {
          ...process.env,
          PYLON_API_TOKEN: 'test-token',
          PYLON_CACHE_TTL: 'invalid-value',
        },
      });

      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code, stderr });
      });

      // Kill the process after a short timeout if it doesn't exit
      setTimeout(() => {
        child.kill();
        resolve({ code: null, stderr });
      }, 2000);
    });

    expect(result.stderr).toContain('Invalid PYLON_CACHE_TTL value');
    expect(result.stderr).toContain('invalid-value');
    expect(result.stderr).toContain('Must be a valid integer');
  });

  it('should accept valid numeric PYLON_CACHE_TTL', async () => {
    const result = await new Promise<{ code: number | null; stderr: string; stdout: string }>(
      (resolve) => {
        const child = spawn('node', [serverPath], {
          env: {
            ...process.env,
            PYLON_API_TOKEN: 'test-token',
            PYLON_CACHE_TTL: '5000',
          },
        });

        let stderr = '';
        let stdout = '';

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.on('close', (code) => {
          resolve({ code, stderr, stdout });
        });

        // Kill the process after a short timeout (server should start successfully)
        setTimeout(() => {
          child.kill();
          resolve({ code: null, stderr, stdout });
        }, 2000);
      }
    );

    // Should not contain error about invalid cache TTL
    expect(result.stderr).not.toContain('Invalid PYLON_CACHE_TTL value');
  });

  it('should accept PYLON_CACHE_TTL=0 to disable caching', async () => {
    const result = await new Promise<{ code: number | null; stderr: string; stdout: string }>(
      (resolve) => {
        const child = spawn('node', [serverPath], {
          env: {
            ...process.env,
            PYLON_API_TOKEN: 'test-token',
            PYLON_CACHE_TTL: '0',
          },
        });

        let stderr = '';
        let stdout = '';

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.on('close', (code) => {
          resolve({ code, stderr, stdout });
        });

        // Kill the process after a short timeout (server should start successfully)
        setTimeout(() => {
          child.kill();
          resolve({ code: null, stderr, stdout });
        }, 2000);
      }
    );

    // Should not contain error about invalid cache TTL
    expect(result.stderr).not.toContain('Invalid PYLON_CACHE_TTL value');
  });

  it('should work when PYLON_CACHE_TTL is not set (use default)', async () => {
    const result = await new Promise<{ code: number | null; stderr: string; stdout: string }>(
      (resolve) => {
        const child = spawn('node', [serverPath], {
          env: {
            ...process.env,
            PYLON_API_TOKEN: 'test-token',
            PYLON_CACHE_TTL: undefined,
          },
        });

        let stderr = '';
        let stdout = '';

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.on('close', (code) => {
          resolve({ code, stderr, stdout });
        });

        // Kill the process after a short timeout (server should start successfully)
        setTimeout(() => {
          child.kill();
          resolve({ code: null, stderr, stdout });
        }, 2000);
      }
    );

    // Should not contain error about invalid cache TTL
    expect(result.stderr).not.toContain('Invalid PYLON_CACHE_TTL value');
  });
});
