"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck, Link as LinkIcon, Users } from "lucide-react";
import { Button } from "./ui/button";
import type { PreseasonData } from "@/lib/preseason";
import { verificationProgress } from "@/lib/verification-progress";

type Props = {
  league: string;
  team: PreseasonData["teams"][number];
  data: PreseasonData;
  busy: boolean;
  api: (path: string, options?: RequestInit) => Promise<any>;
  command: (action: string, payload: unknown) => Promise<any>;
  act: (fn: () => Promise<any>, message: string) => Promise<any>;
};
export function PreseasonRoster({
  league,
  team,
  data,
  busy,
  api,
  command,
  act,
}: Props) {
  const [invitation, setInvitation] = useState<{
    player: string;
    url: string;
    expires: string;
    email: string;
  } | null>(null);
  const [added, setAdded] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const roster = data.players.filter((p) => p.team_id === team.id && p.active);
  const readiness = data.readiness.find((r) => r.team_id === team.id);
  const minimum = Number(data.settings.min_roster),
    maximum = Number(data.settings.max_roster);
  const sizeValid = roster.length >= minimum && roster.length <= maximum;
  const deadlinePassed =
    data.role !== "admin" &&
    Date.now() > Date.parse(String(data.settings.roster_deadline));
  useEffect(() => {
    if (!added) return;
    const heading = document.getElementById(`player-${added}`);
    if (heading) {
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "center", behavior: "smooth" });
      setAdded("");
    }
  }, [added, data]);
  async function addPlayer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const element = e.currentTarget,
      f = new FormData(element);
    const result = await act(
      () =>
        api("/api/league", {
          method: "POST",
          body: JSON.stringify({
            league,
            action: "add_player",
            payload: {
              team_id: team.id,
              display_name: f.get("display_name"),
              jersey: f.get("jersey"),
              birth_date: f.get("birth_date"),
              guardian_consent: false,
            },
          }),
        }),
      "Player added. Invite their guardian from the player card below.",
    );
    if (result?.id) {
      element.reset();
      setAdded(result.id);
    }
  }
  return (
    <section
      className="panel preseason-section"
      id="preseason-roster"
      aria-labelledby="roster-heading"
    >
      <h2 id="roster-heading">Roster and guardian invitations</h2>
      <p>
        1. Add players. 2. Invite each guardian. 3. Submit the roster when it
        meets the size requirement. Guardians upload proof; only league
        administrators inspect and approve it.
      </p>
      <div className="verification-progress">
        <b>
          {team.name}: {roster.length} active player
          {roster.length === 1 ? "" : "s"} · required {minimum}–{maximum}
        </b>
        <p>
          {readiness?.verified ?? 0}/{roster.length} age verified · Roster{" "}
          {readiness?.roster_submitted ? "submitted" : "not submitted"}
        </p>
        {!data.settings.enabled ? (
          <p>
            Legacy season: document readiness is not enforced for scheduling.
            These players are not automatically document-verified.
          </p>
        ) : (
          <p>
            <b>
              {readiness?.eligible_for_scheduling
                ? "Ready to schedule"
                : "Scheduling blocked"}
            </b>
            {readiness?.blockers.length
              ? `: ${readiness.blockers.join(" · ")}`
              : ""}
          </p>
        )}
      </div>
      <form className="form-grid" onSubmit={addPlayer}>
        <h3>Step 1 · Add a player</h3>
        <div className="preseason-fields">
          <label className="field">
            <span>Player name (synthetic for demo)</span>
            <input name="display_name" required maxLength={100} />
          </label>
          <label className="field">
            <span>Jersey number</span>
            <input name="jersey" required maxLength={4} />
          </label>
          <label className="field">
            <span>Declared birth date</span>
            <input name="birth_date" type="date" required />
          </label>
        </div>
        <Button
          variant="secondary"
          disabled={
            busy ||
            (Boolean(data.settings.enabled) && deadlinePassed) ||
            (Boolean(data.settings.enabled) && roster.length >= maximum)
          }
        >
          <Users size={16} /> Add preseason player
        </Button>
      </form>
      <h3>Step 2 · Invite guardians and follow verification</h3>
      {!roster.length && (
        <p className="verification-empty">
          No players yet. Add your first player above; their guardian invitation
          and verification status will appear here.
        </p>
      )}
      <div className="preseason-roster">
        {roster.map((p) => {
          const activeInvitation = data.invitations.find(
            (i) =>
              i.player_id === p.id &&
              !i.revoked_at &&
              Date.parse(i.expires_at) > Date.now(),
          );
          const progress = verificationProgress(p, Boolean(activeInvitation));
          const canInvite =
            p.verification_status !== "approved" &&
            p.verification_status !== "pending";
          return (
            <article
              className="panel"
              key={p.id}
              aria-labelledby={`player-${p.id}`}
            >
              <div className="panel-heading">
                <div>
                  <h3 id={`player-${p.id}`} tabIndex={-1}>
                    #{p.jersey} {p.display_name}
                  </h3>
                  <p>
                    Declared DOB {p.birth_date} · Age {p.age} at cutoff
                  </p>
                </div>
                <span
                  className={`badge ${p.verification_status === "approved" ? "badge-green" : "badge-orange"}`}
                >
                  {progress.label}
                </span>
              </div>
              <p>{progress.next}</p>
              {!team.division_id ? (
                <p>
                  Age eligibility will be checked against the division after the
                  administrator approves placement.
                </p>
              ) : (
                !p.age_eligible && (
                  <p className="text-orange">
                    Outside current division age range; administrator approval
                    is blocked.
                  </p>
                )
              )}
              {p.duplicate_identity && (
                <p className="text-orange">
                  Possible duplicate roster identity. Administrator review
                  required.
                </p>
              )}
              {activeInvitation && (
                <p>
                  Invitation created · expires{" "}
                  {new Date(activeInvitation.expires_at).toLocaleString()}. Link
                  creation does not mean an email was delivered.
                </p>
              )}
              {canInvite && (
                <details
                  open={!activeInvitation}
                  className="guardian-invite-options"
                >
                  <summary>
                    {activeInvitation
                      ? "Manage or replace guardian invitation"
                      : "Guardian invitation options"}
                  </summary>
                  <form
                    className="form-grid"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const saved = await act(
                        () =>
                          command("invite_guardian", {
                            player_id: p.id,
                            email: f.get("guardian_email") || "",
                            send_email: f.get("send_email") === "on",
                          }),
                        "Private guardian invitation created. Copy it from this player’s card.",
                      );
                      if (saved) {
                        setInvitation({
                          player: p.id,
                          url: saved.invitationUrl,
                          expires: saved.expires_at,
                          email: saved.emailState,
                        });
                        setCopyMessage("");
                      }
                    }}
                  >
                    <p>
                      The guardian—not the coach—uploads proof through the
                      secure link. You do not need email delivery to share a
                      link privately.
                    </p>
                    <label className="field">
                      <span>
                        Guardian email for {p.display_name} (optional)
                      </span>
                      <input
                        name="guardian_email"
                        type="email"
                        placeholder="guardian@example.invalid"
                      />
                    </label>
                    <label className="checkbox-label">
                      <input name="send_email" type="checkbox" /> Send
                      invitation email if configured
                    </label>
                    <p className="form-note">
                      Email uses the league’s authorized sender and recipient
                      restrictions. A suppressed or failed email does not
                      prevent private link sharing.
                    </p>
                    {activeInvitation && (
                      <label className="checkbox-label">
                        <input type="checkbox" required /> I understand a
                        replacement revokes the previous link and guardian
                        sessions.
                      </label>
                    )}
                    <Button disabled={busy} variant="secondary" size="sm">
                      <LinkIcon size={14} />
                      {activeInvitation
                        ? "Create replacement guardian link"
                        : "Invite guardian to verify age"}
                    </Button>
                  </form>
                </details>
              )}
              {invitation?.player === p.id && (
                <div
                  className="preseason-invite"
                  role="region"
                  aria-label={`Private guardian link for ${p.display_name}`}
                >
                  <h4>Share this player’s private guardian link</h4>
                  <p>
                    Expires {new Date(invitation.expires).toLocaleString()}.
                    Email: {invitation.email.replaceAll("_", " ")}.{" "}
                    {invitation.email === "not_requested" &&
                      "Invitation not sent by email; copy and share it privately."}
                  </p>
                  <label className="field">
                    <span>New guardian invitation link</span>
                    <input
                      readOnly
                      value={invitation.url}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(invitation.url);
                        setCopyMessage("Private invitation link copied.");
                      } catch {
                        setCopyMessage(
                          "Select the private link above and copy it directly.",
                        );
                      }
                    }}
                  >
                    Copy private invitation link
                  </Button>
                  {copyMessage && <p role="status">{copyMessage}</p>}
                  <p>
                    Copy before leaving this page. Only a hash is stored, so a
                    lost link must be replaced. Share only with this player’s
                    expected guardian.
                  </p>
                </div>
              )}
              <div className="inline-actions">
                {activeInvitation && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await command("revoke_invitation", {
                          invitation_id: activeInvitation.id,
                        });
                        if (invitation?.player === p.id) setInvitation(null);
                      }, "Invitation revoked. Existing sessions can no longer access it.")
                    }
                  >
                    Revoke invitation
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => command("withdraw_player", { player_id: p.id }),
                      "Player withdrawn from the active roster; submit the roster again.",
                    )
                  }
                >
                  Withdraw from roster
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <h3>Step 3 · Submit the roster</h3>
      <p>
        Roster submission records your active player list. It does not approve
        ages; guardian uploads and administrator decisions can follow afterward.
      </p>
      {!sizeValid && (
        <p className="text-orange">
          {roster.length < minimum
            ? `Add ${minimum - roster.length} more player(s) to meet the minimum of ${minimum}. You can invite guardians now.`
            : `Withdraw players to meet the maximum of ${maximum}.`}
        </p>
      )}
      {deadlinePassed && (
        <p className="text-orange">
          The roster deadline has passed. Contact the league administrator.
        </p>
      )}
      <Button
        disabled={busy || !sizeValid || deadlinePassed}
        onClick={() =>
          void act(
            () => command("submit_roster", { team_id: team.id }),
            "Roster submitted. Scheduling stays blocked until every active player is approved.",
          )
        }
      >
        <ClipboardCheck size={16} /> Submit roster for preseason review
      </Button>
    </section>
  );
}
