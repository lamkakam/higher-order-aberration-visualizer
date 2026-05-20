// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Connect, Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { excludePyodideReadmePlugin } from '../../vite.config';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })));
  tempDirs.length = 0;
});

function createServerMock() {
  let middleware: Connect.NextHandleFunction | undefined;

  const server = {
    middlewares: {
      use(handler: Connect.NextHandleFunction) {
        middleware = handler;
      }
    }
  } as ViteDevServer;

  return {
    server,
    getMiddleware() {
      if (middleware === undefined) {
        throw new Error('Expected plugin to register a dev middleware.');
      }

      return middleware;
    }
  };
}

function runConfigureServerHook(plugin: Plugin, server: ViteDevServer) {
  const hook = plugin.configureServer;

  if (typeof hook === 'function') {
    hook(server);
    return;
  }

  hook?.handler(server);
}

function runConfigResolvedHook(plugin: Plugin, config: ResolvedConfig) {
  const hook = plugin.configResolved;

  if (typeof hook === 'function') {
    hook(config);
    return;
  }

  hook?.handler(config);
}

async function runCloseBundleHook(plugin: Plugin) {
  const hook = plugin.closeBundle as (() => void | Promise<void>) | undefined;

  await hook?.();
}

describe('excludePyodideReadmePlugin', () => {
  it('returns 404 before public assets can serve the Pyodide README in dev', () => {
    const plugin = excludePyodideReadmePlugin();
    const { server, getMiddleware } = createServerMock();

    runConfigureServerHook(plugin, server);

    const request = { url: '/pyodide/README.md' } as IncomingMessage;
    const response = {
      statusCode: 200,
      end: vi.fn()
    } as unknown as ServerResponse;
    const next = vi.fn();

    getMiddleware()(request, response, next);

    expect(response.statusCode).toBe(404);
    expect(response.end).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it('removes the copied Pyodide README from build output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hoa-vite-plugin-'));
    tempDirs.push(root);
    const outputReadme = join(root, 'dist/pyodide/README.md');
    await mkdir(join(root, 'dist/pyodide'), { recursive: true });
    await writeFile(outputReadme, 'source documentation');

    const plugin = excludePyodideReadmePlugin() as Plugin;
    runConfigResolvedHook(plugin, {
      root,
      build: { outDir: 'dist' }
    } as ResolvedConfig);
    await runCloseBundleHook(plugin);

    await expect(readFile(outputReadme, 'utf8')).rejects.toThrow();
  });
});
