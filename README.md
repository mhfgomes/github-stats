# GitHub Daily Stats

A Next.js app for exploring a GitHub user's activity over a date range. It reports commits, additions, deletions, and repository-level details, and can generate customizable SVG cards for stats and programming languages.

## Features

- Search GitHub activity by username and date range
- View commit, addition, and deletion totals
- Explore per-repository summaries and individual commit details
- Share searches with URL query parameters
- Generate customizable stats and language SVG banners
- Copy ready-to-use banner URLs and Markdown snippets
- Choose banner dimensions, gradients, colors, and content
- Switch between light and dark themes
- Include private activity when the configured token belongs to the requested user

## Tech stack

- [Next.js](https://nextjs.org/) App Router
- [React](https://react.dev/) and TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) and Radix UI
- [GitHub REST API](https://docs.github.com/en/rest)
- [Vercel Analytics](https://vercel.com/docs/analytics)

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/mhfgomes/github-stats.git
cd github-stats
```

### 2. Install dependencies

Using [Bun](https://bun.com) 1.4 or later:

```bash
bun install
```

Or npm:

```bash
npm install
```

### 3. Configure the environment

Copy the example environment file:

```bash
cp example.env .env.local
```

Then set a GitHub personal access token in `.env.local`:

```env
GITHUB_TOKEN=your_github_token
```

`GITHUB_TOKEN` is required for activity statistics because that workflow reads repositories available to the authenticated account. The languages banner can use GitHub's public endpoints without a token, but authenticated requests have higher rate limits. When the token belongs to the searched user and has suitable permissions, the app can also inspect that user's private repositories and use their private email addresses for commit attribution. Private repository names, URLs, and commit details are not exposed in results.

Do not commit `.env.local` or publish your token.

### 4. Start the development server

```bash
bun dev
```

Or:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Path | Description |
| --- | --- |
| `/` | Search activity and inspect totals, repositories, and commits |
| `/banner` | Choose a banner type |
| `/banner/stats` | Configure and preview a stats banner |
| `/banner/langs` | Configure and preview a languages banner |

## API

All dates use the `YYYY-MM-DD` format. API errors are returned as JSON with an `error` field.

### `GET /api/stats`

Returns activity totals and a per-repository breakdown.

| Parameter | Required | Description |
| --- | --- | --- |
| `username` | Yes | GitHub username |
| `from` | No | Start date; defaults to today |
| `to` | No | End date; defaults to `from` |

```http
GET /api/stats?username=torvalds&from=2026-02-01&to=2026-02-07
```

The response includes `totalCommits`, `totalAdditions`, `totalDeletions`, and a `repos` array containing repository and commit details.

### `GET /api/banner`

Returns a customizable SVG containing activity statistics and optional top repositories.

| Parameter | Default | Description |
| --- | --- | --- |
| `username` | — | Required GitHub username |
| `range` | — | `today`, `yesterday`, `last7`, `lastweek`, `thismonth`, or `lastmonth` |
| `from`, `to` | Today | Custom dates used when `range` is omitted |
| `w` | `900` | Width, clamped to 480–1600 px |
| `h` | `240` | Height, clamped to 160–520 px |
| `bg1`, `bg2` | Ocean gradient | Gradient colors |
| `dir` | `to-br` | Gradient direction: `to-r`, `to-b`, `to-br`, or `to-tr` |
| `text` | `#ffffff` | Primary text color |
| `muted` | `#cbd5f5` | Secondary text color |
| `accent` | `#fbd38d` | Repository ranking color |
| `items` | `commits,additions,deletions` | Comma-separated list of `commits`, `additions`, `deletions`, and `net` |
| `top` | `3` | Top repositories to show, clamped to 0–6 |
| `title`, `subtitle` | Generated | Custom heading text |
| `show_title`, `show_subtitle` | `1` | Set to `0` to hide the corresponding text |

```markdown
![GitHub stats](https://your-domain.example/api/banner?username=torvalds&range=last7&items=commits,additions,deletions,net&top=3)
```

### `GET /api/languages-banner`

Returns an SVG showing the most-used languages across a user's non-fork repositories. Language percentages are based on the selected top languages rather than the user's complete language total.

| Parameter | Default | Description |
| --- | --- | --- |
| `username` | — | Required GitHub username |
| `top` | `8` | Number of languages, clamped to 1–12 |
| `w` | `900` | Width, clamped to 480–1600 px |
| `h` | `300` | Height, clamped to 160–520 px |
| `bg1`, `bg2` | Ocean gradient | Gradient colors |
| `dir` | `to-br` | Gradient direction: `to-r`, `to-b`, `to-br`, or `to-tr` |
| `text` | `#ffffff` | Primary text color |
| `muted` | `#cbd5f5` | Secondary text color |
| `title` | `Most Used Languages` | Banner title |

```markdown
![Most used languages](https://your-domain.example/api/languages-banner?username=torvalds&top=8)
```

The language endpoint checks up to 500 recently pushed repositories, excludes forks, and calculates language totals for up to the first 50 owned repositories. If the configured token belongs to the requested user, private owned repositories may be included.

## How activity is calculated

The app queries repositories available to the authenticated GitHub user, then checks branches and recent pull-request head refs for commits in the requested period. This means activity searches are limited to repositories the token can access. Duplicate commits are removed by SHA. A commit is attributed to the requested user by GitHub login, a known email address, or a matching `Co-authored-by` trailer.

Additions and deletions require fetching commit details, so large date ranges or active accounts can make many GitHub API requests. For faster and more reliable results, prefer focused date ranges and configure `GITHUB_TOKEN`.

## Caching and rate limits

- `/api/stats` does not add application-level caching.
- Both SVG endpoints use a five-minute in-memory cache.
- SVG responses send `max-age=300`, `s-maxage=300`, and `stale-while-revalidate=600` cache directives.
- In-memory caches are local to each running process and may be cleared by restarts or serverless instance changes.
- GitHub rate limits still apply; authenticated requests receive a higher allowance.

## Scripts

| Command | Description |
| --- | --- |
| `bun dev` / `npm run dev` | Start the development server |
| `bun run build` / `npm run build` | Create a production build |
| `bun start` / `npm run start` | Start the production server |
| `bun run lint` / `npm run lint` | Run ESLint |
| `bun run typecheck` / `npm run typecheck` | Check TypeScript types |

## Project structure

```text
app/
├── api/
│   ├── banner/             # Stats SVG endpoint
│   ├── languages-banner/   # Languages SVG endpoint
│   └── stats/              # Activity JSON endpoint
├── banner/                 # Interactive banner builders
└── page.tsx                # Activity search page
components/                 # Application and UI components
lib/                        # GitHub client, aggregation, caching, and utilities
public/                     # Static assets
```

## Deployment

The app can be deployed to any platform that supports Next.js. Configure `GITHUB_TOKEN` in the deployment environment and never expose it through a `NEXT_PUBLIC_` variable.

For Vercel, import the repository, add `GITHUB_TOKEN` in the project's environment variables, and deploy. Banner URLs can then use the deployment's public domain.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 Mário Gomes.
