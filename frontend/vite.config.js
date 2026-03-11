import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const DEFAULT_COMMIT_HASH = 'dev';
const SHORT_SHA_LENGTH = 7;

function toShortCommit(value) {
  const commit = String(value || '').trim();
  if (!commit) {
    return '';
  }
  return commit.slice(0, SHORT_SHA_LENGTH);
}

function getCommitHashFromGit() {
  try {
    const fullSha = execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2500
    }).trim();

    return toShortCommit(fullSha);
  } catch (error) {
    return '';
  }
}

function getCommitHash() {
  const candidates = [
    process.env.VITE_COMMIT_HASH,
    process.env.VITE_GIT_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA
  ];

  for (const value of candidates) {
    const shortCommit = toShortCommit(value);
    if (shortCommit) {
      return shortCommit;
    }
  }

  return getCommitHashFromGit() || DEFAULT_COMMIT_HASH;
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_COMMIT_HASH': JSON.stringify(getCommitHash())
  }
});
