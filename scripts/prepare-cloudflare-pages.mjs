import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import deploymentPaths from './deployment-paths.json' with { type: 'json' };

const { staticDeploymentBasePath } = deploymentPaths;
const staticDeploymentDirectoryName = staticDeploymentBasePath.slice(1, -1);
const headers = [
  `${staticDeploymentBasePath}*`,
  '  Cross-Origin-Opener-Policy: same-origin',
  '  Cross-Origin-Embedder-Policy: require-corp',
  '  Permissions-Policy: tools=(self)',
  ''
].join('\n');
const redirects = `/ ${staticDeploymentBasePath} 302\n`;

export async function prepareCloudflarePages(sourceDirectory, outputDirectory) {
  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(sourceDirectory, resolve(outputDirectory, staticDeploymentDirectoryName), {
    recursive: true
  });
  await Promise.all([
    writeFile(resolve(outputDirectory, '_headers'), headers),
    writeFile(resolve(outputDirectory, '_redirects'), redirects)
  ]);
}

const scriptPath = process.argv[1];

if (scriptPath !== undefined && resolve(scriptPath) === fileURLToPath(import.meta.url)) {
  await prepareCloudflarePages(resolve('dist'), resolve('cloudflare-pages'));
}
