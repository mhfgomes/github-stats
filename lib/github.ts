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
  author: { login: string } | null;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { date: string };
  };
}

interface UserIdentity {
  login: string;
  id: number;
  emails: Set<string>;
}

async function ghFetch(url: string) {
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

/** Resolve emails/logins used to attribute primary + Co-authored-by commits. */
async function resolveUserIdentity(username: string): Promise<UserIdentity> {
  const login = username.toLowerCase();
  const user = await ghFetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`);
  const emails = new Set<string>();

  if (typeof user.email === "string" && user.email) {
    emails.add(user.email.toLowerCase());
  }
  emails.add(`${login}@users.noreply.github.com`);
  emails.add(`${user.id}+${login}@users.noreply.github.com`);

  // When the token belongs to the searched user, include private emails too.
  try {
    const me = await ghFetch(`${GITHUB_API}/user`);
    if (typeof me.login === "string" && me.login.toLowerCase() === login) {
      const myEmails = await ghFetch(`${GITHUB_API}/user/emails`);
      if (Array.isArray(myEmails)) {
        for (const entry of myEmails) {
          if (typeof entry?.email === "string" && entry.email) {
            emails.add(entry.email.toLowerCase());
          }
        }
      }
    }
  } catch {
    // Unauthenticated or missing user:email scope — noreply forms still work.
  }

  return { login, id: user.id as number, emails };
}

function coAuthorEmails(message: string): string[] {
  const emails: string[] = [];
  const re = /^[ \t]*Co-authored-by:\s*.+?\s*<([^>]+)>\s*$/gim;
  let match: RegExpExecArray | null;
  while ((match = re.exec(message)) !== null) {
    emails.push(match[1].trim().toLowerCase());
  }
  return emails;
}

function commitAttributedToUser(commit: GHCommit, identity: UserIdentity): boolean {
  if (commit.author?.login?.toLowerCase() === identity.login) return true;

  const authorEmail = commit.commit.author?.email?.toLowerCase() ?? "";
  if (authorEmail && identity.emails.has(authorEmail)) return true;

  for (const email of coAuthorEmails(commit.commit.message)) {
    if (identity.emails.has(email)) return true;
  }

  return false;
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

interface GHPull {
  number: number;
  updated_at: string;
}

/**
 * GitHub's commits list defaults to the repository default branch only.
 * Query HEAD plus PR head refs updated in range so feature-branch / PR work is
 * included — without enumerating every branch (pathological on huge repos).
 */
async function getCommitRefs(fullName: string, from: string): Promise<string[]> {
  const refs = new Set<string>(["HEAD"]);
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const PAGE_CAP = 5;

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

  return [...refs];
}

interface SearchCommitItem {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: GHCommit["commit"];
  repository?: { full_name?: string; private?: boolean };
}

/**
 * Commit search finds primary-author commits on any branch in one query,
 * avoiding per-branch listing on large repos (e.g. UnrealEngine).
 */
async function searchCommitsByAuthor(
  login: string,
  from: string,
  to: string
): Promise<Map<string, { commit: GHCommit; fullName: string; isPrivate: boolean }>> {
  const bySha = new Map<
    string,
    { commit: GHCommit; fullName: string; isPrivate: boolean }
  >();
  const query = `author:${login} author-date:${from}..${to}`;
  const PAGE_CAP = 10;

  for (let page = 1; page <= PAGE_CAP; page++) {
    const url =
      `${GITHUB_API}/search/commits` +
      `?q=${encodeURIComponent(query)}` +
      `&per_page=100&page=${page}`;
    const data = await ghFetch(url).catch(() => null);
    const items: SearchCommitItem[] = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) break;

    for (const item of items) {
      const fullName = item.repository?.full_name;
      if (!fullName || !item.sha) continue;
      if (bySha.has(item.sha)) continue;
      bySha.set(item.sha, {
        fullName,
        isPrivate: Boolean(item.repository?.private),
        commit: {
          sha: item.sha,
          html_url: item.html_url,
          author: item.author,
          commit: item.commit,
        },
      });
    }

    if (items.length < 100) break;
    // Search API hard-caps around 1000 results.
    if (bySha.size >= 1000) break;
  }

  return bySha;
}

async function getCommitsForRef(
  fullName: string,
  since: string,
  until: string,
  sha: string,
  pageCap = 10
): Promise<GHCommit[]> {
  const commits: GHCommit[] = [];
  let page = 1;
  while (page <= pageCap) {
    const url =
      `${GITHUB_API}/repos/${fullName}/commits` +
      `?since=${encodeURIComponent(since)}` +
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

/**
 * Collect commits attributed to the user in one repo on HEAD + recent PR heads.
 * Primary authorship on other branches comes from searchCommitsByAuthor (avoids
 * enumerating every branch on huge repos like UnrealEngine).
 */
async function getCommitsInRepo(
  fullName: string,
  identity: UserIdentity,
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
      batch.map((ref) => getCommitsForRef(fullName, since, until, ref, 5))
    );
    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      for (const commit of result.value) {
        if (!commitAttributedToUser(commit, identity)) continue;
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

  const [identity, repos, searched] = await Promise.all([
    resolveUserIdentity(username),
    getAllRepos(from),
    searchCommitsByAuthor(username.toLowerCase(), from, to),
  ]);

  const repoByName = new Map(repos.map((r) => [r.full_name, r]));
  const pending = new Map<
    string,
    { fullName: string; isPrivate: boolean; commit: GHCommit }
  >();

  for (const [sha, entry] of searched) {
    const known = repoByName.get(entry.fullName);
    pending.set(sha, {
      fullName: entry.fullName,
      isPrivate: known?.private ?? entry.isPrivate,
      commit: entry.commit,
    });
  }

  const REPO_CONCURRENCY = 20;

  for (let i = 0; i < repos.length; i += REPO_CONCURRENCY) {
    const batch = repos.slice(i, i + REPO_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (repo) => {
        const commits = await getCommitsInRepo(
          repo.full_name,
          identity,
          since,
          until,
          from
        );
        return commits.map((commit) => ({
          fullName: repo.full_name,
          isPrivate: repo.private,
          commit,
        }));
      })
    );

    for (const r of settled) {
      if (r.status !== "fulfilled") continue;
      for (const item of r.value) {
        if (!pending.has(item.commit.sha)) {
          pending.set(item.commit.sha, item);
        }
      }
    }
  }

  return fetchStats([...pending.values()]);
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
