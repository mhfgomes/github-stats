const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = `${GITHUB_API}/graphql`;

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function hasGithubToken() {
  return Boolean(process.env.GITHUB_TOKEN?.trim());
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
  additions?: number;
  deletions?: number;
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
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(GITHUB_GRAPHQL, {
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

  if (hasGithubToken()) {
    try {
      const data = await ghGraphQL<{
        user: { login: string; databaseId: number; email: string | null } | null;
        viewer: { login: string } | null;
      }>(
        `query($login: String!) {
          user(login: $login) { login databaseId email }
          viewer { login }
        }`,
        { login: username }
      );

      if (!data.user) throw new Error(`User not found: ${username}`);

      const emails = new Set<string>();
      if (data.user.email) emails.add(data.user.email.toLowerCase());
      emails.add(`${login}@users.noreply.github.com`);
      emails.add(`${data.user.databaseId}+${login}@users.noreply.github.com`);

      if (data.viewer?.login?.toLowerCase() === login) {
        // Private emails are REST-only; fetch in parallel with nothing else needed.
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

      return { login, id: data.user.databaseId, emails };
    } catch {
      // Fall through to REST.
    }
  }

  const user = await ghFetch(
    `${GITHUB_API}/users/${encodeURIComponent(username)}`
  );
  const emails = new Set<string>();

  if (typeof user.email === "string" && user.email) {
    emails.add(user.email.toLowerCase());
  }
  emails.add(`${login}@users.noreply.github.com`);
  emails.add(`${user.id}+${login}@users.noreply.github.com`);

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

function commitAttributedToUser(
  commit: GHCommit,
  identity: UserIdentity
): boolean {
  if (commit.author?.login?.toLowerCase() === identity.login) return true;

  const authorEmail = commit.commit.author?.email?.toLowerCase() ?? "";
  if (authorEmail && identity.emails.has(authorEmail)) return true;

  for (const email of coAuthorEmails(commit.commit.message)) {
    if (identity.emails.has(email)) return true;
  }

  return false;
}

async function getAllReposGraphQL(from: string): Promise<GHRepo[]> {
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  type RepoPage = {
    viewer: {
      repositories: {
        nodes: Array<{
          nameWithOwner: string;
          pushedAt: string;
          isPrivate: boolean;
        } | null>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  };

  const query = `query($cursor: String) {
    viewer {
      repositories(
        first: 100
        after: $cursor
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes { nameWithOwner pushedAt isPrivate }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

  const first = await ghGraphQL<RepoPage>(query, { cursor: null });
  const firstNodes = first.viewer.repositories.nodes.filter(Boolean) as Array<{
    nameWithOwner: string;
    pushedAt: string;
    isPrivate: boolean;
  }>;
  if (!firstNodes.length) return [];

  const mapNode = (n: {
    nameWithOwner: string;
    pushedAt: string;
    isPrivate: boolean;
  }): GHRepo => ({
    full_name: n.nameWithOwner,
    pushed_at: n.pushedAt,
    private: n.isPrivate,
  });

  const lastOnPage = new Date(firstNodes[firstNodes.length - 1].pushedAt).getTime();
  if (lastOnPage < fromTs || !first.viewer.repositories.pageInfo.hasNextPage) {
    return firstNodes
      .map(mapNode)
      .filter((r) => new Date(r.pushed_at).getTime() >= fromTs);
  }

  // Prefetch remaining pages simultaneously (cursor chain unknown → walk a few steps).
  // After page 1 we only have endCursor for page 2; fetch sequential cursors in waves.
  const all = [...firstNodes.map(mapNode)];
  let cursor = first.viewer.repositories.pageInfo.endCursor;
  const PAGE_CAP = 10;

  for (let page = 2; page <= PAGE_CAP && cursor; page++) {
    const data = await ghGraphQL<RepoPage>(query, { cursor });
    const nodes = data.viewer.repositories.nodes.filter(Boolean) as Array<{
      nameWithOwner: string;
      pushedAt: string;
      isPrivate: boolean;
    }>;
    if (!nodes.length) break;
    all.push(...nodes.map(mapNode));
    const last = new Date(nodes[nodes.length - 1].pushedAt).getTime();
    if (last < fromTs || !data.viewer.repositories.pageInfo.hasNextPage) break;
    cursor = data.viewer.repositories.pageInfo.endCursor;
  }

  return all.filter((r) => new Date(r.pushed_at).getTime() >= fromTs);
}

async function getAllReposRest(from: string): Promise<GHRepo[]> {
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

async function getAllRepos(from: string): Promise<GHRepo[]> {
  if (hasGithubToken()) {
    try {
      return await getAllReposGraphQL(from);
    } catch {
      // Fall through to REST.
    }
  }
  return getAllReposRest(from);
}

interface CommitRefs {
  refs: string[];
  /** False when the repo has 100+ branches — we skip full branch enumeration. */
  exhaustiveBranches: boolean;
}

async function getCommitRefsGraphQL(
  fullName: string,
  from: string
): Promise<CommitRefs> {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) return { refs: ["HEAD"], exhaustiveBranches: true };

  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const data = await ghGraphQL<{
    repository: {
      refs: {
        nodes: Array<{ name: string } | null>;
        pageInfo: { hasNextPage: boolean };
      };
      pullRequests: {
        nodes: Array<{ number: number; updatedAt: string } | null>;
      };
    } | null;
  }>(
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        refs(refPrefix: "refs/heads/", first: 100) {
          nodes { name }
          pageInfo { hasNextPage }
        }
        pullRequests(
          first: 100
          states: [OPEN, CLOSED, MERGED]
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes { number updatedAt }
        }
      }
    }`,
    { owner, name }
  );

  const refs = new Set<string>();
  const repo = data.repository;
  const exhaustiveBranches = !(repo?.refs.pageInfo.hasNextPage === true);

  if (exhaustiveBranches) {
    for (const branch of repo?.refs.nodes ?? []) {
      if (branch?.name) refs.add(branch.name);
    }
  } else {
    refs.add("HEAD");
  }

  for (const pull of repo?.pullRequests.nodes ?? []) {
    if (!pull) continue;
    if (new Date(pull.updatedAt).getTime() < fromTs) break;
    refs.add(`refs/pull/${pull.number}/head`);
  }

  if (refs.size === 0) refs.add("HEAD");
  return { refs: [...refs], exhaustiveBranches };
}

async function getCommitRefsRest(
  fullName: string,
  from: string
): Promise<CommitRefs> {
  const refs = new Set<string>();
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const PAGE_CAP = 5;

  const firstBranchUrl =
    `${GITHUB_API}/repos/${fullName}/branches` + `?per_page=100&page=1`;
  const firstBranches: Array<{ name: string }> = await ghFetch(
    firstBranchUrl
  ).catch(() => []);
  const exhaustiveBranches = !(
    Array.isArray(firstBranches) && firstBranches.length >= 100
  );

  if (exhaustiveBranches) {
    for (const branch of firstBranches) {
      if (branch?.name) refs.add(branch.name);
    }
  } else {
    refs.add("HEAD");
  }

  for (let pullPage = 1; pullPage <= PAGE_CAP; pullPage++) {
    const url =
      `${GITHUB_API}/repos/${fullName}/pulls` +
      `?state=all&sort=updated&direction=desc&per_page=100&page=${pullPage}`;
    const data: Array<{ number: number; updated_at: string }> = await ghFetch(
      url
    ).catch(() => []);
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

  if (refs.size === 0) refs.add("HEAD");
  return { refs: [...refs], exhaustiveBranches };
}

async function getCommitRefs(
  fullName: string,
  from: string
): Promise<CommitRefs> {
  if (hasGithubToken()) {
    try {
      return await getCommitRefsGraphQL(fullName, from);
    } catch {
      // Fall through.
    }
  }
  return getCommitRefsRest(fullName, from);
}

interface GqlHistoryCommit {
  oid: string;
  message: string;
  committedDate: string;
  authoredDate: string;
  url: string;
  additions: number;
  deletions: number;
  author: { email: string | null; user: { login: string } | null } | null;
}

function gqlCommitToGH(c: GqlHistoryCommit): GHCommit {
  return {
    sha: c.oid,
    html_url: c.url,
    author: c.author?.user ? { login: c.author.user.login } : null,
    commit: {
      message: c.message,
      author: {
        name: "",
        email: c.author?.email ?? "",
        date: c.authoredDate,
      },
      committer: { date: c.committedDate },
    },
    additions: c.additions,
    deletions: c.deletions,
  };
}

/**
 * Fetch dated commits (+ additions/deletions) for many refs in one GraphQL
 * round-trip via aliases.
 */
async function getCommitsForRefsGraphQL(
  fullName: string,
  since: string,
  until: string,
  refs: string[]
): Promise<GHCommit[]> {
  const [owner, name] = fullName.split("/");
  if (!owner || !name || refs.length === 0) return [];

  const REF_BATCH = 8;
  const bySha = new Map<string, GHCommit>();

  const batches: string[][] = [];
  for (let i = 0; i < refs.length; i += REF_BATCH) {
    batches.push(refs.slice(i, i + REF_BATCH));
  }

  // Run all ref batches simultaneously.
  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const varDefs = ["$owner: String!", "$name: String!", "$since: GitTimestamp", "$until: GitTimestamp"];
      const variables: Record<string, unknown> = {
        owner,
        name,
        since,
        until,
      };
      const fields: string[] = [];

      batch.forEach((ref, idx) => {
        varDefs.push(`$e${idx}: String!`);
        variables[`e${idx}`] = ref === "HEAD" ? "HEAD" : ref;
        fields.push(`
          r${idx}: object(expression: $e${idx}) {
            ... on Commit {
              history(since: $since, until: $until, first: 100) {
                nodes {
                  oid
                  message
                  committedDate
                  authoredDate
                  url
                  additions
                  deletions
                  author { email user { login } }
                }
              }
            }
          }
        `);
      });

      const query = `query(${varDefs.join(", ")}) {
        repository(owner: $owner, name: $name) {
          ${fields.join("\n")}
        }
      }`;

      const data = await ghGraphQL<{
        repository: Record<
          string,
          { history?: { nodes: Array<GqlHistoryCommit | null> } } | null
        > | null;
      }>(query, variables);

      const commits: GHCommit[] = [];
      if (!data.repository) return commits;
      for (let idx = 0; idx < batch.length; idx++) {
        const nodes = data.repository[`r${idx}`]?.history?.nodes ?? [];
        for (const node of nodes) {
          if (node?.oid) commits.push(gqlCommitToGH(node));
        }
      }
      return commits;
    })
  );

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const commit of result.value) {
      if (!bySha.has(commit.sha)) bySha.set(commit.sha, commit);
    }
  }

  return [...bySha.values()];
}

async function getCommitsForRefRest(
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
  const { refs } = await getCommitRefs(fullName, from);
  const bySha = new Map<string, GHCommit>();

  if (hasGithubToken()) {
    try {
      const commits = await getCommitsForRefsGraphQL(
        fullName,
        since,
        until,
        refs
      );
      for (const commit of commits) {
        if (!commitAttributedToUser(commit, identity)) continue;
        if (!bySha.has(commit.sha)) bySha.set(commit.sha, commit);
      }
      return [...bySha.values()];
    } catch {
      // Fall through to REST listing.
    }
  }

  const REF_CONCURRENCY = 8;
  for (let i = 0; i < refs.length; i += REF_CONCURRENCY) {
    const batch = refs.slice(i, i + REF_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((ref) => getCommitsForRefRest(fullName, since, until, ref))
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

interface SearchCommitItem {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: GHCommit["commit"];
  repository?: { full_name?: string; private?: boolean };
}

/**
 * Finds primary-author commits on any branch (needed when we skip full branch
 * walks on huge repos). Additive — never removes already-discovered commits.
 * Uses REST commit search (GraphQL SearchType has no COMMIT).
 */
async function searchCommitsByAuthor(
  login: string,
  from: string,
  to: string
): Promise<
  Map<string, { commit: GHCommit; fullName: string; isPrivate: boolean }>
> {
  const bySha = new Map<
    string,
    { commit: GHCommit; fullName: string; isPrivate: boolean }
  >();

  const query = `author:${login} author-date:${from}..${to}`;
  const PAGE_CAP = 10;

  const ingest = (items: SearchCommitItem[]) => {
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
  };

  // Prefetch search pages simultaneously after learning page 1 has more.
  const firstUrl =
    `${GITHUB_API}/search/commits` +
    `?q=${encodeURIComponent(query)}` +
    `&per_page=100&page=1`;
  const firstData = await ghFetch(firstUrl).catch(() => null);
  const firstItems: SearchCommitItem[] = Array.isArray(firstData?.items)
    ? firstData.items
    : [];

  ingest(firstItems);

  if (firstItems.length >= 100) {
    const extra = await Promise.all(
      Array.from({ length: PAGE_CAP - 1 }, (_, i) =>
        ghFetch(
          `${GITHUB_API}/search/commits` +
            `?q=${encodeURIComponent(query)}` +
            `&per_page=100&page=${i + 2}`
        ).catch(() => null)
      )
    );
    for (const data of extra) {
      const items: SearchCommitItem[] = Array.isArray(data?.items)
        ? data.items
        : [];
      ingest(items);
      if (bySha.size >= 1000) break;
    }
  }

  return bySha;
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
 * Batch additions/deletions via simultaneous GraphQL alias queries.
 * Any commit missing from the GraphQL payload falls back to REST.
 */
async function fetchCommitStatsBatch(
  items: Array<{ fullName: string; sha: string }>
): Promise<Map<string, { additions: number; deletions: number }>> {
  const results = new Map<string, { additions: number; deletions: number }>();
  if (items.length === 0) return results;

  if (!hasGithubToken()) {
    const settled = await Promise.allSettled(
      items.map(async (item) => {
        const stats = await getCommitDetail(item.fullName, item.sha);
        return { key: `${item.fullName}@${item.sha}`, stats };
      })
    );
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.set(result.value.key, result.value.stats);
      }
    }
    return results;
  }

  const BATCH_SIZE = 40;
  const batches: Array<Array<{ fullName: string; sha: string }>> = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const missing: Array<{ fullName: string; sha: string }> = [];

  // All GraphQL batches fire simultaneously.
  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const varDefs: string[] = [];
      const fields: string[] = [];
      const variables: Record<string, unknown> = {};
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

      if (fields.length === 0) return [] as Array<{ key: string; additions: number; deletions: number }>;

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
            key: `${item.fullName}@${item.sha}`,
            additions: obj.additions,
            deletions: obj.deletions,
          });
        } else {
          missing.push(item);
        }
      }
      return found;
    })
  );

  for (const result of settled) {
    if (result.status === "fulfilled") {
      for (const row of result.value) {
        results.set(row.key, {
          additions: row.additions,
          deletions: row.deletions,
        });
      }
    } else {
      // Whole batch failed — REST fallback handled via missing list below.
    }
  }

  // Re-queue batches that fully failed.
  for (let i = 0; i < batches.length; i++) {
    if (settled[i]?.status === "rejected") {
      missing.push(...batches[i]);
    }
  }

  if (missing.length > 0) {
    const restSettled = await Promise.allSettled(
      missing.map(async (item) => {
        const stats = await getCommitDetail(item.fullName, item.sha);
        return { key: `${item.fullName}@${item.sha}`, stats };
      })
    );
    for (const result of restSettled) {
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
  const withInline: CommitStats[] = [];
  const needBatch: Array<{
    fullName: string;
    isPrivate: boolean;
    commit: GHCommit;
  }> = [];

  for (const item of items) {
    const inlineAdd = item.commit.additions;
    const inlineDel = item.commit.deletions;
    if (typeof inlineAdd === "number" && typeof inlineDel === "number") {
      const { fullName, isPrivate, commit } = item;
      const repoUrl = commit.html_url.replace(`/commit/${commit.sha}`, "");
      withInline.push({
        sha: isPrivate ? `private:${commit.sha.slice(0, 7)}` : commit.sha,
        repo: isPrivate ? `private:${privateRepoId(fullName)}` : fullName,
        repoUrl: isPrivate ? null : repoUrl,
        message: isPrivate ? "PRIVATE" : commit.commit.message.split("\n")[0],
        date: commit.commit.committer.date,
        commitUrl: isPrivate ? null : commit.html_url,
        additions: inlineAdd,
        deletions: inlineDel,
        isPrivate,
      });
    } else {
      needBatch.push(item);
    }
  }

  if (needBatch.length === 0) return withInline;

  const statsMap = await fetchCommitStatsBatch(
    needBatch.map((item) => ({
      fullName: item.fullName,
      sha: item.commit.sha,
    }))
  );

  const results = [...withInline];
  for (const { fullName, isPrivate, commit } of needBatch) {
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

  // Identity, repos, and author-search all run simultaneously.
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
