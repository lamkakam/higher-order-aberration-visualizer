import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const headers = [
  '/*',
  '  Cross-Origin-Opener-Policy: same-origin',
  '  Cross-Origin-Embedder-Policy: require-corp',
  '  Permissions-Policy: tools=(self)',
  ''
].join('\n');

export async function prepareCloudflarePages(sourceDirectory, outputDirectory) {
  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(sourceDirectory, outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, '_headers'), headers);
}

const scriptPath = process.argv[1];

if (scriptPath !== undefined && resolve(scriptPath) === fileURLToPath(import.meta.url)) {
  await prepareCloudflarePages(resolve('dist'), resolve('cloudflare-pages'));
}
