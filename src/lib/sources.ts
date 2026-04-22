import { load as parseYaml } from "js-yaml";

export type SourceKind = "github-tree" | "direct-file";

export interface GithubTreeSource {
  kind: "github-tree";
  owner: string;
  repo: string;
  branch: string;
  /** subpath within the repo (no leading slash), or empty for root */
  subpath: string;
  /**
   * Optional: match only skills whose folder basename equals this slug.
   * Used when a user pastes e.g. `skills.sh/vercel-labs/skills/find-skills`
   * — we still scan the whole tree, but keep just that one skill.
   */
  skillSlug?: string;
}

export interface DirectFileSource {
  kind: "direct-file";
  url: string;
}

export type Source = GithubTreeSource | DirectFileSource;

export interface FileEntry {
  /** Path relative to the source root (the folder containing SKILL.md). */
  path: string;
  /** Full URL we'll fetch raw bytes from. */
  fetchUrl: string;
  size?: number;
}

export interface SkillManifest {
  name: string;
  description: string;
  [key: string]: unknown;
}

export interface DetectedSkill {
  /** Human-friendly id derived from folder name, used as default zip name. */
  id: string;
  /** Path of the skill folder relative to the source root. Empty string = root. */
  folder: string;
  manifest: SkillManifest;
  /** Raw SKILL.md body (content after frontmatter). */
  body: string;
  files: FileEntry[];
}

const OWNER_REPO_RE = /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/;

/** Parse a user-supplied URL (or `owner/repo` shorthand) into a Source. */
export function parseSourceUrl(raw: string): Source | { error: string } {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return { error: "Please paste a URL." };

  // `owner/repo` shorthand (no scheme).
  if (!/^https?:\/\//i.test(trimmed) && OWNER_REPO_RE.test(trimmed)) {
    const [owner, repoRaw] = trimmed.split("/");
    return {
      kind: "github-tree",
      owner,
      repo: repoRaw.replace(/\.git$/, ""),
      branch: "",
      subpath: "",
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { error: "That doesn't look like a valid URL." };
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "github.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return { error: "GitHub URL needs an owner and repo." };
    }
    const [owner, repoRaw, ref, branch, ...rest] = segments;
    const repo = repoRaw.replace(/\.git$/, "");

    if (ref === "tree" || ref === "blob") {
      return {
        kind: "github-tree",
        owner,
        repo,
        branch: branch ?? "",
        subpath: rest.join("/"),
      };
    }

    return { kind: "github-tree", owner, repo, branch: "", subpath: "" };
  }

  // skills.sh — maps directly to GitHub owner/repo.
  // /{org}                       → error, user needs a repo
  // /{org}/{repo}                → whole repo
  // /{org}/{repo}/{skill}        → whole repo, filter to that one skill
  if (host === "skills.sh") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return { error: "That looks like the skills.sh homepage. Paste a repo or skill URL." };
    }
    if (segments.length === 1) {
      return {
        error: `That page lists many repos from "${segments[0]}". Open one of the repos on skills.sh and paste that URL instead.`,
      };
    }
    const [owner, repo, skill] = segments;
    return {
      kind: "github-tree",
      owner,
      repo: repo.replace(/\.git$/, ""),
      branch: "",
      subpath: "",
      skillSlug: skill,
    };
  }

  if (host === "raw.githubusercontent.com" || trimmed.toLowerCase().endsWith(".md")) {
    return { kind: "direct-file", url: trimmed };
  }

  return { kind: "direct-file", url: trimmed };
}

/* ---------- GitHub API helpers ---------- */

interface GithubTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
}

interface GithubTreeResponse {
  sha: string;
  url: string;
  tree: GithubTreeEntry[];
  truncated: boolean;
}

const GITHUB_API = "https://api.github.com";

function ghHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "skills-compiler",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function resolveDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: ghHeaders(),
  });
  if (!res.ok) {
    throw new Error(
      `Couldn't load ${owner}/${repo} on GitHub (${res.status}). Is it public?`,
    );
  }
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch ?? "main";
}

