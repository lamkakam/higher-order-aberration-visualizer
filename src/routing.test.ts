import { describe, expect, it } from 'vitest';
import { createRouterBase } from './routing';

describe('createRouterBase', () => {
  it('keeps the root Vite base as root for local builds', () => {
    expect(createRouterBase('/')).toBe('/');
  });

  it('removes the trailing slash from the GitHub Pages Vite base for Wouter', () => {
    expect(createRouterBase('/higher-order-aberration-visualizer/')).toBe(
      '/higher-order-aberration-visualizer'
    );
  });
});
