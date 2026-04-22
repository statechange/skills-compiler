import { NextRequest } from "next/server";
import {
  detectDirectSkill,
  detectGithubSkills,
  GithubRateLimitError,
  parseSourceUrl,
} from "@/lib/sources";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let url: string | undefined;
  try {
    const body = await request.json();
    url = typeof body?.url === "string" ? body.url : undefined;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!url) {
    return Response.json({ error: "Missing `url`." }, { status: 400 });
  }

  const source = parseSourceUrl(url);
  if ("error" in source) {
    return Response.json({ error: source.error }, { status: 400 });
  }

  try {
    const result =
      source.kind === "github-tree"
        ? await detectGithubSkills(source)
        : await detectDirectSkill(source);

    if (result.skills.length === 0) {
      return Response.json(
        {
          error:
            "No skills found at that URL. A skill is a folder with a SKILL.md file (with name and description in frontmatter).",
        },
        { status: 404 },
      );
    }

    return Response.json({
      source: result.source,
      skills: result.skills.map((s) => ({
        id: s.id,
        folder: s.folder,
        manifest: s.manifest,
        body: s.body,
        files: s.files.map((f) => ({ path: f.path, size: f.size })),
      })),
    });
  } catch (err) {
    if (err instanceof GithubRateLimitError) {
      return Response.json(
        {
          error: err.message,
          code: "rate_limited",
          retryAfter: err.retryAfterSec,
          authenticated: err.authenticated,
        },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSec) },
        },
      );
    }
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
