// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

async function readProjectFile(path: string) {
  return readFile(resolve(root, path), 'utf8');
}

describe('release workflow configuration', () => {
  it('runs CI on Node.js 24', async () => {
    await expect(readProjectFile('.github/workflows/ci-cd.yml')).resolves.toContain(
      'node-version: 24'
    );
  });

  it('publishes GitHub Releases from v-prefixed tags on Node.js 24', async () => {
    const workflow = await readProjectFile('.github/workflows/release.yml');

    expect(workflow).toContain("    tags:\n      - 'v*'");
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('node-version: 24');
    expect(workflow).toContain('gh release create "$GITHUB_REF_NAME" --generate-notes');
  });

  it('pins Playwright packages to 1.60.0', async () => {
    const packageJson = JSON.parse(await readProjectFile('package.json')) as {
      devDependencies: Record<string, string>;
    };
    const packageLock = JSON.parse(await readProjectFile('package-lock.json')) as {
      packages: Record<
        string,
        {
          version?: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
      >;
    };

    expect(packageJson.devDependencies['@playwright/test']).toBe('1.60.0');
    expect(packageLock.packages[''].devDependencies?.['@playwright/test']).toBe('1.60.0');
    expect(packageLock.packages['node_modules/@playwright/test'].version).toBe('1.60.0');
    expect(packageLock.packages['node_modules/playwright'].version).toBe('1.60.0');
    expect(packageLock.packages['node_modules/playwright'].dependencies?.['playwright-core']).toBe(
      '1.60.0'
    );
    expect(packageLock.packages['node_modules/playwright-core'].version).toBe('1.60.0');
  });
});
