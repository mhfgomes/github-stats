# GitHub Daily Stats

A Next.js app that calculates daily GitHub activity for a user, including total commits, additions, deletions, and per-repository breakdowns.

## Features

- Search by GitHub username and date range
- Totals for commits, additions, and deletions
- Per-repository stats with commit details
- Optional Convex caching for past days to reduce GitHub API calls
- Shareable SVG banner endpoint (`/api/banner`)
- Light and dark theme toggle

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui components
- GitHub REST API
- Convex (optional cache layer)

## Getting Started

### 1. Install dependencies

```bash
bun install
```

If you prefer npm:

```bash
npm install
```

### 2. Configure environment variables

Copy `example.env` to `.env.local` and set values:

```env
GITHUB_TOKEN=your_github_token

# Optional (enable Convex caching)
CONVEX_DEPLOYMENT=your_convex_deployment
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-project.convex.site
```

Notes:
- `GITHUB_TOKEN` is strongly recommended to avoid low unauthenticated rate limits.
- If `NEXT_PUBLIC_CONVEX_URL` is not set, the app still works and fetches directly from GitHub.

### 3. Run locally

```bash
bun dev
```

Open `http://localhost:3000`.

## API

### `GET /api/stats`

Query params:
- `username` (required)
- `from` (optional, `YYYY-MM-DD`, defaults to today)
- `to` (optional, `YYYY-MM-DD`, defaults to `from`)

Example:

```http
/api/stats?username=torvalds&from=2026-02-01&to=2026-02-07
```

### `GET /api/banner`

Returns an SVG banner using computed stats.

Common params:
- `username` (required)
- `range` (`today`, `yesterday`, `last7`, `lastweek`, `thismonth`, `lastmonth`) or `from`/`to`
- `w`, `h`, `bg1`, `bg2`, `dir`, `text`, `muted`, `accent`
- `items` (comma list: `commits,additions,deletions,net`)
- `top` (top repositories shown)
- `title`, `subtitle`, `show_title`, `show_subtitle`

Example:

```http
/api/banner?username=torvalds&range=last7&items=commits,additions,deletions,net&top=3
```

## Scripts

- `bun dev` or `npm run dev` - Start local dev server
- `bun run build` or `npm run build` - Build for production
- `bun start` or `npm run start` - Start production server

## Project Structure

```text
app/                # Pages and API routes
app/api/stats/      # JSON stats endpoint
app/api/banner/     # SVG banner endpoint
components/         # UI components
lib/                # GitHub and server-side stats logic
convex/             # Optional cache schema/functions
```

## Rate Limit and Caching

- Without Convex, each request fetches directly from GitHub.
- With Convex configured, past-day results are cached and reused.
- The current day is always fetched fresh.

## License

Private/internal project.
