"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase";
import { ensureLocalPreviewSession } from "@/lib/local-demo-client";
type Access = { canManage: boolean; dashboard: string; website: string | null };
export function LeagueConnections({
  leagueId,
  header = false,
  preview = false,
}: {
  leagueId: string;
  header?: boolean;
  preview?: boolean;
}) {
  const [signedIn, setSignedIn] = useState(false),
    [access, setAccess] = useState<Access | null>(null);
  useEffect(() => {
    if (preview) return;
    let live = true,
      epoch = 0;
    const client = browserSupabase();
    let interactive = false,
      resolved = false;
    const update = async (
      session: { access_token: string } | null,
      local = false,
    ) => {
      const current = ++epoch;
      if (live) {
        setSignedIn(Boolean(session) || local);
        setAccess(null);
      }
      if (!session && !local) return;
      try {
        const r = await fetch(
          `/api/workspace-access?league=${encodeURIComponent(leagueId)}`,
          {
            headers: session
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            cache: "no-store",
          },
        );
        const data = r.ok ? await r.json() : null;
        if (live && current === epoch) setAccess(data);
      } catch {}
    };
    void ensureLocalPreviewSession()
      .then(async (preview) => {
        interactive = Boolean(preview);
        resolved = true;
        if (preview) await update(null, true);
        else {
          const { data } = await client.auth.getSession();
          await update(data.session);
        }
      })
      .catch(() => {});
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (resolved && !interactive) void update(session);
    });
    return () => {
      live = false;
      ++epoch;
      subscription.unsubscribe();
    };
  }, [leagueId, preview]);
  if (header)
    return preview ? null : access?.canManage ? (
      <a href={access.dashboard}>Manage league ↗</a>
    ) : (
      <a href={signedIn ? "/" : "/?action=signin"}>
        {signedIn ? "Your leagues" : "Sign in"}
      </a>
    );
  return (
    <nav className="site-product-links" aria-label="Courtside AI product">
      <a
        href="/"
        target={preview ? "_blank" : undefined}
        rel={preview ? "noreferrer" : undefined}
      >
        Powered by Courtside AI
      </a>
      <a
        href="/?action=create"
        target={preview ? "_blank" : undefined}
        rel={preview ? "noreferrer" : undefined}
      >
        Create your own league ↗
      </a>
      {!preview && access?.canManage && (
        <a href={access.dashboard}>Manage league ↗</a>
      )}
    </nav>
  );
}
