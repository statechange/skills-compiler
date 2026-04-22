"use client";

import { Agentation } from "agentation";

/**
 * Agentation renders a floating feedback toolbar. We only want it in local
 * development by default — users on the public deploy shouldn't see it.
 * Set NEXT_PUBLIC_AGENTATION=on to force-enable (e.g. on a preview deploy).
 */
const enabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_AGENTATION === "on";

export function AgentationWidget() {
  if (!enabled) return null;
  return <Agentation />;
}
