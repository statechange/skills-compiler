export interface RecentEntry {
  url: string;
  lastUsedAt: number;
  skillCount?: number;
}

const KEY = "sc-skills-compiler:recents:v1";
const MAX = 15;

function readRaw(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentEntry =>
        e && typeof e.url === "string" && typeof e.lastUsedAt === "number",
    );
  } catch {
    return [];
  }
}

function writeRaw(list: RecentEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("sc-recents-changed"));
  } catch {
    // quota or serialization errors — safe to ignore
  }
}

export function getRecents(): RecentEntry[] {
  return readRaw().sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function rememberRecent(url: string, skillCount?: number) {
  const normalized = url.trim();
  if (!normalized) return;
  const now = Date.now();
  const list = readRaw();
  const existing = list.findIndex((e) => e.url === normalized);
  const entry: RecentEntry = {
    url: normalized,
    lastUsedAt: now,
    skillCount: skillCount ?? (existing >= 0 ? list[existing].skillCount : undefined),
  };
  if (existing >= 0) list.splice(existing, 1);
  list.unshift(entry);
  writeRaw(list.slice(0, MAX));
}

export function forgetRecent(url: string) {
  writeRaw(readRaw().filter((e) => e.url !== url));
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 45) return "just now";
  if (diffSec < 90) return "1 min ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 45) return `${diffMin} min ago`;
  if (diffMin < 90) return "1 hr ago";
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
