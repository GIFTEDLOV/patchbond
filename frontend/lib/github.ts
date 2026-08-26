import { validateCommitSha } from "./validation";

const OWNER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const REPO_PATTERN = /^[a-z0-9._-]+$/;

export function githubCommitUrl(owner: string, repo: string, sha: string): string | null {
  if (!OWNER_PATTERN.test(owner) || owner.includes("--") || owner.length > 39) return null;
  if (!REPO_PATTERN.test(repo) || repo.length > 100 || repo === "." || repo === ".." || repo.endsWith(".git")) return null;
  if (!validateCommitSha(sha)) return null;
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${sha}`;
}
