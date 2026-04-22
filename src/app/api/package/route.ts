import { NextRequest } from "next/server";
import JSZip from "jszip";
import {
  detectDirectSkill,
  detectGithubSkills,
  parseSourceUrl,
  type DetectedSkill,
} from "@/lib/sources";

export const runtime = "nodejs";

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "skills-compiler" },
  });
  if (!res.ok) {
    throw new Error(`Couldn't fetch ${url} (${res.status}).`);
  }
  return await res.arrayBuffer();
}

function safeSkillName(skill: DetectedSkill): string {
  const base =
    skill.id ||
    (typeof skill.manifest.name === "string" ? skill.manifest.name : "skill");
  return `${base.replace(/[^a-z0-9-_]+/gi, "-")}.skill`;
}

async function buildSkillZip(skill: DetectedSkill): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of skill.files) {
    const buf = await fetchBinary(file.fetchUrl);
    zip.file(file.path, buf);
  }
  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function POST(request: NextRequest) {
  let url: string | undefined;
  let skillId: string | undefined;
  try {
    const body = await request.json();
    url = typeof body?.url === "string" ? body.url : undefined;
    skillId = typeof body?.skillId === "string" ? body.skillId : undefined;
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

    const skill = skillId
      ? result.skills.find((s) => s.id === skillId)
      : result.skills[0];

    if (!skill) {
      return Response.json(
        { error: skillId ? `No skill with id "${skillId}".` : "No skills found." },
        { status: 404 },
      );
    }

    const bytes = await buildSkillZip(skill);
    const downloadName = safeSkillName(skill);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
