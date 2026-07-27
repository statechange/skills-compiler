# Architecture

## System shape

Skills Compiler is a Next.js 16 App Router application deployed to Netlify at
`https://skill-compiler.statechange.ai`.

The request flow is:

1. `src/components/compiler.tsx` accepts a GitHub, skills.sh, shorthand, or
   direct Markdown URL and keeps the source visible in the route through
   `src/lib/routing.ts`.
2. `POST /api/analyze` parses the source with `src/lib/sources.ts`, resolves a
   GitHub tree or direct file, validates `SKILL.md` frontmatter, and returns
   skill metadata plus the files owned by each skill.
3. The client renders either the single-skill or multi-skill selection flow.
4. `POST /api/package` repeats source detection at download time, fetches the
   selected skill's files, builds a DEFLATE-compressed ZIP with JSZip, and
   returns it with a `.skill` filename.
5. The browser downloads each selected skill independently.

## Source parsing and detection

`src/lib/sources.ts` is the source-of-truth for supported inputs and skill
ownership.

- GitHub repository and tree URLs use the GitHub REST API to resolve the
  default branch and recursive tree.
- skills.sh URLs map to their GitHub owner/repository; an optional third path
  segment filters the detected skills by folder basename.
- Direct URLs fetch one Markdown file and require valid YAML frontmatter with
  `name` and `description`.
- A nested skill directory is excluded from its parent's file set.
- GitHub rate limits become a typed `GithubRateLimitError` with a bounded
  retry interval; both API routes translate it into a structured HTTP 429.

## Runtime and state boundaries

- `/api/analyze` and `/api/package` run in the Node.js server runtime.
- `GITHUB_TOKEN` is an optional server-side environment variable. Production
  keeps it as a Netlify secret; it is never sent to the client.
- Raw source files are fetched only while analyzing or packaging. The app has
  no database and does not retain source contents.
- Recent inputs live only in browser `localStorage` through
  `src/lib/recents.ts`.
- Agentation is enabled for local development and can be opted into on a
  preview with `NEXT_PUBLIC_AGENTATION=on`; it is off in public production by
  default.

## Deployment and verification

Netlify is connected to `statechange/skills-compiler` and builds `main` with
`npm run build`. A production deploy uses the `.next` output. The canary is a
Netlify deploy preview, which should exercise the analyze and package
boundaries against a real public skill before merge.

The current package scripts expose development, build, and start commands.
There is no automated test script, so `npm run build` plus boundary-level API
and archive verification is the minimum honest check.
