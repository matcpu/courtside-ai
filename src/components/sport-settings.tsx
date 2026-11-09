"use client";
import { useState } from "react";
import type { Snapshot } from "@/lib/domain";
import { leagueSport } from "@/lib/sports";
import { SportRulesFields } from "./sport-rules-fields";
import { Button } from "./ui/button";
export function SportSettings({
  league,
  locked,
  save,
}: {
  league: Snapshot["league"];
  locked: boolean;
  save: (payload: unknown) => Promise<unknown>;
}) {
  const initial = leagueSport(league);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <section className="panel">
      <h2>Sport & standings</h2>
      {locked && (
        <p>
          Rules are locked because this league has published schedules or
          confirmed results. Copy the season to change the competition policy.
        </p>
      )}
      <SportRulesFields
        sport={value.sport}
        rules={value.rules}
        disabled={locked || saving}
        onChange={(sport, rules) => setValue({ ...value, sport, rules })}
      />
      <Button
        disabled={locked || saving}
        onClick={async () => {
          setSaving(true);
          try {
            await save({
              sport: value.sport,
              sportRules: value.rules,
              expected_sport_revision: league.sport_revision ?? 1,
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        Save competition rules
      </Button>
    </section>
  );
}
