"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { urlToRoute } from "@/lib/routing";
import { rememberRecent } from "@/lib/recents";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RecentsList } from "@/components/recents-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SkillPreview {
  id: string;
  folder: string;
  manifest: {
    name: string;
    description: string;
    [key: string]: unknown;
  };
  body: string;
  files: { path: string; size?: number }[];
}

interface AnalyzeResponse {
  source: unknown;
  skills: SkillPreview[];
}

const EXAMPLES = [
  {
    label: "Anthropic official",
    url: "https://github.com/anthropics/skills",
  },
  {
    label: "Matt Pocock",
    url: "https://github.com/mattpocock/skills",
  },
  {
    label: "Marketing skills",
    url: "https://github.com/coreyhaines31/marketingskills",
  },
  {
    label: "Vercel Labs",
    url: "https://skills.sh/vercel-labs/skills",
  },
  {
    label: "Just the PDF skill",
    url: "https://github.com/anthropics/skills/tree/main/skills/pdf",
  },
];

type State =
  | { phase: "idle" }
  | { phase: "analyzing"; url: string }
  | { phase: "rate-limited"; url: string; retryAt: number; authenticated: boolean }
  | { phase: "error"; message: string }
  | { phase: "ready"; url: string; skills: SkillPreview[] };

interface RateLimitBody {
  code: "rate_limited";
  error: string;
  retryAfter: number;
  authenticated: boolean;
}

