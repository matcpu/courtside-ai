import assert from "node:assert/strict";
import { policyChecks } from "./test-preseason-policy.mjs";
import { nativeTestDatabase } from "./lib/native-test-database.mjs";
import { assertTestSchema } from "./lib/assert-test-schema.mjs";
import { organizer } from "./lib/local-database.mjs";
import {
  assertConflict,
  createSafetyFixture,
  prepareActors,
  runSafety,
  safetyActor,
  safetyActor2,
  safetyCases,
  safetyState,
  sequentialSafetyChecks,
  writePreseason,
} from "./lib/launchpad-safety-cases.mjs";
const db = await nativeTestDatabase();
let checks = 0;
async function begin(client, actor) {
  await client.query("begin");
  await client.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: actor, role: "authenticated" }),
  ]);
  await client.query(
    "set local role authenticated; set local lock_timeout='10s'; set local statement_timeout='15s'",
  );
}
async function backendPid(client) {
  const id = (await client.query("select pg_backend_pid() pid")).rows[0].pid;
  return id;
}
async function waitForLock(pid, blocker) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const r = await db.query(
      "select wait_event_type,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1",
      [pid],
    );
    if (
      r.rows[0]?.wait_event_type === "Lock" &&
      r.rows[0].blockers.includes(blocker)
    )
      return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw Error(
    "Expected real cross-session PostgreSQL league-lock wait did not occur",
  );
}
try {
  checks += await assertTestSchema(db);
  await prepareActors(db);
  checks += await sequentialSafetyChecks(db);
  for (const [name, patch] of safetyCases) {
    const f = await createSafetyFixture(db, `concurrent ${name}`);
    const a = await db.pool.connect(),
      b = await db.pool.connect();
    try {
      const aid = await backendPid(a),
        bid = await backendPid(b);
      await begin(a, safetyActor2);
      await writePreseason(a, f, patch);
      await a.query("reset role");
      const expected = await safetyState(a, f.league_id);
      await begin(b, safetyActor);
      // Attach a rejection handler immediately; the blocked query must fail only
      // after A commits and the safety comparison reads the newly committed data.
      const finish = organizer(b, "finish", {
        id: f.draft.id,
        revision: f.draft.revision,
      }).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await waitForLock(bid, aid);
      checks++;
      await a.query("commit");
      const r = await finish;
      assert.ok(r.error, name);
      assertConflict(r.error);
      checks++;
      await b.query("rollback");
      assert.deepEqual(
        await safetyState(db, f.league_id),
        expected,
        `${name}: rejected waiter leaves no partial changes`,
      );
      checks++;
    } finally {
      await a.query("rollback");
      await b.query("rollback");
      a.release();
      b.release();
    }
  }
  // Reverse ordering: a valid finish commits first; the later Preseason writer
  // must wait, then remain authoritative. Retrying the completed finish cannot
  // replay its old values over that newer write.
  const f = await createSafetyFixture(db, "finish first");
  const a = await db.pool.connect(),
    b = await db.pool.connect();
  try {
    const aid = await backendPid(a),
      bid = await backendPid(b);
    await begin(a, safetyActor);
    await organizer(a, "finish", {
      id: f.draft.id,
      revision: f.draft.revision,
    });
    await begin(b, safetyActor2);
    const update = writePreseason(b, f, { min_roster: 7 });
    await waitForLock(bid, aid);
    checks++;
    await a.query("commit");
    await update;
    await b.query("commit");
    assert.equal(
      (await runSafety(db, "workspace", { league_id: f.league_id })).preseason
        .settings.min_roster,
      7,
    );
    checks++;
    await runSafety(db, "finish", {
      id: f.draft.id,
      revision: f.draft.revision,
    });
    assert.equal(
      (await runSafety(db, "workspace", { league_id: f.league_id })).preseason
        .settings.min_roster,
      7,
    );
    checks++;
  } finally {
    await a.query("rollback");
    await b.query("rollback");
    a.release();
    b.release();
  }
  // Capture must also wait behind an in-flight settings writer and bind to the
  // fresh values after that writer commits.
  const capture = await createSafetyFixture(db, "capture after wait");
  const c = await db.pool.connect(),
    d = await db.pool.connect();
  try {
    const cid = await backendPid(c),
      did = await backendPid(d);
    await begin(c, safetyActor2);
    await writePreseason(c, capture, { min_roster: 7 });
    await begin(d, safetyActor);
    const draft = organizer(d, "begin_edit", { league_id: capture.league_id });
    await waitForLock(did, cid);
    checks++;
    await c.query("commit");
    const fresh = await draft;
    await d.query("commit");
    assert.equal(fresh.data.minRoster, 7);
    assert.equal(fresh.base_safety.preseason.min_roster, 7);
    checks++;
    await runSafety(db, "finish", { id: fresh.id, revision: fresh.revision });
    checks++;
  } finally {
    await c.query("rollback");
    await d.query("rollback");
    c.release();
    d.release();
  }
  console.log(
    `Native proof-policy assertions passed: ${await policyChecks(db)}.`,
  );
  console.log(
    `Native PostgreSQL multi-session assertions passed: ${checks}. Actual lock waits observed; no hosted connection.`,
  );
} catch (e) {
  console.error(e.message, e.code ?? "", e.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
if (!process.exitCode) {
  const clean = await nativeTestDatabase();
  try {
    console.log(
      `Repeated native clean setup: ${await assertTestSchema(clean)} migration/RLS/permission assertions passed.`,
    );
  } finally {
    await clean.close();
  }
}
