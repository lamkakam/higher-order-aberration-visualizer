// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let ciWorkflow: string;
let releaseWorkflow: string;

beforeAll(async () => {
  [ciWorkflow, releaseWorkflow] = await Promise.all([
    readFile(resolve('.github/workflows/ci-cd.yml'), 'utf8'),
    readFile(resolve('.github/workflows/release.yml'), 'utf8')
  ]);
});

describe('deployment workflows', () => {
  it('keeps Cloudflare deployment out of the main CI workflow', () => {
    expect(ciWorkflow).not.toMatch(/cloudflare/i);
    expect(ciWorkflow).not.toContain('deployments: write');
  });

  it('runs the release workflow only for version tag pushes', () => {
    expect(releaseWorkflow).toContain("push:\n    tags:\n      - 'v*'");
    expect(releaseWorkflow).not.toMatch(/pull_request:|workflow_dispatch:|branches:/);
  });

  it('keeps the release archive root-based before rebuilding for Cloudflare', () => {
    const rootBuild = releaseWorkflow.indexOf('- name: Build');
    const packageDist = releaseWorkflow.indexOf('- name: Package dist');
    const staticBuild = releaseWorkflow.indexOf('- name: Build for Cloudflare Pages');

    expect(rootBuild).toBeGreaterThan(-1);
    expect(packageDist).toBeGreaterThan(rootBuild);
    expect(staticBuild).toBeGreaterThan(packageDist);
    expect(releaseWorkflow.slice(rootBuild, packageDist)).not.toContain(
      'STATIC_SUBPATH_DEPLOYMENT'
    );
    expect(releaseWorkflow.slice(staticBuild)).toContain("STATIC_SUBPATH_DEPLOYMENT: 'true'");
  });

  it('uploads and deploys the prepared Cloudflare production artifact', () => {
    expect(releaseWorkflow).toContain('run: npm run prepare:cloudflare');
    expect(releaseWorkflow).toContain('name: cloudflare-pages');
    expect(releaseWorkflow).toContain('path: cloudflare-pages');
    expect(releaseWorkflow).toContain('needs: release');
    expect(releaseWorkflow).toContain('environment:\n      name: cloudflare-pages');
    expect(releaseWorkflow).toContain('uses: cloudflare/wrangler-action@v3');
    expect(releaseWorkflow).toMatch(/apiToken: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
    expect(releaseWorkflow).toMatch(/accountId: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
    expect(releaseWorkflow).toContain(
      'pages deploy cloudflare-pages --project-name=higher-order-aberration-visualizer --branch=main'
    );
    expect(releaseWorkflow).toContain('group: cloudflare-pages-production');
    expect(releaseWorkflow).toContain('cancel-in-progress: true');
  });
});
