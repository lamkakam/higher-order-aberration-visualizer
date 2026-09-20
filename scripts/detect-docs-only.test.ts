// @vitest-environment node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('./detect-docs-only.mjs', import.meta.url));
const tempDirs: string[] = [];

function makeTempDir() {
  const directory = mkdtempSync(join(tmpdir(), 'hoa-ci-docs-'));
  tempDirs.push(directory);
  return directory;
}

function git(directory: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: 'pipe' });
}

function write(directory: string, path: string, content = 'Updated content\n') {
  mkdirSync(dirname(join(directory, path)), { recursive: true });
  writeFileSync(join(directory, path), content);
}

function createRepository() {
  const directory = makeTempDir();
  git(directory, 'init', '-b', 'main');
  git(directory, 'config', 'user.name', 'CI test');
  git(directory, 'config', 'user.email', 'ci-test@example.com');
  git(directory, 'config', 'commit.gpgsign', 'false');
  git(directory, 'config', 'core.hooksPath', '/dev/null');
  write(directory, 'README.md', 'Readme\n');
  write(directory, 'docs/guide.md', 'Guide\n');
  write(directory, 'src/app.ts', 'export const value = 1;\n');
  git(directory, 'add', '.');
  git(directory, 'commit', '-m', 'Base');
  git(directory, 'checkout', '-b', 'feature');
  return directory;
}

function mergePullRequest(directory: string) {
  git(directory, 'add', '-A');
  git(directory, 'commit', '--allow-empty', '-m', 'PR changes');
  git(directory, 'checkout', 'main');
  git(directory, 'merge', '--no-ff', '--no-edit', 'feature');
}

function runDetection(directory: string, eventName = 'pull_request') {
  const outputPath = join(makeTempDir(), 'output');
  writeFileSync(outputPath, 'existing=value\n');
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: directory,
    env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_OUTPUT: outputPath },
    encoding: 'utf8'
  });
  return { ...result, output: readFileSync(outputPath, 'utf8') };
}

afterEach(() => {
  for (const directory of tempDirs) {
    rmSync(directory, { force: true, recursive: true });
  }
  tempDirs.length = 0;
});

describe('documentation-only CI detection', () => {
  const cases: [string, boolean, (directory: string) => void][] = [
    ['root Markdown', true, (directory) => write(directory, 'README.md')],
    ['nested Markdown', true, (directory) => write(directory, 'docs/guide.md')],
    ['Markdown additions', true, (directory) => write(directory, 'docs/new.md')],
    ['Markdown deletions', true, (directory) => rmSync(join(directory, 'README.md'))],
    ['Markdown renames', true, (directory) =>
      renameSync(join(directory, 'README.md'), join(directory, 'docs/renamed.md'))],
    ['spaces, tabs, and newlines in Markdown paths', true, (directory) =>
      write(directory, 'docs/white space\ttab\nnewline.md')],
    ['code changes', false, (directory) => write(directory, 'src/app.ts')],
    ['code additions', false, (directory) => write(directory, 'src/new.ts')],
    ['code deletions', false, (directory) => rmSync(join(directory, 'src/app.ts'))],
    ['code renamed to Markdown', false, (directory) =>
      renameSync(join(directory, 'src/app.ts'), join(directory, 'docs/code.md'))],
    ['Markdown renamed to code', false, (directory) =>
      renameSync(join(directory, 'README.md'), join(directory, 'src/readme.ts'))],
    ['code renames', false, (directory) =>
      renameSync(join(directory, 'src/app.ts'), join(directory, 'src/renamed.ts'))],
    ['a non-Markdown suffix after whitespace', false, (directory) =>
      write(directory, 'docs/guide.md\t ')],
    ['an uppercase extension', false, (directory) => write(directory, 'README.MD')],
    ['mixed changes', false, (directory) => {
      write(directory, 'README.md');
      write(directory, 'src/app.ts');
    }],
    ['an empty diff', false, () => {}]
  ];

  it.each(cases)('classifies %s', (_name, docsOnly, change) => {
    const directory = createRepository();
    change(directory);
    mergePullRequest(directory);

    const result = runDetection(directory);

    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe(`existing=value\ndocs_only=${docsOnly}\n`);
  });

  it('includes earlier code changes when the final PR commit only changes Markdown', () => {
    const directory = createRepository();
    write(directory, 'src/app.ts');
    git(directory, 'add', '.');
    git(directory, 'commit', '-m', 'Earlier code changes');
    write(directory, 'README.md');
    mergePullRequest(directory);
    const checkout = join(makeTempDir(), 'checkout');
    git(directory, 'clone', '--depth=2', `file://${directory}`, checkout);

    const result = runDetection(checkout);

    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('existing=value\ndocs_only=false\n');
  });

  it('excludes code changes that are already on the base branch', () => {
    const directory = createRepository();
    git(directory, 'checkout', 'main');
    write(directory, 'src/app.ts');
    git(directory, 'add', '.');
    git(directory, 'commit', '-m', 'Base branch code changes');
    git(directory, 'checkout', 'feature');
    write(directory, 'README.md');
    mergePullRequest(directory);

    const result = runDetection(directory);

    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('existing=value\ndocs_only=true\n');
  });

  it.each(['push', 'workflow_dispatch'])('runs full CI for %s without inspecting Git', (eventName) => {
    const result = runDetection(makeTempDir(), eventName);

    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('existing=value\ndocs_only=false\n');
  });

  it('fails without publishing a classification when Git fails', () => {
    const result = runDetection(makeTempDir());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Command failed: git diff');
    expect(result.output).toBe('existing=value\n');
  });

  it('fails when the checkout lacks the first parent', () => {
    const result = runDetection(createRepository());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('HEAD^1');
    expect(result.output).toBe('existing=value\n');
  });
});
