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

/** GitHub secondary rate limits kick in around 100 concurrent REST requests. */
const MAX_IN_FLIGHT = 100;
let inFlight = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      inFlight += 1;
      resolve();
    });
  });
}

function releaseSlot() {
  inFlight -= 1;
  waitQueue.shift()?.();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasGithubToken() {
  return Boolean(process.env.GITHUB_TOKEN?.trim());
}

function isRetryableStatus(status: number, body: string) {
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  return status === 403 && /rate limit/i.test(body);
}

async function waitForRetry(res: Response, attempt: number) {
  const retryAfter = Number(res.headers.get("retry-after"));
  const waitMs =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 400 * 2 ** attempt;
  await sleep(waitMs);
}

export async function ghFetch(url: string) {
  await acquireSlot();
  try {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: githubHeaders() });
      if (res.ok) return res.json();

      const body = await res.text();
      lastError = new Error(`GitHub API error ${res.status}: ${body}`);
      if (!isRetryableStatus(res.status, body) || attempt === 3) break;
      await waitForRetry(res, attempt);
    }
    throw lastError ?? new Error("GitHub API error");
  } finally {
    releaseSlot();
  }
}

type GraphQLError = { type?: string; message?: string };
type GraphQLBody<T> = { data?: T | null; errors?: GraphQLError[] };

function isRetryableGraphQL(status: number, json: GraphQLBody<unknown> | null) {
  const body = JSON.stringify(json ?? {});
  if (isRetryableStatus(status, body)) return true;
  return (json?.errors ?? []).some(
    (error) => error.type === "RATE_LIMITED" || /rate limit/i.test(error.message ?? "")
  );
}

