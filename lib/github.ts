const GITHUB_API = "https://api.github.com";

function headers() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface CommitStats {
  sha: string;
  repo: string;
  repoUrl: string;
  message: string;
  date: string;
  commitUrl: string;
  additions: number;
  deletions: number;
}

export interface RepoStats {
  repo: string;
  repoUrl: string;
  additions: number;
  deletions: number;
  commitCount: number;
  commits: CommitStats[];
}

export interface DayStats {
  username: string;
  from: string;
  to: string;
  totalAdditions: number;
  totalDeletions: number;
  totalCommits: number;
  repos: RepoStats[];
}

interface SearchCommitItem {
  sha: string;
  html_url: string;
  repository: { full_name: string };
  commit: { message: string; committer: { date: string } };
}

const statsCache = new Map<string, { additions: number; deletions: number }>();

async function ghFetch(url: string, extraHeaders?: Record<string, string>) {
  const res = await fetch(url, { headers: { ...headers(), ...extraHeaders } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function getCommitDetail(
  fullName: string,
  sha: string
): Promise<{ additions: number; deletions: number }> {
  const key = `${fullName}/${sha}`;
  if (statsCache.has(key)) return statsCache.get(key)!;
  const data = await ghFetch(`${GITHUB_API}/repos/${fullName}/commits/${sha}`);
  const result = { additions: data.stats?.additions ?? 0, deletions: data.stats?.deletions ?? 0 };
  statsCache.set(key, result);
  return result;
}

async function fetchStats(
  items: Array<{ fullName: string; commit: SearchCommitItem }>,
  concurrency = 20
): Promise<CommitStats[]> {
  const results: CommitStats[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async ({ fullName, commit }) => {
        const stats = await getCommitDetail(fullName, commit.sha);
        return {
          sha: commit.sha,
          repo: fullName,
          repoUrl: commit.html_url.replace(`/commit/${commit.sha}`, ""),
          message: commit.commit.message.split("\n")[0],
          date: commit.commit.committer.date,
          commitUrl: commit.html_url,
          ...stats,
        } satisfies CommitStats;
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }
  return results;
}

export async function fetchRawCommits(
  username: string,
  from: string,
  to: string
): Promise<CommitStats[]> {
  const dateRange = from === to ? from : `${from}..${to}`;
  const q = `author:${encodeURIComponent(username)}+author-date:${dateRange}`;
  const searchHeaders = { Accept: "application/vnd.github.cloak-preview+json" };

  const allItems: SearchCommitItem[] = [];
  let page = 1;

  while (allItems.length < 1000) {
    const data = await ghFetch(
      `${GITHUB_API}/search/commits?q=${q}&per_page=100&page=${page}&sort=author-date&order=desc`,
      searchHeaders
    );
    if (!Array.isArray(data.items) || data.items.length === 0) break;
    allItems.push(...data.items);
    if (data.items.length < 100) break;
    page++;
  }

  return fetchStats(
    allItems.map((item) => ({
      fullName: item.repository.full_name,
      commit: item,
    }))
  );
}

export function aggregateCommits(
  username: string,
  from: string,
  to: string,
  commits: CommitStats[]
): DayStats {
  const repoMap = new Map<string, RepoStats>();
  for (const c of commits) {
    if (!repoMap.has(c.repo)) {
      repoMap.set(c.repo, {
        repo: c.repo,
        repoUrl: c.repoUrl,
        additions: 0,
        deletions: 0,
        commitCount: 0,
        commits: [],
      });
    }
    const r = repoMap.get(c.repo)!;
    r.additions += c.additions;
    r.deletions += c.deletions;
    r.commitCount++;
    r.commits.push(c);
  }

  const repos_out = [...repoMap.values()].sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions)
  );

  return {
    username,
    from,
    to,
    totalAdditions: commits.reduce((s, c) => s + c.additions, 0),
    totalDeletions: commits.reduce((s, c) => s + c.deletions, 0),
    totalCommits: commits.length,
    repos: repos_out,
  };
}

export async function getDayStats(
  username: string,
  from: string,
  to: string
): Promise<DayStats> {
  const commits = await fetchRawCommits(username, from, to);
  return aggregateCommits(username, from, to, commits);
}
