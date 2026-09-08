import { ghFetch, ghGraphQL } from "@/lib/github";
import { getOrSetTtlCacheValue } from "@/lib/ttl-cache";

const LANGUAGE_DATA_TTL_MS = 5 * 60 * 1000;

type LangEdge = { size: number; node: { name: string } | null };

type LanguageRepoNode = {
  languages?: { edges: Array<LangEdge | null> } | null;
};

function accumulateLanguages(
  nodes: Array<LanguageRepoNode | null> | null | undefined,
  langTotals: Map<string, number>
) {
  for (const repo of nodes ?? []) {
    for (const edge of repo?.languages?.edges ?? []) {
      const name = edge?.node?.name;
      if (!name || !edge) continue;
      langTotals.set(name, (langTotals.get(name) ?? 0) + edge.size);
    }
  }
}

/** One GraphQL round-trip replaces dozens of REST /languages GETs. */
async function fetchLanguageBytesGraphQL(
  username: string
): Promise<Map<string, number>> {
  const langTotals = new Map<string, number>();
  const data = await ghGraphQL<{
    viewer: { login: string } | null;
    user: { repositories: { nodes: Array<LanguageRepoNode | null> } } | null;
    viewerRepos: {
      repositories: { nodes: Array<LanguageRepoNode | null> };
    } | null;
  }>(
    `query($login: String!) {
      viewer { login }
      user(login: $login) {
        repositories(
          first: 50
          ownerAffiliations: OWNER
          isFork: false
          orderBy: { field: PUSHED_AT, direction: DESC }
        ) {
          nodes {
            languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name } }
            }
          }
        }
      }
      viewerRepos: viewer {
        repositories(
          first: 50
          affiliations: [OWNER]
          isFork: false
          orderBy: { field: PUSHED_AT, direction: DESC }
        ) {
          nodes {
            languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name } }
            }
          }
        }
      }
    }`,
    { login: username }
  );

  const viewerLogin = data.viewer?.login;
  const useViewer =
    typeof viewerLogin === "string" &&
    viewerLogin.toLowerCase() === username.toLowerCase();

  accumulateLanguages(
    useViewer
      ? data.viewerRepos?.repositories?.nodes
      : data.user?.repositories?.nodes,
    langTotals
  );
  return langTotals;
}

async function fetchLanguageBytesRest(
  username: string
): Promise<Map<string, number>> {
  const token = process.env.GITHUB_TOKEN;

  let isTokenOwner = false;
  if (token) {
    const me = await ghFetch("https://api.github.com/user").catch(() => null);
    if (me && typeof me.login === "string") {
      isTokenOwner = me.login.toLowerCase() === username.toLowerCase();
    }
  }

  const PAGE_CAP = 5;
  const repoUrl = (page: number) =>
    isTokenOwner
      ? `https://api.github.com/user/repos?visibility=all&affiliation=owner&per_page=100&page=${page}&sort=pushed`
      : `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=pushed`;

  const firstPage: { full_name: string; fork: boolean }[] = await ghFetch(
    repoUrl(1)
  );
  const extraPages =
    firstPage.length === 100
      ? await Promise.all(
          Array.from({ length: PAGE_CAP - 1 }, (_, i) =>
            ghFetch(repoUrl(i + 2)).catch(
              () => [] as { full_name: string; fork: boolean }[]
            )
          )
        )
      : [];
  const allRepos = [firstPage, ...extraPages].flat();

  const ownRepos = allRepos.filter((r) => !r.fork);
  const reposToCheck = ownRepos.slice(0, 50);
  const langTotals = new Map<string, number>();

  const results = await Promise.allSettled(
    reposToCheck.map(async (repo) => {
      const data = await ghFetch(
        `https://api.github.com/repos/${repo.full_name}/languages`
      ).catch(() => ({} as Record<string, number>));
      return data as Record<string, number>;
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const [lang, bytes] of Object.entries(r.value)) {
        langTotals.set(lang, (langTotals.get(lang) ?? 0) + bytes);
      }
    }
  }

  return langTotals;
}

async function fetchLanguageBytes(
  username: string
): Promise<Map<string, number>> {
  if (process.env.GITHUB_TOKEN?.trim()) {
    try {
      return await fetchLanguageBytesGraphQL(username);
    } catch {
      // Fall through to REST.
    }
  }
  return fetchLanguageBytesRest(username);
}

export function resolveLanguageBytes(
  username: string
): Promise<Map<string, number>> {
  return getOrSetTtlCacheValue(
    "languages-data",
    username.toLowerCase(),
    LANGUAGE_DATA_TTL_MS,
    () => fetchLanguageBytes(username)
  );
}
