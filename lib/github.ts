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

interface GHRepo {
  full_name: string;
  pushed_at: string;
}

interface GHCommit {
  sha: string;
  html_url: string;
  commit: { message: string; committer: { date: string } };
}

const statsCache = new Map<string, { additions: number; deletions: number }>();

async function ghFetch(url: string) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function getAllRepos(from: string): Promise<GHRepo[]> {
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const base =
    `${GITHUB_API}/user/repos` +
    `?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100&sort=pushed`;

  const firstPage: GHRepo[] = await ghFetch(`${base}&page=1`);
  if (!firstPage.length) return [];

  const lastOnPage = new Date(firstPage[firstPage.length - 1].pushed_at).getTime();
  if (lastOnPage < fromTs) {
    return firstPage.filter((r) => new Date(r.pushed_at).getTime() >= fromTs);
  }

  const PAGE_CAP = 10;
  const extraPages = await Promise.all(
    Array.from({ length: PAGE_CAP - 1 }, (_, i) =>
      ghFetch(`${base}&page=${i + 2}`).catch(() => [] as GHRepo[])
    )
  );

  const all = [...firstPage, ...extraPages.flat()];
  return all.filter((r) => new Date(r.pushed_at).getTime() >= fromTs);
}

async function getCommitsInRepo(
  fullName: string,
  author: string,
  since: string,
  until: string
): Promise<GHCommit[]> {
  const commits: GHCommit[] = [];
  let page = 1;
  while (true) {
    const url =
      `${GITHUB_API}/repos/${fullName}/commits` +
      `?author=${author}&since=${since}&until=${until}&per_page=100&page=${page}`;
    const data: GHCommit[] = await ghFetch(url);
    if (!Array.isArray(data) || data.length === 0) break;
    commits.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return commits;
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
  items: Array<{ fullName: string; commit: GHCommit }>,
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
  const since = `${from}T00:00:00Z`;
  const until = `${to}T23:59:59Z`;

  const repos = await getAllRepos(from);

  const REPO_CONCURRENCY = 20;
  const allCommits: CommitStats[] = [];

  for (let i = 0; i < repos.length; i += REPO_CONCURRENCY) {
    const batch = repos.slice(i, i + REPO_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (repo) => {
        const commits = await getCommitsInRepo(repo.full_name, username, since, until);
        if (commits.length === 0) return [] as CommitStats[];
        return fetchStats(commits.map((c) => ({ fullName: repo.full_name, commit: c })));
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled") allCommits.push(...r.value);
    }
  }

  return allCommits;
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
