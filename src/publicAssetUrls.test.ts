import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePublicAssetPath } from './publicAssetUrls';

describe('resolvePublicAssetPath', () => {
  it('keeps root-based public asset paths unchanged for local builds', () => {
    expect(resolvePublicAssetPath('/locales/en/translation.json', '/')).toBe(
      '/locales/en/translation.json'
    );
  });

  it('prefixes public asset paths with the Vite base path for GitHub Pages builds', () => {
    expect(
      resolvePublicAssetPath(
        '/pyodide/prysm-0.21.1-py2.py3-none-any.whl',
        '/higher-order-aberration-visualizer/'
      )
    ).toBe(
      '/higher-order-aberration-visualizer/pyodide/prysm-0.21.1-py2.py3-none-any.whl'
    );
  });
});

describe('service worker public asset precache', () => {
  it('does not precache generated internal Python wheels', async () => {
    const serviceWorkerSource = await readFile(join(process.cwd(), 'public/sw.js'), 'utf8');

    expect(serviceWorkerSource).not.toMatch(
      /\/pyodide\/higher_order_aberration_visualizer_utils-[^'"]+\.whl/
    );
  });
});