/** Authenticated GraphQL POST with the same concurrency cap and retries as REST. */
export async function ghGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  await acquireSlot();
  try {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${GITHUB_API}/graphql`, {
        method: "POST",
        headers: {
          ...githubHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      const json = (await res.json().catch(() => null)) as GraphQLBody<T> | null;
      const retryable = isRetryableGraphQL(res.status, json);

      if (res.ok && json?.data != null && !retryable) {
        return json.data;
      }

      lastError = new Error(
        `GitHub GraphQL error ${res.status}: ${JSON.stringify(json ?? {})}`
      );
      if (!retryable || attempt === 3) break;
      await waitForRetry(res, attempt);
    }
    throw lastError ?? new Error("GitHub GraphQL error");
  } finally {
    releaseSlot();
  }
}

function fulfilledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  const values: T[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") values.push(result.value);
  }
  return values;
}

/**
 * Fetch paginated GitHub lists concurrently: first page, then every remaining
 * page up to `pageCap` at the same time when more results exist.
 */
async function ghFetchPages<T>(
  urlForPage: (page: number) => string,
  pageCap: number,
  options?: {
    optional?: boolean;
    stopAfterFirst?: (firstPage: T[]) => boolean;
  }
): Promise<T[]> {
  const firstPromise = ghFetch(urlForPage(1));
  const first = (
    options?.optional ? await firstPromise.catch(() => []) : await firstPromise
  ) as T[];

  if (!Array.isArray(first) || first.length === 0) return [];
  if (first.length < 100 || pageCap <= 1 || options?.stopAfterFirst?.(first)) {
    return first;
  }

  const rest = await Promise.all(
    Array.from({ length: pageCap - 1 }, (_, i) =>
      ghFetch(urlForPage(i + 2)).catch(() => [] as T[])
    )
  );
  return [first, ...rest].flat();
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

  // When the token belongs to the searched user, include private emails too.
  if (me && typeof me.login === "string" && me.login.toLowerCase() === login) {
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

  const all = await ghFetchPages<GHRepo>(
    (page) => `${base}&page=${page}`,
    10,
    {
      stopAfterFirst: (page) =>
        new Date(page[page.length - 1].pushed_at).getTime() < fromTs,
    }
  );
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

  const [branches, pulls] = await Promise.all([
    ghFetchPages<GHBranch>(
      (page) =>
        `${GITHUB_API}/repos/${fullName}/branches?per_page=100&page=${page}`,
      PAGE_CAP,
      { optional: true }
    ),
    ghFetchPages<GHPull>(
      (page) =>
        `${GITHUB_API}/repos/${fullName}/pulls` +
        `?state=all&sort=updated&direction=desc&per_page=100&page=${page}`,
      PAGE_CAP,
      {
        optional: true,
        stopAfterFirst: (page) =>
          new Date(page[page.length - 1].updated_at).getTime() < fromTs,
      }
    ),
  ]);

  for (const branch of branches) {
    if (branch?.name) refs.add(branch.name);
  }
  for (const pull of pulls) {
    if (new Date(pull.updated_at).getTime() >= fromTs) {
      refs.add(`refs/pull/${pull.number}/head`);
    }
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
  return ghFetchPages<GHCommit>(
    (page) =>
      `${GITHUB_API}/repos/${fullName}/commits` +
      `?since=${encodeURIComponent(since)}` +
      `&until=${encodeURIComponent(until)}` +
      `&sha=${encodeURIComponent(sha)}` +
      `&per_page=100&page=${page}`,
    10,
    { optional: true }
  );
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
  const settled = await Promise.allSettled(
    refs.map((ref) => getCommitsForRef(fullName, since, until, ref))
  );

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const commit of result.value) {
      if (!commitAttributedToUser(commit, identity)) continue;
      if (!bySha.has(commit.sha)) bySha.set(commit.sha, commit);
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

function commitStatsKey(fullName: string, sha: string) {
  return `${fullName}@${sha}`;
}

async function fetchCommitDetailsRest(
  items: Array<{ fullName: string; sha: string }>
): Promise<Map<string, { additions: number; deletions: number }>> {
  const results = new Map<string, { additions: number; deletions: number }>();
  const settled = await Promise.allSettled(
    items.map(async (item) => {
      const stats = await getCommitDetail(item.fullName, item.sha);
      return { key: commitStatsKey(item.fullName, item.sha), stats };
    })
  );
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.set(result.value.key, result.value.stats);
    }
  }
  return results;
}

/**
 * Batch additions/deletions via GraphQL aliases (one round-trip per ~40 commits)
 * instead of a REST GET per commit. Misses fall back to REST so totals stay the same.
 */
async function fetchCommitStatsBatch(
  items: Array<{ fullName: string; sha: string }>
): Promise<Map<string, { additions: number; deletions: number }>> {
  if (items.length === 0) {
    return new Map();
  }
  if (!hasGithubToken()) {
    return fetchCommitDetailsRest(items);
  }

  const BATCH_SIZE = 40;
  const batches: Array<Array<{ fullName: string; sha: string }>> = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const results = new Map<string, { additions: number; deletions: number }>();
  const missing: Array<{ fullName: string; sha: string }> = [];

  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const varDefs: string[] = [];
      const fields: string[] = [];
      const variables: Record<string, string> = {};
      const indexed: Array<{ fullName: string; sha: string; idx: number }> = [];
      const batchMissing: Array<{ fullName: string; sha: string }> = [];

      batch.forEach((item, idx) => {
        const [owner, name] = item.fullName.split("/");
        if (!owner || !name) {
          batchMissing.push(item);
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

      if (fields.length === 0) {
        return {
          found: [] as Array<{
            key: string;
            additions: number;
            deletions: number;
          }>,
          batchMissing,
        };
      }

      const query = `query(${varDefs.join(", ")}) { ${fields.join("\n")} }`;
      const data = await ghGraphQL<
        Record<
          string,
          { object?: { additions?: number; deletions?: number } | null } | null
        >
      >(query, variables);

      const found: Array<{ key: string; additions: number; deletions: number }> =
        [];
      for (const item of indexed) {
        const obj = data[`c${item.idx}`]?.object;
        if (
          obj &&
          typeof obj.additions === "number" &&
          typeof obj.deletions === "number"
        ) {
          found.push({
            key: commitStatsKey(item.fullName, item.sha),
            additions: obj.additions,
            deletions: obj.deletions,
          });
        } else {
          batchMissing.push(item);
        }
      }
      return { found, batchMissing };
    })
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      for (const row of result.value.found) {
        results.set(row.key, {
          additions: row.additions,
          deletions: row.deletions,
        });
      }
      missing.push(...result.value.batchMissing);
    } else {
      missing.push(...batches[i]);
    }
  }

  if (missing.length > 0) {
    const rest = await fetchCommitDetailsRest(missing);
    for (const [key, stats] of rest) {
      results.set(key, stats);
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

  const out: CommitStats[] = [];
  for (const { fullName, isPrivate, commit } of items) {
    const stats = statsMap.get(commitStatsKey(fullName, commit.sha));
    if (!stats) continue;
    const repoUrl = commit.html_url.replace(`/commit/${commit.sha}`, "");
    out.push({
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
  return out;
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

  const settled = await Promise.allSettled(
    repos.map(async (repo) => {
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

  return fetchStats(fulfilledValues(settled).flat());
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
