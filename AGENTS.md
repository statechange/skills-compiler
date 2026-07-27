## Skills Compiler

Skills Compiler is a public web app that turns agent skills from GitHub,
skills.sh, or a direct `SKILL.md` URL into Claude-importable `.skill` files.
The project is in the Graveyard phase: durable work belongs in GitHub issues
and a cold agent should be able to resume from this repository plus the
strategic Project Overview linked from `docs/OVERVIEW.md`.

repo-type: mixed

project-types: frontend

canary: required: Netlify deploy preview before production merge

## Canon and work

- Technical decisions live in `docs/DECISIONS.md`.
- Current system shape and operational boundaries live in
  `docs/ARCHITECTURE.md`.
- Strategic state lives in the Notion Project Overview linked from
  `docs/OVERVIEW.md`; do not duplicate it into repo docs.
- Project work lives in GitHub issues and PRs for
  `statechange/skills-compiler`.

## Working in this repo

- Use `npm install` to install dependencies, `npm run dev` for local
  development, and `npm run build` as the minimum verification gate.
- Exercise changes through the same boundary they affect. For the primary
  flow, call `/api/analyze`, download through `/api/package`, and confirm the
  resulting `.skill` archive contains the intended files.
- Production is `https://skill-compiler.statechange.ai` on Netlify. The
  optional `GITHUB_TOKEN` environment variable authenticates server-side
  GitHub API requests; never commit or print its value.
- Preserve nested-skill ownership: a parent skill must not package files that
  belong to a nested skill.
- Keep the public production UI free of development-only feedback controls;
  Agentation is local by default and may be explicitly enabled on previews.
- Do not edit generated output under `.next/`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