async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<GithubTreeResponse> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: ghHeaders() },
  );
  if (!res.ok) {
    throw new Error(
      `Couldn't load the file tree for ${owner}/${repo}@${branch} (${res.status}).`,
    );
  }
  return (await res.json()) as GithubTreeResponse;
}

function rawUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/* ---------- Skill detection ---------- */

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseSkillMd(contents: string): {
  manifest: SkillManifest;
  body: string;
} | null {
  const match = contents.match(FRONTMATTER_RE);
  if (!match) return null;
  try {
    const manifest = parseYaml(match[1]) as SkillManifest;
    if (!manifest || typeof manifest !== "object") return null;
    if (!manifest.name || !manifest.description) return null;
    return { manifest, body: match[2] ?? "" };
  } catch {
    return null;
  }
}

function slugifyFolder(folder: string, fallback: string): string {
  const last = folder.split("/").filter(Boolean).pop() ?? fallback;
  return (
    last
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "skills-compiler" } });
  if (!res.ok) {
    throw new Error(`Couldn't fetch ${url} (${res.status}).`);
  }
  return await res.text();
}

/**
 * Detect all skills under the given GitHub source.
 * Walks the repo tree, finds every SKILL.md that passes frontmatter validation,
 * and collects its sibling files.
 */
export async function detectGithubSkills(
  source: GithubTreeSource,
): Promise<{ source: GithubTreeSource; skills: DetectedSkill[] }> {
  const branch = source.branch || (await resolveDefaultBranch(source.owner, source.repo));
  const resolved: GithubTreeSource = { ...source, branch };
  const tree = await fetchTree(resolved.owner, resolved.repo, branch);

  const prefix = resolved.subpath ? resolved.subpath.replace(/\/+$/, "") + "/" : "";
  const scoped = tree.tree.filter((e) => {
    if (!prefix) return true;
    return e.path === prefix.slice(0, -1) || e.path.startsWith(prefix);
  });

  const skillMdPaths = scoped
    .filter((e) => e.type === "blob" && e.path.split("/").pop() === "SKILL.md")
    .map((e) => e.path);

  const skills: DetectedSkill[] = [];
  for (const mdPath of skillMdPaths) {
    const folder = mdPath.slice(0, -"SKILL.md".length).replace(/\/+$/, "");
    if (resolved.skillSlug) {
      const basename = folder.split("/").filter(Boolean).pop() ?? "";
      if (basename !== resolved.skillSlug) continue;
    }
    const rawMd = await fetchText(
      rawUrl(resolved.owner, resolved.repo, branch, mdPath),
    );
    const parsed = parseSkillMd(rawMd);
    if (!parsed) continue;

    const folderPrefix = folder ? folder + "/" : "";
    const files: FileEntry[] = scoped
      .filter((e) => e.type === "blob")
      .filter((e) =>
        folderPrefix ? e.path.startsWith(folderPrefix) : true,
      )
      .map((e) => ({
        path: folderPrefix ? e.path.slice(folderPrefix.length) : e.path,
        fetchUrl: rawUrl(resolved.owner, resolved.repo, branch, e.path),
        size: e.size,
      }));

    skills.push({
      id: slugifyFolder(folder, (parsed.manifest.name as string) || "skill"),
      folder,
      manifest: parsed.manifest,
      body: parsed.body,
      files,
    });
  }

  return { source: resolved, skills };
}

/** Handle a single-file URL that points at a SKILL.md. */
export async function detectDirectSkill(
  source: DirectFileSource,
): Promise<{ source: DirectFileSource; skills: DetectedSkill[] }> {
  const text = await fetchText(source.url);
  const parsed = parseSkillMd(text);
  if (!parsed) {
    throw new Error(
      "Couldn't find a skill at that URL. Expected a SKILL.md with name and description fields.",
    );
  }
  const id = slugifyFolder("", (parsed.manifest.name as string) || "skill");
  return {
    source,
    skills: [
      {
        id,
        folder: "",
        manifest: parsed.manifest,
        body: parsed.body,
        files: [
          {
            path: "SKILL.md",
            fetchUrl: source.url,
          },
        ],
      },
    ],
  };
}
