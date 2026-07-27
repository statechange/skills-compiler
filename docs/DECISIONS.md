# Decisions

## 2026-07-26 — Require a Netlify deploy preview as the canary

Production is a public, single-environment Netlify app. Changes should be
exercised on a Netlify deploy preview before production merge so the real
server runtime, GitHub access, packaging flow, and browser download path are
tested without using production as the first tester.

## 2026-04-22 — Authenticate GitHub reads with an optional fine-grained token

The app works without credentials for casual public-repository use, but
unauthenticated GitHub API requests have a much smaller rate limit. Netlify
provides `GITHUB_TOKEN` to the server runtime so production receives the
authenticated limit. The token needs only the access required to read the
public sources the compiler supports; its value never belongs in git.

## 2026-04-22 — Emit one `.skill` archive per detected skill

Claude imports skills individually, so a multi-skill source produces multiple
independent downloads rather than one aggregate archive. Each output uses the
`.skill` extension even though its payload is a ZIP archive.

## 2026-04-22 — Nested skills own their own files

When a repository contains a skill inside another skill's directory, the
parent archive excludes the nested skill's files. This prevents the same
files from being claimed by two outputs and keeps each detected skill
self-contained.

## 2026-04-22 — Keep the typed source in the route

GitHub, skills.sh, shorthand, and direct-file inputs are encoded into the
route. This makes analyzed sources deep-linkable and preserves browser
back/forward behavior instead of treating the input as disposable form state.

## 2026-04-22 — Keep recent sources in the browser

Recent source URLs are a convenience local to the user's browser. They are
stored in `localStorage`, capped at 15 entries, and are not a server-side
account or analytics system.
