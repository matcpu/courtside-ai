"use client";

import { useState } from "react";
import {
  AtSign,
  ArrowUpRight,
  Check,
  Clipboard,
  ExternalLink,
  Globe2,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import type { Snapshot } from "@/lib/domain";
import { launchIdentity, launchSocialKit } from "@/lib/launchpad";
import "./launchpad-starter.css";

export function LaunchpadStarter({ snapshot }: { snapshot: Snapshot }) {
  const [feedback, setFeedback] = useState("");
  const { league, divisions, teams } = snapshot;
  const websitePath = `/league/${league.slug}/website`;
  const website = `https://courtside-ai-one.vercel.app${websitePath}`;
  const ideas = launchIdentity(league.name);
  const kit = launchSocialKit(
    league.name,
    league.season_name,
    divisions.map((d) => d.name),
    website,
  );
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(`${label} copied.`);
    } catch {
      setFeedback("Copying is unavailable in this browser. Select the text to copy it manually.");
    }
  };
  return (
    <div className="launchpad-starter">
      <section className="launchpad-intro">
        <div>
          <span className="launchpad-kicker">COURTSIDE LAUNCHPAD</span>
          <h2>Get your league ready for the world.</h2>
          <p>Your public website, starter identity and launch copy—connected to the league you already manage.</p>
        </div>
        <Globe2 size={62} strokeWidth={1.2} aria-hidden="true" />
      </section>

      <section className="launchpad-feature">
        <div className="launchpad-heading">
          <Globe2 size={24} />
          <div><h3>Your league website</h3><p>Live schedules and standings come from approved COURTSIDE records.</p></div>
        </div>
        <div className="launchpad-website-preview">
          <div><span className="launchpad-kicker">LEAGUE WEBSITE</span><h4>{league.name}</h4><p>{league.season_name} · {teams.filter(t => t.status === "approved").length} approved teams</p></div>
          <a href={websitePath} target="_blank" rel="noreferrer">Open website <ArrowUpRight size={16} /></a>
        </div>
        <p className="launchpad-hint"><ShieldCheck size={15} /> The website becomes accessible to others only when you enable public league access in Settings. No youth documents, private roster details or coach contacts appear.</p>
      </section>

      <div className="launchpad-two-up">
        <section className="launchpad-feature">
          <div className="launchpad-heading"><AtSign size={24} /><div><h3>Social name ideas</h3><p>Suggestions only. Instagram availability must be checked on the platform.</p></div></div>
          <div className="launchpad-picks">
            {ideas.handles.map((handle) => <div key={handle}><code>@{handle}</code><button type="button" onClick={() => void copy(handle, "Username")} aria-label={`Copy username ${handle}`}><Clipboard size={15}/></button></div>)}
          </div>
          <a href="https://www.instagram.com/accounts/edit/" target="_blank" rel="noreferrer" className="launchpad-text-link">Check inside Instagram <ExternalLink size={14}/></a>
        </section>
        <section className="launchpad-feature">
          <div className="launchpad-heading"><Globe2 size={24} /><div><h3>Domain ideas</h3><p>Suggested names, not availability or purchase confirmation.</p></div></div>
          <div className="launchpad-picks">
            {ideas.domains.map((domain) => <div key={domain}><code>{domain}</code><button type="button" onClick={() => void copy(domain, "Domain")} aria-label={`Copy domain ${domain}`}><Clipboard size={15}/></button></div>)}
          </div>
          <a href="https://lookup.icann.org/en" target="_blank" rel="noreferrer" className="launchpad-text-link">Check domain registration <ExternalLink size={14}/></a>
        </section>
      </div>

      <section className="launchpad-feature">
        <div className="launchpad-heading"><Megaphone size={24}/><div><h3>Your social launch kit</h3><p>Editable starting points generated from the league name and public season details. Review before posting.</p></div></div>
        <div className="launchpad-copy-card"><div><b>Instagram bio</b><p>{kit.bio}</p></div><button type="button" onClick={() => void copy(kit.bio, "Bio")}><Clipboard size={15}/> Copy</button></div>
        <div className="launchpad-posts">
          {kit.posts.map((post) => <article key={post.title}><b>{post.title}</b><p>{post.copy}</p><button type="button" onClick={() => void copy(post.copy, post.title)}><Clipboard size={15}/> Copy post</button></article>)}
        </div>
      </section>
      {feedback && <p className="launchpad-feedback" role="status"><Check size={16}/>{feedback}</p>}
      <p className="launchpad-disclosure">No Instagram account, domain or paid service has been created. These are editable templates; no Meta inference is used to generate them.</p>
    </div>
  );
}
