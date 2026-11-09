import assert from "node:assert/strict";
import { nativeTestDatabase } from "./lib/native-test-database.mjs";
import { organizer } from "./lib/local-database.mjs";
import {
  createSafetyFixture,
  prepareActors,
  safetyActor,
} from "./lib/launchpad-safety-cases.mjs";
import { defaultSportRules } from "../src/lib/sports.ts";
const db = await nativeTestDatabase();
const begin = async (c) => {
  await c.query("begin");
  await c.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: safetyActor, role: "authenticated" }),
  ]);
  await c.query(
    "set local role authenticated;set local lock_timeout='10s';set local statement_timeout='15s'",
  );
};
const command = (c, l, revision, winPoints) =>
  c.query("select public.league_command($1,$2,$3::jsonb)", [
    l,
    "configure_sport",
    JSON.stringify({
      sport: "basketball",
      sportRules: { ...defaultSportRules(), winPoints },
      expected_sport_revision: revision,
    }),
  ]);
const state = async (c, l) =>
  (
    await c.query(
      "select to_jsonb(le) league,(select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_events a where league_id=le.id) audit,(select jsonb_agg(to_jsonb(od) order by od.id) from public.organizer_drafts od where league_id=le.id) drafts from public.leagues le where id=$1",
      [l],
    )
  ).rows;
try {
  await prepareActors(db);
  for (const winner of ["rules", "launchpad"]) {
    const f = await createSafetyFixture(db, `sports ${winner}`);
    const a = await db.pool.connect(),
      b = await db.pool.connect();
    try {
      await begin(a);
      if (winner === "rules") await command(a, f.league_id, 1, 3);
      else {
        const d = await organizer(a, "save_draft", {
          id: f.draft.id,
          revision: f.draft.revision,
          league_id: f.league_id,
          data: {
            ...f.draft.data,
            sportRules: { ...defaultSportRules(), winPoints: 3 },
          },
        });
        await organizer(a, "finish", { id: d.id, revision: d.revision });
      }
      await a.query("reset role");
      const expected = await state(a, f.league_id);
      const aid = (await a.query("select pg_backend_pid() id")).rows[0].id;
      await begin(b);
      const bid = (await b.query("select pg_backend_pid() id")).rows[0].id;
      const pending = (
        winner === "rules"
          ? organizer(b, "finish", {
              id: f.draft.id,
              revision: f.draft.revision,
            })
          : command(b, f.league_id, 1, 4)
      ).then(
        () => ({ ok: true }),
        (e) => ({ error: e }),
      );
      let waiting = false;
      const deadline = Date.now() + 7000;
      while (Date.now() < deadline) {
        const row = (
          await db.query(
            "select wait_event_type,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1",
            [bid],
          )
        ).rows[0];
        if (row?.wait_event_type === "Lock" && row.blockers.includes(aid)) {
          waiting = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.ok(
        waiting,
        "Losing writer genuinely waited for the authoritative league lock",
      );
      await a.query("commit");
      const result = await pending;
      assert.equal(result.error?.code, "PT409");
      await b.query("rollback");
      assert.deepEqual(
        await state(db, f.league_id),
        expected,
        "Rejected concurrent writer makes no partial changes",
      );
      console.log(
        `Concurrent sport rules: ${winner} wins; waiting stale writer rejects atomically with HTTP 409.`,
      );
    } finally {
      await a.query("rollback");
      await b.query("rollback");
      a.release();
      b.release();
    }
  }
} finally {
  await db.close();
}
