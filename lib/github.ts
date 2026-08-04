const GITHUB_API = "https://api.github.com";

function githubHeaders() {
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
  repoUrl: string | null;
  message: string;
  date: string;
  commitUrl: string | null;
  additions: number;
  deletions: number;
  isPrivate: boolean;
}

export interface RepoStats {
  repo: string;
  repoUrl: string | null;
  additions: number;
  deletions: number;
  commitCount: number;
  commits: CommitStats[];
  isPrivate: boolean;
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
  private: boolean;
}

interface GHCommit {
  sha: string;
  html_url: string;
  commit: { message: string; committer: { date: string } };
}

async function ghFetch(url: string) {
  const res = await fetch(url, { headers: githubHeaders() });
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

interface GHBranch {
  name: string;
}

interface GHPull {
  number: number;
  updated_at: string;
}

/**
 * GitHub's commits list defaults to the repository default branch only.
 * Collect branch names and recent PR head refs so feature-branch / PR work is included.
 */
async function getCommitRefs(
  fullName: string,
  from: string
): Promise<string[]> {
  const refs = new Set<string>();
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const PAGE_CAP = 5;

  for (let branchPage = 1; branchPage <= PAGE_CAP; branchPage++) {
    const url =
      `${GITHUB_API}/repos/${fullName}/branches` +
      `?per_page=100&page=${branchPage}`;
    const data: GHBranch[] = await ghFetch(url).catch(() => [] as GHBranch[]);
    if (!Array.isArray(data) || data.length === 0) break;
    for (const branch of data) {
      if (branch?.name) refs.add(branch.name);
    }
    if (data.length < 100) break;
  }

  // Include PR head refs updated in/after the range (covers deleted head branches).
  for (let pullPage = 1; pullPage <= PAGE_CAP; pullPage++) {
    const url =
      `${GITHUB_API}/repos/${fullName}/pulls` +
      `?state=all&sort=updated&direction=desc&per_page=100&page=${pullPage}`;
    const data: GHPull[] = await ghFetch(url).catch(() => [] as GHPull[]);
    if (!Array.isArray(data) || data.length === 0) break;

    let reachedOlder = false;
    for (const pull of data) {
      const updated = new Date(pull.updated_at).getTime();
      if (updated < fromTs) {
        reachedOlder = true;
        break;
      }
      refs.add(`refs/pull/${pull.number}/head`);
    }
    if (reachedOlder || data.length < 100) break;
  }

  // Always query the default tip even if branch listing failed (empty → default).
  if (refs.size === 0) refs.add("HEAD");
  return [...refs];
}

async function getCommitsForRef(
  fullName: string,
  author: string,
  since: string,
  until: string,
  sha: string
): Promise<GHCommit[]> {
  const commits: GHCommit[] = [];
  let page = 1;
  while (true) {
    const url =
      `${GITHUB_API}/repos/${fullName}/commits` +
      `?author=${encodeURIComponent(author)}` +
      `&since=${encodeURIComponent(since)}` +
      `&until=${encodeURIComponent(until)}` +
      `&sha=${encodeURIComponent(sha)}` +
      `&per_page=100&page=${page}`;
    const data: GHCommit[] = await ghFetch(url).catch(() => [] as GHCommit[]);
    if (!Array.isArray(data) || data.length === 0) break;
    commits.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return commits;
}

async function getCommitsInRepo(
  fullName: string,
  author: string,
  since: string,
  until: string,
  from: string
): Promise<GHCommit[]> {
  const refs = await getCommitRefs(fullName, from);
  const bySha = new Map<string, GHCommit>();
  const REF_CONCURRENCY = 6;

  for (let i = 0; i < refs.length; i += REF_CONCURRENCY) {
    const batch = refs.slice(i, i + REF_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((ref) => getCommitsForRef(fullName, author, since, until, ref))
    );
    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      for (const commit of result.value) {
        if (!bySha.has(commit.sha)) bySha.set(commit.sha, commit);
      }
    }
  }

  return [...bySha.values()];
}

async function getCommitDetail(
  fullName: string,
  sha: string
): Promise<{ additions: number; deletions: number }> {
  const data = await ghFetch(`${GITHUB_API}/repos/${fullName}/commits/${sha}`);
  return {
    additions: data.stats?.additions ?? 0,
    deletions: data.stats?.deletions ?? 0,
  };
}

/** Opaque stable id so private repos stay distinct without revealing names. */
function privateRepoId(fullName: string): string {
  let hash = 2166136261;
  for (let i = 0; i < fullName.length; i++) {
    hash ^= fullName.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

async function fetchStats(
  items: Array<{ fullName: string; isPrivate: boolean; commit: GHCommit }>,
  concurrency = 20
): Promise<CommitStats[]> {
  const results: CommitStats[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async ({ fullName, isPrivate, commit }) => {
        const stats = await getCommitDetail(fullName, commit.sha);
        const repoUrl = commit.html_url.replace(`/commit/${commit.sha}`, "");
        return {
          sha: isPrivate ? `private:${commit.sha.slice(0, 7)}` : commit.sha,
          repo: isPrivate ? `private:${privateRepoId(fullName)}` : fullName,
          repoUrl: isPrivate ? null : repoUrl,
          message: isPrivate ? "PRIVATE" : commit.commit.message.split("\n")[0],
          date: commit.commit.committer.date,
          commitUrl: isPrivate ? null : commit.html_url,
          ...stats,
          isPrivate,
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
        const commits = await getCommitsInRepo(
          repo.full_name,
          username,
          since,
          until,
          from
        );
        if (commits.length === 0) return [] as CommitStats[];
        return fetchStats(
          commits.map((c) => ({
            fullName: repo.full_name,
            isPrivate: repo.private,
            commit: c,
          }))
        );
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
        isPrivate: c.isPrivate,
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
