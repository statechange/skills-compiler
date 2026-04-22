/**
 * URL ↔ route-path helpers.
 *
 * We keep the user-typed input visible in the route:
 *   https://github.com/owner/repo  →  /github.com/owner/repo
 *   skills.sh/vercel-labs/skills  →  /skills.sh/vercel-labs/skills
 *   owner/repo (shorthand)         →  /owner/repo
 *   https://example.com/SKILL.md   →  /example.com/SKILL.md
 *
 * A first segment containing a dot is treated as a host and an https:// scheme
 * is added back on decode. Anything else is returned verbatim (shorthand form).
 */

export function urlToRoute(input: string): string {
  const stripped = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  return `/${stripped.split("/").map(encodeURIComponent).join("/")}`;
}

export function routeToUrl(segments: string[]): string {
  if (segments.length === 0) return "";
  const decoded = segments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const joined = decoded.join("/");
  return decoded[0].includes(".") ? `https://${joined}` : joined;
}