export function Compiler({ initialUrl = "" }: { initialUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [downloading, setDownloading] = useState<string | null>(null);
  const lastAnalyzed = useRef<string | null>(null);

  async function analyze(targetUrl: string) {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    setState({ phase: "analyzing", url: trimmed });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.status === 429) {
        const body = (await res.json()) as RateLimitBody;
        setState({
          phase: "rate-limited",
          url: trimmed,
          retryAt: Date.now() + body.retryAfter * 1000,
          authenticated: body.authenticated,
        });
        return;
      }
      const data = (await res.json()) as AnalyzeResponse | { error: string };
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : "Couldn't read that URL.";
        setState({ phase: "error", message: msg });
        return;
      }
      setState({ phase: "ready", url: trimmed, skills: data.skills });
      rememberRecent(trimmed, data.skills.length);
    } catch (err) {
      setState({
        phase: "error",
        message:
          err instanceof Error ? err.message : "Network error — please try again.",
      });
    }
  }

  // When the route path changes (back/forward, deep-link), (re-)analyze.
  useEffect(() => {
    if (!initialUrl) return;
    if (lastAnalyzed.current === initialUrl) return;
    lastAnalyzed.current = initialUrl;
    setUrl(initialUrl);
    analyze(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const route = urlToRoute(trimmed);
    lastAnalyzed.current = trimmed;
    router.push(route);
    analyze(trimmed);
  }

  async function downloadOne(skillId: string): Promise<string | null> {
    if (state.phase !== "ready") return null;
    const res = await fetch("/api/package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: state.url, skillId }),
    });
    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as Partial<RateLimitBody>;
      throw new Error(
        `GitHub asked us to slow down. Try again in ~${body.retryAfter ?? 30}s.`,
      );
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? "Couldn't build that skill.");
    }
    const blob = await res.blob();
    const disp = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disp);
    const filename = match?.[1] ?? `${skillId}.skill`;
    triggerBrowserDownload(blob, filename);
    return filename;
  }

  async function downloadMany(skillIds: string[], tag: string) {
    if (state.phase !== "ready" || skillIds.length === 0) return;
    setDownloading(tag);

    if (skillIds.length === 1) {
      try {
        const name = await downloadOne(skillIds[0]);
        if (name) toast.success(`Downloaded ${name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Download failed.");
      } finally {
        setDownloading(null);
      }
      return;
    }

    const toastId = toast.loading(`Downloading 0 of ${skillIds.length}…`);
    let ok = 0;
    let failed = 0;
    try {
      for (let i = 0; i < skillIds.length; i++) {
        try {
          await downloadOne(skillIds[i]);
          ok += 1;
        } catch {
          failed += 1;
        }
        toast.loading(`Downloading ${ok + failed} of ${skillIds.length}…`, {
          id: toastId,
        });
        // Pace downloads so the browser doesn't collapse them.
        if (i < skillIds.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      if (failed === 0) {
        toast.success(`Downloaded ${ok} skills.`, { id: toastId });
      } else {
        toast.warning(`Downloaded ${ok} — ${failed} failed.`, { id: toastId });
      }
    } finally {
      setDownloading(null);
    }
  }

  const isReady = state.phase === "ready";

  return (
    <div className="flex flex-col gap-6">
      {!isReady && (
        <header className="flex flex-col items-center text-center gap-5 mb-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/60 px-4 py-1.5 text-xs font-semibold text-accent-foreground ring-1 ring-accent-foreground/10">
            <span className="size-1.5 rounded-full bg-accent-foreground/60" />
            Skills Compiler
          </div>
          <h1 className="text-balance text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground">
            Turn any skill into a{" "}
            <span className="text-primary">Claude-ready</span> file.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Paste a link from{" "}
            <span className="font-semibold text-foreground">GitHub</span> or{" "}
            <span className="font-semibold text-foreground">skills.sh</span> (or
            a direct URL to a{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              SKILL.md
            </code>
            ) and we&rsquo;ll package it into a single file you can drop into
            Claude Desktop. No terminals. No unzipping. No headaches.
          </p>
        </header>
      )}

      <form onSubmit={onSubmit}>
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:p-2.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="github.com/…  ·  skills.sh/…  ·  owner/repo"
            className={`flex-1 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 ${isReady ? "h-10 text-sm sm:text-sm" : "h-12 text-base sm:text-base"}`}
            aria-label="Repository or skill URL"
            disabled={state.phase === "analyzing"}
          />
          <Button
            type="submit"
            size="lg"
            className={`gap-2 font-semibold ${isReady ? "h-10 px-4 text-sm" : "h-12 px-5 text-base"}`}
            disabled={state.phase === "analyzing" || !url.trim()}
          >
            {state.phase === "analyzing" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {isReady ? "Re-scan" : "Find Skills"}
                {!isReady && <ArrowRight className="size-4" />}
              </>
            )}
          </Button>
        </div>
      </form>

      {state.phase === "idle" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              type="button"
              onClick={() => {
                setUrl(ex.url);
                lastAnalyzed.current = ex.url;
                router.push(urlToRoute(ex.url));
                analyze(ex.url);
              }}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground ring-1 ring-foreground/10 transition hover:bg-accent/60 hover:text-accent-foreground"
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      {state.phase === "error" && (
        <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
          <AlertTitle className="text-destructive">
            We couldn&rsquo;t read that URL
          </AlertTitle>
          <AlertDescription className="text-destructive/80">
            {state.message}
          </AlertDescription>
        </Alert>
      )}

      {state.phase === "rate-limited" && (
        <RateLimitBanner
          retryAt={state.retryAt}
          authenticated={state.authenticated}
          onRetry={() => analyze(state.url)}
        />
      )}

      {state.phase === "ready" && (
        <PreviewSection
          url={state.url}
          skills={state.skills}
          downloading={downloading}
          onDownload={downloadMany}
          onReset={() => {
            lastAnalyzed.current = null;
            setState({ phase: "idle" });
            setUrl("");
            router.push("/");
          }}
        />
      )}

      {!isReady && (
        <>
          <section className="mt-4 grid gap-6 sm:grid-cols-3">
            <HowStep
              number="1"
              title="Paste a link"
              body="A GitHub repo, a folder in a repo, a skills.sh page, or a direct URL to a SKILL.md — whichever you have."
            />
            <HowStep
              number="2"
              title="Preview what we found"
              body="We scan for every SKILL.md and show you what each skill does, plus every file that comes with it."
            />
            <HowStep
              number="3"
              title="Download & import"
              body="One click gives you a .skill file. Drop it into Claude Desktop and you're done."
            />
          </section>
          <RecentsList />
        </>
      )}
    </div>
  );
}

function RateLimitBanner({
  retryAt,
  authenticated,
  onRetry,
}: {
  retryAt: number;
  authenticated: boolean;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [retryAt]);

  const remainingSec = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    if (remainingSec === 0 && !firedRef.current) {
      firedRef.current = true;
      onRetry();
    }
  }, [remainingSec, onRetry]);

  return (
    <div className="rounded-2xl border border-accent-foreground/20 bg-accent/60 p-5 text-accent-foreground shadow-sm">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-accent-foreground ring-1 ring-accent-foreground/15">
          <Clock className="size-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-accent-foreground">
            GitHub is asking us to slow down for a sec
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-accent-foreground/85">
            Hang tight — we&rsquo;ll try again automatically in{" "}
            <span className="font-mono font-semibold tabular-nums">
              {remainingSec}s
            </span>
            . No action needed on your end.
          </p>
          {!authenticated && (
            <p className="mt-2 text-xs leading-relaxed text-accent-foreground/70">
              Tip for the host of this app: set{" "}
              <code className="rounded bg-white/70 px-1 py-0.5">
                GITHUB_TOKEN
              </code>{" "}
              in <code className="rounded bg-white/70 px-1 py-0.5">.env.local</code>{" "}
              to lift the limit by ~80×.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={onRetry}
              disabled={remainingSec > 0}
            >
              {remainingSec > 0 ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Waiting…
                </>
              ) : (
                "Try now"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-foreground/5 backdrop-blur-sm">
      <div className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {number}
      </div>
      <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function PreviewSection(props: {
  url: string;
  skills: SkillPreview[];
  downloading: string | null;
  onDownload: (skillIds: string[], tag: string) => void;
  onReset: () => void;
}) {
  if (props.skills.length === 1) {
    return <SingleSkillView {...props} skill={props.skills[0]} />;
  }
  return <MultiSkillView {...props} />;
}

function MultiSkillView({
  url,
  skills,
  downloading,
  onDownload,
  onReset,
}: {
  url: string;
  skills: SkillPreview[];
  downloading: string | null;
  onDownload: (skillIds: string[], tag: string) => void;
  onReset: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => skills.map((s) => s.id), [skills]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleOne(id: string, next: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function toggleAll(next: boolean) {
    setSelected(next ? new Set(allIds) : new Set());
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const selectedIds = useMemo(() => [...selected], [selected]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Source
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block max-w-[42ch] truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {url}
          </a>
          <div className="mt-1 text-sm text-muted-foreground">
            Found{" "}
            <span className="font-semibold text-foreground">{skills.length}</span>{" "}
            {skills.length === 1 ? "skill" : "skills"}.
            {selected.size > 0 && (
              <>
                {" "}
                <span className="font-semibold text-primary">
                  {selected.size} selected
                </span>
                .
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            className="h-10 gap-2 px-4"
            onClick={() => onDownload(selectedIds, `bulk:${selectedIds.join(",")}`)}
            disabled={downloading !== null || selectedIds.length === 0}
          >
            {downloading?.startsWith("bulk:") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download {selected.size > 0 ? selected.size : ""} selected
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10 gap-2 px-4"
            onClick={() => onDownload(allIds, "all")}
            disabled={downloading !== null}
          >
            {downloading === "all" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Package className="size-4" />
            )}
            Download all
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-10"
            onClick={onReset}
            disabled={downloading !== null}
          >
            Start over
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-foreground/10">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={(v) => toggleAll(v === true)}
              aria-label="Select all skills"
            />
            <span className="uppercase tracking-wide">
              {selected.size > 0
                ? `${selected.size} of ${skills.length}`
                : "Select all"}
            </span>
          </label>
          <div className="ml-auto flex items-center gap-4 text-[11px] uppercase tracking-wide">
            <span className="hidden sm:inline">Files</span>
            <span className="w-[88px] text-right">Download</span>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {skills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              selected={selected.has(skill.id)}
              onSelectedChange={(next) => toggleOne(skill.id, next)}
              expanded={expanded.has(skill.id)}
              onToggleExpanded={() => toggleExpanded(skill.id)}
              busy={downloading === `one:${skill.id}`}
              disabled={downloading !== null && downloading !== `one:${skill.id}`}
              onDownload={() => onDownload([skill.id], `one:${skill.id}`)}
            />
          ))}
        </ul>
      </div>

      <ImportInstructions />
    </div>
  );
}

function SingleSkillView({
  url,
  skill,
  downloading,
  onDownload,
  onReset,
}: {
  url: string;
  skill: SkillPreview;
  downloading: string | null;
  onDownload: (skillIds: string[], tag: string) => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalKb = Math.max(
    1,
    Math.round(skill.files.reduce((t, f) => t + (f.size ?? 0), 0) / 1024),
  );
  const busy = downloading === `one:${skill.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Source
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block max-w-[42ch] truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {url}
          </a>
        </div>
        <Button
          variant="ghost"
          size="lg"
          className="h-10"
          onClick={onReset}
          disabled={busy}
        >
          Start over
        </Button>
      </div>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {skill.manifest.name}
            </h2>
            {skill.folder && (
              <div className="mt-1">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  /{skill.folder}
                </code>
              </div>
            )}
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {skill.manifest.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <FileText className="size-3" />
                {skill.files.length} file{skill.files.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                ~{totalKb} KB
              </Badge>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              size="lg"
              className="h-12 gap-2 px-5 text-base font-semibold"
              onClick={() => onDownload([skill.id], `one:${skill.id}`)}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download .skill
            </Button>
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
            aria-expanded={expanded}
          >
            <ChevronRight
              className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {expanded ? "Hide" : "Show"} {skill.files.length} file
            {skill.files.length === 1 ? "" : "s"}
          </button>
          {expanded && (
            <ul className="mt-3 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
              {skill.files.map((f) => (
                <li key={f.path} className="truncate">
                  {f.path}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ImportInstructions />
    </div>
  );
}

function SkillRow({
  skill,
  selected,
  onSelectedChange,
  expanded,
  onToggleExpanded,
  busy,
  disabled,
  onDownload,
}: {
  skill: SkillPreview;
  selected: boolean;
  onSelectedChange: (next: boolean) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  busy: boolean;
  disabled: boolean;
  onDownload: () => void;
}) {
  const totalKb = Math.max(
    1,
    Math.round(skill.files.reduce((t, f) => t + (f.size ?? 0), 0) / 1024),
  );

  return (
    <li
      className={`px-4 py-3 transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/30"}`}
    >
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelectedChange(v === true)}
            aria-label={`Select ${skill.manifest.name}`}
          />
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-0.5 size-6 shrink-0 rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={expanded ? "Hide files" : "Show files"}
          aria-expanded={expanded}
        >
          <ChevronRight
            className={`mx-auto size-4 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {skill.manifest.name}
            </h3>
            {skill.folder && (
              <code className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                /{skill.folder}
              </code>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {skill.manifest.description}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          <Badge variant="secondary" className="gap-1">
            <FileText className="size-3" />
            {skill.files.length}
          </Badge>
          <span className="tabular-nums">{totalKb} KB</span>
        </div>
        <div className="shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-[88px] gap-1.5"
            onClick={onDownload}
            disabled={busy || disabled}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            .skill
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="ml-[60px] mt-3 rounded-lg bg-muted/50 p-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {skill.files.length} file{skill.files.length === 1 ? "" : "s"}
          </div>
          <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto font-mono text-xs text-muted-foreground">
            {skill.files.map((f) => (
              <li key={f.path} className="truncate">
                {f.path}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function ImportInstructions() {
  return (
    <Card className="bg-primary/5 ring-primary/20">
      <CardHeader>
        <CardTitle className="text-base">Next: import into Claude</CardTitle>
        <CardDescription>
          Here&rsquo;s how to put that file to work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2 text-sm text-foreground">
          <Step index={1}>
            Open <strong>Claude Desktop</strong> (or Claude on the web).
          </Step>
          <Step index={2}>
            Go to <strong>Settings → Capabilities → Skills</strong>.
          </Step>
          <Step index={3}>
            Click <strong>Upload skill</strong> and choose the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              .skill
            </code>{" "}
            file you just downloaded.
          </Step>
          <Step index={4}>
            Enable the skill for the project you want to use it in. You&rsquo;re
            done.
          </Step>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Downloading multiple skills at once? Your browser may ask to
          &ldquo;allow this site to download multiple files&rdquo; — that&rsquo;s
          expected. Each file imports into Claude independently.
        </p>
      </CardContent>
    </Card>
  );
}

function Step({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {index}
      </span>
      <span>{children}</span>
    </li>
  );
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
