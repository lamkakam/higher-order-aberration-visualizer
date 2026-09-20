import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

let docsOnly = false;

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  // Compare the PR merge result with its base, including both paths of renames.
  const changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', 'HEAD^1', 'HEAD'],
    { encoding: 'utf8' }
  ).split('\0').filter(Boolean);

  docsOnly = changedFiles.length > 0 && changedFiles.every((path) => path.endsWith('.md'));
}

appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${docsOnly}\n`);
