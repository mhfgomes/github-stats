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
    throw new Error(
      `GitHub GraphQL error: ${json.errors[0]?.message ?? "unknown"}`
    );
  }
  return json.data as T;
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
  since: string,
  until: string,
  sha: string
): Promise<GHCommit[]> {
  const commits: GHCommit[] = [];
  let page = 1;
  while (true) {
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
      batch.map((ref) => getCommitsForRef(fullName, since, until, ref))
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

/**
 * Batch additions/deletions via GraphQL. Any commit missing from the GraphQL
 * payload falls back to the REST commit endpoint so totals stay identical.
 */
async function fetchCommitStatsBatch(
  items: Array<{ fullName: string; sha: string }>
): Promise<Map<string, { additions: number; deletions: number }>> {
  const results = new Map<string, { additions: number; deletions: number }>();
  if (items.length === 0) return results;

  const BATCH_SIZE = 40;
  const missing: Array<{ fullName: string; sha: string }> = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const varDefs: string[] = [];
    const fields: string[] = [];
    const variables: Record<string, string> = {};
    const indexed: Array<{ fullName: string; sha: string; idx: number }> = [];

    batch.forEach((item, idx) => {
      const [owner, name] = item.fullName.split("/");
      if (!owner || !name) {
        missing.push(item);
        return;
      }
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
      indexed.push({ ...item, idx });
    });

    if (fields.length === 0) continue;

    try {
      const query = `query(${varDefs.join(", ")}) { ${fields.join("\n")} }`;
      const data = await ghGraphQL<
        Record<
          string,
          { object?: { additions?: number; deletions?: number } | null } | null
        >
      >(query, variables);

      for (const item of indexed) {
        const obj = data[`c${item.idx}`]?.object;
        if (
          obj &&
          typeof obj.additions === "number" &&
          typeof obj.deletions === "number"
        ) {
          results.set(`${item.fullName}@${item.sha}`, {
            additions: obj.additions,
            deletions: obj.deletions,
          });
        } else {
          missing.push(item);
        }
      }
    } catch {
      missing.push(...indexed);
    }
  }

  if (missing.length > 0) {
    const settled = await Promise.allSettled(
      missing.map(async (item) => {
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
    const stats = statsMap.get(`${fullName}@${commit.sha}`);
    if (!stats) continue;
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

export async function fetchRawCommits(
  username: string,
  from: string,
  to: string
): Promise<CommitStats[]> {
  const since = `${from}T00:00:00Z`;
  const until = `${to}T23:59:59Z`;

  const [identity, repos] = await Promise.all([
    resolveUserIdentity(username),
    getAllRepos(from),
  ]);

  const REPO_CONCURRENCY = 20;
  const pending: Array<{
    fullName: string;
    isPrivate: boolean;
    commit: GHCommit;
  }> = [];

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
      if (r.status === "fulfilled") pending.push(...r.value);
    }
  }

  return fetchStats(pending);
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
