// @vitest-environment node

import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareCloudflarePages } from './prepare-cloudflare-pages.mjs';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((directory) => rm(directory, { force: true, recursive: true })));
  tempDirs.length = 0;
});

describe('prepareCloudflarePages', () => {
  it('nests a clean static build while keeping Pages metadata at the upload root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hoa-cloudflare-pages-'));
    const sourceDirectory = join(root, 'dist');
    const outputDirectory = join(root, 'cloudflare-pages');
    const appDirectory = join(outputDirectory, 'higher-order-aberration-visualizer');
    tempDirs.push(root);

    await mkdir(join(sourceDirectory, 'assets'), { recursive: true });
    await mkdir(join(sourceDirectory, 'locales/en'), { recursive: true });
    await mkdir(join(sourceDirectory, 'pyodide'), { recursive: true });
    await writeFile(join(sourceDirectory, 'index.html'), '<main>app</main>');
    await writeFile(join(sourceDirectory, '404.html'), '<main>app</main>');
    await writeFile(join(sourceDirectory, 'assets/app.js'), 'export {};');
    await writeFile(join(sourceDirectory, 'locales/en/translation.json'), '{}');
    await writeFile(join(sourceDirectory, 'pyodide/prysm.whl'), 'wheel');
    await writeFile(join(sourceDirectory, 'sw.js'), 'self.addEventListener("fetch", () => {});');
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, 'stale.txt'), 'stale');

    await prepareCloudflarePages(sourceDirectory, outputDirectory);

    await expect(readFile(join(appDirectory, 'index.html'), 'utf8')).resolves.toBe(
      '<main>app</main>'
    );
    await expect(readFile(join(appDirectory, '404.html'), 'utf8')).resolves.toBe(
      '<main>app</main>'
    );
    await expect(readFile(join(appDirectory, 'assets/app.js'), 'utf8')).resolves.toBe(
      'export {};'
    );
    await expect(readFile(join(appDirectory, 'locales/en/translation.json'), 'utf8')).resolves.toBe(
      '{}'
    );
    await expect(readFile(join(appDirectory, 'pyodide/prysm.whl'), 'utf8')).resolves.toBe('wheel');
    await expect(readFile(join(appDirectory, 'sw.js'), 'utf8')).resolves.toContain(
      'addEventListener'
    );
    await expect(readFile(join(outputDirectory, '_redirects'), 'utf8')).resolves.toBe(
      '/ /higher-order-aberration-visualizer/ 302\n'
    );
    await expect(readFile(join(outputDirectory, '_headers'), 'utf8')).resolves.toBe(
      [
        '/higher-order-aberration-visualizer/*',
        '  Cross-Origin-Opener-Policy: same-origin',
        '  Cross-Origin-Embedder-Policy: require-corp',
        '  Permissions-Policy: tools=(self)',
        ''
      ].join('\n')
    );
    await expect(access(join(outputDirectory, 'stale.txt'))).rejects.toThrow();
    await expect(access(join(appDirectory, '_headers'))).rejects.toThrow();
    await expect(access(join(appDirectory, '_redirects'))).rejects.toThrow();
    await expect(access(join(outputDirectory, 'pyodide'))).rejects.toThrow();
  });
});
