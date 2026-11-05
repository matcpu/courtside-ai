"use client";
import type { ProductDemo } from "./product-navigation";
export type LocalPreviewSession = {
  enabled: true;
  user: { id: string };
  demo: ProductDemo;
  dashboard: string;
};
let pending: Promise<LocalPreviewSession | null> | undefined;
export function ensureLocalPreviewSession() {
  if (process.env.NODE_ENV === "production") return Promise.resolve(null);
  return (pending ??= (async () => {
    const status = await fetch("/api/local-demo-session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (status.status === 404) return null;
    if (!status.ok) throw Error("Local demo session unavailable");
    const current = await status.json();
    if (current.user) return current as LocalPreviewSession;
    const result = await fetch("/api/local-demo-session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!result.ok) throw Error("Could not prepare the local demo session.");
    return (await result.json()) as LocalPreviewSession;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
