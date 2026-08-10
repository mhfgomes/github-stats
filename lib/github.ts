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
  isSelf: boolean;
}

async function ghFetch(url: string) {
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function ghGraphQL<T>(
  query: string,
  variables: Record<string, string>
): Promise<T> {
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GraphQL error ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    throw new Error(`GitHub GraphQL error: ${json.errors[0]?.message ?? "unknown"}`);
  }
  return json.data as T;
}

/** Resolve emails/logins used to attribute primary + Co-authored-by commits. */
async function resolveUserIdentity(username: string): Promise<UserIdentity> {
  const login = username.toLowerCase();
  const [user, me] = await Promise.all([
    ghFetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`),
    ghFetch(`${GITHUB_API}/user`).catch(() => null),
  ]);

  const emails = new Set<string>();
  if (typeof user.email === "string" && user.email) {
    emails.add(user.email.toLowerCase());
  }
  emails.add(`${login}@users.noreply.github.com`);
  emails.add(`${user.id}+${login}@users.noreply.github.com`);

  const isSelf =
    typeof me?.login === "string" && me.login.toLowerCase() === login;

  // When the token belongs to the searched user, include private emails too.
  if (isSelf) {
    try {
      const myEmails = await ghFetch(`${GITHUB_API}/user/emails`);
      if (Array.isArray(myEmails)) {
        for (const entry of myEmails) {
          if (typeof entry?.email === "string" && entry.email) {
            emails.add(entry.email.toLowerCase());
          }
        }
      }
    } catch {
      // Missing user:email scope — noreply forms still work.
    }
  }

  return { login, id: user.id as number, emails, isSelf };
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

  const repos: GHRepo[] = [];
  const PAGE_CAP = 10;

  for (let page = 1; page <= PAGE_CAP; page++) {
    const data: GHRepo[] = await ghFetch(`${base}&page=${page}`).catch(
      () => [] as GHRepo[]
    );
    if (!Array.isArray(data) || data.length === 0) break;

    for (const repo of data) {
      if (new Date(repo.pushed_at).getTime() >= fromTs) repos.push(repo);
    }

    const lastOnPage = new Date(data[data.length - 1].pushed_at).getTime();
    if (lastOnPage < fromTs || data.length < 100) break;
  }

  return repos;
}

interface GHEvent {
  type: string;
  created_at: string;
  repo?: { name?: string };
}

/**
 * Recent events tell us which repos the user actually touched, so we can skip
 * scanning huge collaborator repos that were only pushed by someone else.
 */
async function getActiveRepoNames(
  username: string,
  from: string,
  to: string,
  isSelf: boolean
): Promise<Set<string>> {
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const toTs = new Date(`${to}T23:59:59Z`).getTime();
  const active = new Set<string>();
  const PAGE_CAP = 5;

  const endpoint = isSelf
    ? `${GITHUB_API}/user/events`
    : `${GITHUB_API}/users/${encodeURIComponent(username)}/events`;

  for (let page = 1; page <= PAGE_CAP; page++) {
    const data: GHEvent[] = await ghFetch(
      `${endpoint}?per_page=100&page=${page}`
    ).catch(() => [] as GHEvent[]);
    if (!Array.isArray(data) || data.length === 0) break;

    for (const event of data) {
      const ts = new Date(event.created_at).getTime();
      if (ts > toTs) continue;
      if (ts < fromTs) continue;

      if (
        event.type === "PushEvent" ||
        event.type === "PullRequestEvent" ||
        event.type === "CreateEvent" ||
        event.type === "CommitCommentEvent"
      ) {
        const name = event.repo?.name;
        if (name) active.add(name);
      }
    }

    const lastTs = new Date(data[data.length - 1].created_at).getTime();
    if (lastTs < fromTs || data.length < 100) break;
  }

  return active;
}

interface GHPull {
  number: number;
  updated_at: string;
  user?: { login?: string } | null;
}

/**
 * GitHub's commits list defaults to the repository default branch only.
 * Query HEAD plus PR head refs updated in range so feature-branch / PR work is
 * included — without enumerating every branch (pathological on huge repos).
 */
async function getCommitRefs(
  fullName: string,
  from: string,
  login: string
): Promise<string[]> {
  const refs = new Set<string>(["HEAD"]);
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const PAGE_CAP = 3;

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
      // Prefer PRs the user authored — cuts noise on busy org repos.
      const author = pull.user?.login?.toLowerCase();
      if (author && author !== login) continue;
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
    if (bySha.size >= 1000) break;
  }

  return bySha;
}

async function getCommitsForRef(
  fullName: string,
  since: string,
  until: string,
  sha: string,
  pageCap = 5
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
 * Primary authorship on other branches comes from searchCommitsByAuthor.
 */
async function getCommitsInRepo(
  fullName: string,
  identity: UserIdentity,
  since: string,
  until: string,
  from: string
): Promise<GHCommit[]> {
  const refs = await getCommitRefs(fullName, from, identity.login);
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

/** Batch additions/deletions via GraphQL (one request per ~40 commits). */
async function fetchCommitStatsBatch(
  items: Array<{ fullName: string; sha: string }>
): Promise<Map<string, { additions: number; deletions: number }>> {
  const results = new Map<string, { additions: number; deletions: number }>();
  if (items.length === 0) return results;

  const BATCH_SIZE = 40;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const varDefs: string[] = [];
    const fields: string[] = [];
    const variables: Record<string, string> = {};

    batch.forEach((item, idx) => {
      const [owner, name] = item.fullName.split("/");
      if (!owner || !name) return;
      varDefs.push(
        `$o${idx}: String!`,
        `$n${idx}: String!`,
        `$s${idx}: GitObjectID!`
      );
      variables[`o${idx}`] = owner;
      variables[`n${idx}`] = name;
      variables[`s${idx}`] = item.sha;
      fields.push(`
        c${idx}: repository(owner: $o${idx}, name: $n${idx}) {
          object(oid: $s${idx}) {
            ... on Commit { additions deletions }
          }
        }
      `);
    });

    if (fields.length === 0) continue;

    try {
      const query = `query(${varDefs.join(", ")}) { ${fields.join("\n")} }`;
      const data = await ghGraphQL<
        Record<string, { object?: { additions?: number; deletions?: number } | null } | null>
      >(query, variables);

      batch.forEach((item, idx) => {
        const obj = data[`c${idx}`]?.object;
        results.set(`${item.fullName}@${item.sha}`, {
          additions: obj?.additions ?? 0,
          deletions: obj?.deletions ?? 0,
        });
      });
    } catch {
      // Fallback to REST if GraphQL is unavailable / partial failure.
      const settled = await Promise.allSettled(
        batch.map(async (item) => {
          const stats = await getCommitDetail(item.fullName, item.sha);
          return { key: `${item.fullName}@${item.sha}`, stats };
        })
      );
      for (const result of settled) {
        if (result.status === "fulfilled") {
          results.set(result.value.key, result.value.stats);
        }
      }
    }
  }

  return results;
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
  items: Array<{ fullName: string; isPrivate: boolean; commit: GHCommit }>
): Promise<CommitStats[]> {
  const statsMap = await fetchCommitStatsBatch(
    items.map((item) => ({ fullName: item.fullName, sha: item.commit.sha }))
  );

  const results: CommitStats[] = [];
  for (const { fullName, isPrivate, commit } of items) {
    const stats = statsMap.get(`${fullName}@${commit.sha}`) ?? {
      additions: 0,
      deletions: 0,
    };
    const repoUrl = commit.html_url.replace(`/commit/${commit.sha}`, "");
    results.push({
      sha: isPrivate ? `private:${commit.sha.slice(0, 7)}` : commit.sha,
      repo: isPrivate ? `private:${privateRepoId(fullName)}` : fullName,
      repoUrl: isPrivate ? null : repoUrl,
      message: isPrivate ? "PRIVATE" : commit.commit.message.split("\n")[0],
      date: commit.commit.committer.date,
      commitUrl: isPrivate ? null : commit.html_url,
      ...stats,
      isPrivate,
    });
  }
  return results;
}

function shouldDeepScanRepo(
  fullName: string,
  identity: UserIdentity,
  activeRepos: Set<string>,
  searchedRepos: Set<string>
): boolean {
  const owner = fullName.split("/")[0]?.toLowerCase() ?? "";
  if (owner === identity.login) return true;
  if (activeRepos.has(fullName)) return true;
  if (searchedRepos.has(fullName)) return true;
  return false;
}

export async function fetchRawCommits(
  username: string,
  from: string,
  to: string
): Promise<CommitStats[]> {
  const since = `${from}T00:00:00Z`;
  const until = `${to}T23:59:59Z`;

  const identity = await resolveUserIdentity(username);

  const [repos, searched, activeRepos] = await Promise.all([
    getAllRepos(from),
    searchCommitsByAuthor(identity.login, from, to),
    getActiveRepoNames(username, from, to, identity.isSelf),
  ]);

  const repoByName = new Map(repos.map((r) => [r.full_name, r]));
  const pending = new Map<
    string,
    { fullName: string; isPrivate: boolean; commit: GHCommit }
  >();

  const searchedRepos = new Set<string>();
  for (const [sha, entry] of searched) {
    searchedRepos.add(entry.fullName);
    const known = repoByName.get(entry.fullName);
    pending.set(sha, {
      fullName: entry.fullName,
      isPrivate: known?.private ?? entry.isPrivate,
      commit: entry.commit,
    });
  }

  const reposToScan = repos.filter((repo) =>
    shouldDeepScanRepo(
      repo.full_name,
      identity,
      activeRepos,
      searchedRepos
    )
  );

  const REPO_CONCURRENCY = 8;

  for (let i = 0; i < reposToScan.length; i += REPO_CONCURRENCY) {
    const batch = reposToScan.slice(i, i + REPO_CONCURRENCY);
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
