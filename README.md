# Skills Compiler

**Turn any agent skill into a Claude-ready zip.**

Paste a GitHub repo, a folder inside a repo, a [skills.sh](https://skills.sh)
link, or a direct URL to a `SKILL.md`. We bundle every skill we find into a
ready-to-import `.skill` file for Claude Desktop — no terminal required.

Downloaded files use the `.skill` extension (a zip under the hood — that's
what Claude wants). Selecting multiple skills triggers multiple independent
downloads, one `.skill` per skill, so you can drop each one into Claude
directly.

A gift from [State Change](https://statechange.ai). Made for the people who
want AI to just work.

## Supported URL shapes

| You paste | What happens |
| --- | --- |
| `https://github.com/owner/repo` | Every `SKILL.md` in the repo |
| `https://github.com/owner/repo/tree/main/some/folder` | Only skills inside that folder |
| `https://skills.sh/org/repo` | Mapped to the matching GitHub repo |
| `https://skills.sh/org/repo/skill` | Just that one skill |
| `owner/repo` (shorthand) | Whole repo on GitHub |
| `https://.../SKILL.md` | A single skill from that file |

A "skill" is any folder with a `SKILL.md` whose YAML frontmatter has `name` and
`description`.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Environment variables

- `GITHUB_TOKEN` _(optional)_ — a personal access token. Without it, the public
  GitHub API allows 60 requests per hour per IP, which is usually fine for
  casual use. Set this to avoid rate limits on busy days.

## Tech

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 + shadcn/ui
- `jszip` for zip generation, `js-yaml` for frontmatter parsing
- [`agentation`](https://www.agentation.com) for in-page visual feedback

## Importing into Claude Desktop

1. Open Claude Desktop (or Claude on the web).
2. Go to **Settings → Capabilities → Skills**.
3. Click **Upload skill** and choose the `.skill.zip` you downloaded.
4. Enable the skill for the project you want to use it in.
