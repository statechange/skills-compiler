"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, History, X } from "lucide-react";
import { urlToRoute } from "@/lib/routing";
import {
  forgetRecent,
  formatRelativeTime,
  getRecents,
  type RecentEntry,
} from "@/lib/recents";

export function RecentsList() {
  const [recents, setRecents] = useState<RecentEntry[] | null>(null);

  useEffect(() => {
    const load = () => setRecents(getRecents());
    load();
    window.addEventListener("sc-recents-changed", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("sc-recents-changed", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  if (recents === null || recents.length === 0) return null;

  return (
    <section className="mt-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <History className="size-4 text-muted-foreground" />
        Recent
        <span className="text-muted-foreground">({recents.length})</span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-white/80 ring-1 ring-foreground/10">
        {recents.map((r) => (
          <li
            key={r.url}
            className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-accent/40"
          >
            <Link
              href={urlToRoute(r.url)}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {r.url}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{formatRelativeTime(r.lastUsedAt)}</span>
                  {typeof r.skillCount === "number" && (
                    <>
                      <span>·</span>
                      <span>
                        {r.skillCount} skill{r.skillCount === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
            <button
              type="button"
              aria-label={`Remove ${r.url} from recents`}
              onClick={() => {
                forgetRecent(r.url);
                setRecents(getRecents());
              }}
              className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
