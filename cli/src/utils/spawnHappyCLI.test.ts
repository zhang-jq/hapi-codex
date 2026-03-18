import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpawnOptions } from 'child_process';

const spawnMock = vi.fn((..._args: any[]) => ({ pid: 12345 } as any));

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: spawnMock
  };
});

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
const originalVersionsDescriptor = Object.getOwnPropertyDescriptor(process, 'versions');

function setPlatform(value: string) {
  Object.defineProperty(process, 'platform', {
    value,
    configurable: true
  });
}

function setBunRuntime(enabled: boolean) {
  Object.defineProperty(process, 'versions', {
    value: enabled
      ? { ...process.versions, bun: process.versions.bun ?? '1.3.10' }
      : Object.fromEntries(Object.entries(process.versions).filter(([key]) => key !== 'bun')),
    configurable: true
  });
}

function getSpawnOptionsOrThrow(): SpawnOptions {
  expect(spawnMock).toHaveBeenCalledTimes(1);
  const firstCall = spawnMock.mock.calls[0] as unknown[] | undefined;
  const options = firstCall?.[2] as SpawnOptions | undefined;
  if (!options) {
    throw new Error('Expected spawn options to be passed as third argument');
  }
  return options;
}

describe('spawnHappyCLI windowsHide behavior', () => {
  beforeAll(() => {
    if (!originalPlatformDescriptor?.configurable) {
      throw new Error('process.platform is not configurable in this runtime');
    }
    if (!originalVersionsDescriptor?.configurable) {
      throw new Error('process.versions is not configurable in this runtime');
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setBunRuntime(true);
  });

  afterAll(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }
    if (originalVersionsDescriptor) {
      Object.defineProperty(process, 'versions', originalVersionsDescriptor);
    }
  });

  it('sets windowsHide=true when platform is win32 and detached=true', async () => {
    setPlatform('win32');
    const { spawnHappyCLI } = await import('./spawnHappyCLI');

    spawnHappyCLI(['runner', 'start-sync'], {
      detached: true,
      stdio: 'ignore'
    });

    const options = getSpawnOptionsOrThrow();
    expect(options.detached).toBe(true);
    expect(options.windowsHide).toBe(true);
  });

  it('does not set windowsHide when platform is win32 but detached is false', async () => {
    setPlatform('win32');
    const { spawnHappyCLI } = await import('./spawnHappyCLI');

    spawnHappyCLI(['runner', 'start-sync'], {
      detached: false,
      stdio: 'ignore'
    });

    const options = getSpawnOptionsOrThrow();
    expect(options.detached).toBe(false);
    expect('windowsHide' in options).toBe(false);
  });

  it('does not set windowsHide on non-win32 even when detached=true', async () => {
    setPlatform('linux');
    const { spawnHappyCLI } = await import('./spawnHappyCLI');

    spawnHappyCLI(['runner', 'start-sync'], {
      detached: true,
      stdio: 'ignore'
    });

    const options = getSpawnOptionsOrThrow();
    expect(options.detached).toBe(true);
    expect('windowsHide' in options).toBe(false);
  });

  it('runs Bun dev subprocesses from the CLI project root and forwards requested cwd via env', async () => {
    setPlatform('darwin');
    const { spawnHappyCLI, HAPI_SPAWN_TARGET_CWD_ENV } = await import('./spawnHappyCLI');
    const { projectPath } = await import('@/projectPath');

    spawnHappyCLI(['codex', 'resume', 'session-123'], {
      cwd: '/tmp/resume-target',
      stdio: 'ignore',
      env: {
        TEST_FLAG: '1'
      }
    });

    const options = getSpawnOptionsOrThrow();
    expect(options.cwd).toBe(projectPath());
    expect(options.env).toMatchObject({
      TEST_FLAG: '1',
      [HAPI_SPAWN_TARGET_CWD_ENV]: '/tmp/resume-target'
    });
  });
});
