import { chromium, expect, devices } from "@playwright/test";
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// A local review artifact, never an upload or a new model run. Preparation is
// offline. Capture is deliberately explicit and logs no account/capability data.
const directory = ".local/review-demo";
mkdirSync(directory, { recursive: true });
const scenes = [
  {
    id: "public",
    start: 0,
    end: 8,
    chapter: "A working public demonstration",
    authority: "PUBLIC ACCESS",
    caption:
      "Explore without signup. All demonstration teams and people are fictional.",
    narration:
      "Explore COURTSIDE AI without signup. The working public demonstration uses fictional teams and people.",
  },
  {
    id: "preseason",
    start: 8,
    end: 18,
    chapter: "One connected preseason journey",
    authority: "DETERMINISTIC + HUMAN",
    caption:
      "Private upcoming season: assessment, guardian proof and scheduling readiness.",
    narration:
      "In a separate private upcoming season, coaches submit assessments and rosters. Guardian consent, age rules and human verification determine scheduling readiness.",
  },
  {
    id: "questionnaire",
    start: 18,
    end: 30,
    chapter: "Interpret uncertain team evidence",
    authority: "COACH INPUT",
    caption:
      "No recorded games, strong continuity claims and complete placement confidence.",
    narration:
      "This questionnaire reports no previous games, ninety percent returning players, zero years together, and complete confidence in a top division. Those claims need context.",
  },
  {
    id: "placement",
    start: 30,
    end: 45,
    chapter: "Actual Muse Spark interpretation",
    authority: "META INTERPRETATION",
    caption:
      "Saved provider response. Specific contradictions and clarification questions; the independent rubric and human approval remain separate.",
    narration:
      "Muse Spark identifies those concrete inconsistencies and asks useful clarification questions. This is its saved structured response and provider identifier. The deterministic rubric remains independent, and an administrator owns placement approval.",
  },
  {
    id: "guardian",
    start: 45,
    end: 52,
    chapter: "Private, mobile guardian verification",
    authority: "SYNTHETIC GUARDIAN",
    caption:
      "Expiring one-player invitation; token removed before capture. Synthetic proof awaits human review.",
    narration:
      "A private invitation accepts synthetic proof and consent. Its token is removed before capture.",
  },
  {
    id: "screening",
    start: 52,
    end: 60,
    chapter: "Warnings support a human reviewer",
    authority: "LOCAL CHECKS + HUMAN",
    caption:
      "Local consistency, age and duplicate checks. No specific issue never means authentic; no real identity document goes to Meta.",
    narration:
      "Local consistency, age and duplicate checks support the reviewer. Screening cannot certify authenticity, and real identity documents never go to Meta.",
  },
  {
    id: "scoresheet",
    start: 60,
    end: 80,
    chapter: "Multimodal recognition from the original image",
    authority: "META VISION + HUMAN RESULT",
    caption:
      "Eastside Eagles 78–43 Riverside Ravens. No individual statistics were recorded. The owner confirmed this result through normal review.",
    narration:
      "In the private historical season, Muse Spark read this actual synthetic scoresheet: Eastside Eagles, seventy eight; Riverside Ravens, forty three. It did not invent unrecorded player statistics. The owner then explicitly confirmed the result through the normal review screen, updating standings and ratings.",
  },
  {
    id: "vision",
    start: 80,
    end: 92,
    chapter: "Provider evidence stays inspectable",
    authority: "ACTUAL SAVED RESPONSE",
    caption:
      "Model, response ID, structured extraction and request digest are retained. This is a timestamped result, not a new recording-time call.",
    narration:
      "The saved receipt links the model, provider response identifier, structured extraction and request digest. We are reviewing a timestamped response, not making another model call for this recording.",
  },
  {
    id: "agent-tools",
    start: 92,
    end: 117,
    chapter: "The model selects useful tools",
    authority: "META TOOL SELECTION",
    caption:
      "Five genuine selected tools: inspect league → history and readiness → propose balance → draft schedule. Actual outcomes remain visible.",
    narration:
      "The operations agent selected its own tools. It inspected the league, investigated Eastside's verified game history, and checked preseason readiness. It then invoked the deterministic balance and scheduling tools. The actual calls, arguments and outcomes produced saved proposals and a feasible draft. The model had no tool for approving a move or publishing a schedule.",
  },
  {
    id: "agent-records",
    start: 117,
    end: 137,
    chapter: "Trust saved records, inspect model mistakes",
    authority: "DETERMINISTIC RECORD CHECK",
    caption:
      "The model misnamed one team in its prose. The unchanged response is flagged beside canonical Riverside Ravens and Eastside Eagles action receipts.",
    narration:
      "Muse Spark made a real mistake: its prose called Riverside, Parkdale. The original answer remains unchanged. A deterministic warning identifies the mismatch, while saved proposal identifiers resolve to Riverside Ravens and Eastside Eagles. Inspectable actions make the difference.",
  },
  {
    id: "recovery",
    start: 137,
    end: 145,
    chapter: "A recorded failure, followed by recovery",
    authority: "SEPARATE SYNTHETIC RECOVERY RUN",
    caption:
      "Rejected lookup → verified investigation → saved actions. Separate synthetic run; approvals remain pending. This does not claim every failure recovers.",
    narration:
      "A separate synthetic run recovered from a rejected lookup using verified league information. Saved actions still required approval.",
  },
  {
    id: "approved",
    start: 145,
    end: 153,
    chapter: "Human decisions remain accountable",
    authority: "OWNER APPROVED MOVES",
    caption:
      "The owner approved both synthetic division moves through normal administrator controls.",
    narration:
      "The owner reviewed the evidence and approved both synthetic moves. Saved records preserve those human decisions.",
  },
  {
    id: "draft",
    start: 153,
    end: 163,
    chapter: "A feasible revision, ready for review",
    authority: "DETERMINISTIC DRAFT · NOT PUBLISHED",
    caption:
      "Version 3: five new games, nineteen completed fixtures retained. Two byes. Main-season publication remains pending review.",
    narration:
      "A deterministic revision now fits five games and retains nineteen completed fixtures. Two teams have byes. Version three remains a draft awaiting publication review.",
  },
  {
    id: "notifications",
    start: 163,
    end: 168,
    chapter: "Coaches receive in-app updates",
    authority: "SEPARATE SYNTHETIC PUBLICATION",
    caption:
      "An existing test publication's real coach inbox. This is not a claim that version 3 was published.",
    narration:
      "This earlier synthetic publication delivered an update. Version three remains unpublished.",
  },
  {
    id: "close",
    start: 168,
    end: 180,
    chapter: "Inspectable work, accountable decisions",
    authority: "PRIVATE REVIEW CANDIDATE",
    caption:
      "Genuine Meta responses. Deterministic constraints. Human approval. Final video publication and hackathon submission await owner approval.",
    narration:
      "Genuine Meta interpretation, vision and tool use prepare inspectable league work. Deterministic rules and human decisions remain in control. This local draft awaits final owner review.",
  },
];
assert.equal(scenes.at(-1).end, 180);
for (let i = 1; i < scenes.length; i++)
  assert.equal(scenes[i].start, scenes[i - 1].end);
writeFileSync(
  join(directory, "captions.json"),
  JSON.stringify(
    {
      totalSeconds: 180,
      resolution: "1920x1080",
      source:
        "Actual application screenshots and saved provider responses; narrated local review composition",
      scenes,
    },
    null,
    2,
  ),
);
writeFileSync(
  join(directory, "narration.txt"),
  scenes
    .map((s) => `${s.start}–${s.end} ${s.chapter}\n${s.narration}`)
    .join("\n\n"),
);

async function capture() {
  assert.ok(
    process.argv.includes("--capture-approved-deployment"),
    "Wait until the parent has verified the new production deployment Ready, then explicitly opt into capture",
  );
  const { actor, origin, publicFingerprint, assertPrivate } =
    await import("./lib/readiness.mjs");
  assert.equal(origin, "https://courtside-ai-one.vercel.app");
  assert.equal(
    (await (await fetch(origin + "/api/health")).json()).meta,
    false,
    "Capture requires paused inference",
  );
  const fixture = JSON.parse(readFileSync(".local/demo-manifest.json"));
  assert.equal(fixture.synthetic, true);
  const admin = await actor(fixture.accounts.admin),
    baseline = await publicFingerprint();
  assert.deepEqual(baseline, fixture.publicReference);
  const before = await assertPrivate(admin, fixture.operations.league);
  const config = existsSync(".local/review-demo-config.json")
    ? JSON.parse(readFileSync(".local/review-demo-config.json"))
    : {};
  const evidence = await admin.api(
    `/api/evidence?league=${fixture.operations.league}`,
  );
  const originalOps = evidence.evidence.filter(
    (e) =>
      e.feature === "operations" &&
      e.object_id === "af0b2cf7-43c8-40f2-91f5-38c1d2f02a25",
  );
  assert.ok(
    originalOps.length >= 5,
    "The actual original run must remain inspectable",
  );
  const finalOps = originalOps.find(
    (e) => e.response_id === "resp_6ae2bedc8c80d9be196847f9",
  );
  assert.ok(finalOps);
  const screenshots = {},
    sources = {},
    sensitive = [
      fixture.accounts.admin.password,
      fixture.accounts.coach.password,
      fixture.preseason.invitationUrl,
      new URL(fixture.preseason.invitationUrl).hash.slice(1),
    ];
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const contexts = [];
  async function newPage(options = {}) {
    const c = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      timezoneId: "America/Toronto",
      ...options,
    });
    contexts.push(c);
    const p = await c.newPage();
    p.setDefaultTimeout(20000);
    return p;
  }
  async function login(page, account) {
    await page.goto(origin);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Email address").fill(account.email);
    await d
      .getByLabel("Password", { exact: true })
      .fill(account.password)
      .catch(() => {
        throw Error("Private login entry failed; credential redacted");
      });
    await d.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(d).toHaveCount(0);
  }
  async function nav(page, view) {
    await page.getByRole("button", { name: view, exact: true }).click();
  }
  async function snapshot(id, page, focus, metadata) {
    assert.equal(
      await page.locator('input[type="password"]:visible').count(),
      0,
    );
    assert.equal(
      new URL(page.url()).hash,
      "",
      "Do not capture guardian capability fragments",
    );
    if (focus) await focus.scrollIntoViewIfNeeded();
    const path = join(directory, `${id}.png`);
    if (metadata?.actualUiElementCrop) {
      assert.ok(
        focus,
        "An actual element locator is required for an element crop",
      );
      await focus.screenshot({ path, animations: "disabled" });
    } else await page.screenshot({ path, animations: "disabled" });
    screenshots[id] = path.replaceAll("\\", "/");
    sources[id] = { capturedAt: new Date().toISOString(), ...metadata };
  }
  async function receipt(page, responseId) {
    const details = page
      .locator(".history-list > details")
      .filter({ has: page.locator("code").filter({ hasText: responseId }) });
    // Receipt content is initially collapsed, so locate it by original provider
    // order through the read-only API if its hidden code is not in the DOM query.
    await expect(details).toHaveCount(1);
    await details.locator(":scope > summary").click();
    return details;
  }
  try {
    const publicPage = await newPage();
    await publicPage.goto(origin + "/league/northstar-demo");
    await expect(
      publicPage.getByText("12 approved for competition"),
    ).toBeVisible();
    await snapshot("public", publicPage, null, {
      signedOut: true,
      publicReference: true,
    });
    const coach = await newPage();
    await login(coach, fixture.accounts.coach);
    await coach
      .getByLabel("Switch league")
      .selectOption(fixture.preseason.league);
    await nav(coach, "Preseason Onboarding");
    await expect(
      coach.getByRole("heading", {
        name: "Coach assessment and placement",
        exact: true,
      }),
    ).toBeVisible();
    await snapshot("preseason", coach, null, {
      role: "coach",
      season: "upcoming-private",
    });
    await coach
      .getByLabel("Preseason team", { exact: true })
      .selectOption(fixture.preseason.team);
    await expect(coach.getByLabel("Previous season wins")).toHaveValue("0");
    await snapshot(
      "questionnaire",
      coach,
      coach.getByLabel("Typical winning margin"),
      { role: "coach", submitted: true },
    );
    const adminPage = await newPage();
    await login(adminPage, fixture.accounts.admin);
    await adminPage
      .getByLabel("Switch league")
      .selectOption(fixture.preseason.league);
    await nav(adminPage, "Meta AI activity");
    const placementDetails = await receipt(
      adminPage,
      "resp_6ae2aaf0f442588ab0f040a6",
    );
    await snapshot("placement", adminPage, placementDetails, {
      responseId: "resp_6ae2aaf0f442588ab0f040a6",
      inferenceMadeDuringCapture: false,
    });
    const actualPlacementReview = coach
      .locator(".preseason-meta")
      .filter({
        has: coach.getByRole("heading", {
          name: "Muse Spark placement review",
          exact: true,
        }),
      });
    await expect(
      actualPlacementReview.getByText(
        "Meta suggested tier 2 · model confidence 20%",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      actualPlacementReview.getByText(
        "How is 90% returning defined for a new team with 0 years together and no prior division?",
        { exact: true },
      ),
    ).toBeVisible();
    await snapshot("placement-questions", coach, actualPlacementReview, {
      actualUiElementCrop: true,
      actualSavedModelInterpretation: true,
      responseId: "resp_6ae2aaf0f442588ab0f040a6",
      inferenceMadeDuringCapture: false,
    });
    screenshots.placement = [
      screenshots.placement,
      screenshots["placement-questions"],
    ];
    const guardian = await newPage({
      ...devices["iPhone 13"],
      viewport: { width: 390, height: 844 },
    });
    await guardian.goto(fixture.preseason.invitationUrl).catch(() => {
      throw Error("Guardian invitation did not open; capability redacted");
    });
    await expect(
      guardian.getByRole("heading", {
        name: "Fictional Demo Player",
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(new URL(guardian.url()).hash, "");
    let guardianSubmitted = false;
    if (
      process.argv.includes("--complete-synthetic-guardian") &&
      (await guardian
        .getByText("Verification: invited", { exact: true })
        .count())
    ) {
      await guardian
        .getByLabel("Guardian full name", { exact: true })
        .fill("Fictional Demo Guardian");
      await guardian
        .getByLabel("Proof of age photo", { exact: true })
        .setInputFiles(".local/demo-guardian-proof.png");
      await guardian
        .getByRole("checkbox", { name: /I confirm the recorded name/ })
        .check();
      await guardian
        .getByRole("checkbox", { name: /I am the parent or legal guardian/ })
        .check();
      await guardian
        .getByRole("button", {
          name: "Submit proof and guardian consent",
          exact: true,
        })
        .click();
      await expect(
        guardian.getByText("Verification: pending", { exact: true }),
      ).toBeVisible({ timeout: 45000 });
      guardianSubmitted = true;
      writeFileSync(
        join(directory, "guardian-setup-history.json"),
        JSON.stringify(
          {
            synthetic: true,
            earlierAuthorizedSetupSubmitted: true,
            submissionObservedAt: new Date().toISOString(),
            verificationStatus: "pending",
            humanVerificationApproved: false,
            evidence:
              "Normal mobile guardian UI accepted the explicitly authorized synthetic proof and consent; this is an observation time, not a claimed database insertion timestamp.",
          },
          null,
          2,
        ),
      );
    }
    await snapshot(
      "guardian",
      guardian,
      guardian.getByRole("heading", {
        name: "Fictional Demo Player",
        exact: true,
      }),
      {
        synthetic: true,
        capabilityFragmentRemoved: true,
        submittedDuringAuthorizedSyntheticSetup: guardianSubmitted,
        humanVerificationApproved: false,
      },
    );
    await adminPage
      .getByLabel("Switch league")
      .selectOption(config.proofLeague ?? fixture.preseason.league);
    await nav(adminPage, "Preseason Onboarding");
    const proof = adminPage
      .locator(".preseason-review")
      .filter({ hasText: config.proofPlayerName ?? "Fictional Demo Player" })
      .first();
    await expect(proof).toBeVisible();
    await proof
      .getByRole("button", { name: "Inspect screening findings", exact: true })
      .click();
    await expect(
      proof.getByText(/Authenticity remains unverified/),
    ).toBeVisible();
    await snapshot("screening", adminPage, proof, {
      role: "admin",
      syntheticOnly: true,
      verificationRemainsPending: true,
    });
    await adminPage
      .getByLabel("Switch league")
      .selectOption(fixture.operations.league);
    await nav(adminPage, "Scoresheets");
    const card = adminPage
      .locator(".sheet-card")
      .filter({ hasText: "Eastside Eagles vs Riverside Ravens" });
    await card.getByRole("button", { name: "Review", exact: true }).click();
    const review = adminPage.getByRole("dialog", { name: "Review scoresheet" });
    await expect(review).toBeVisible();
    await expect
      .poll(() =>
        review
          .getByAltText("Private uploaded scoresheet for review")
          .evaluate((img) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(review.getByLabel("Home final score")).toHaveValue("78");
    await expect(review.getByLabel("Away final score")).toHaveValue("43");
    await snapshot("scoresheet", adminPage, review, {
      role: "admin",
      originalImage: true,
      ownerAlreadyConfirmed: true,
    });
    await review
      .getByRole("button", { name: "Close review", exact: true })
      .click();
    await nav(adminPage, "Meta AI activity");
    const visionDetails = await receipt(
      adminPage,
      "resp_6ae2aaf57943f7b1407c4f16",
    );
    await snapshot("vision", adminPage, visionDetails, {
      responseId: "resp_6ae2aaf57943f7b1407c4f16",
      inferenceMadeDuringCapture: false,
    });
    await visionDetails.locator(":scope > summary").click();
    const toolShots = [];
    for (const [i, responseId] of [
      "resp_6ae2bece5b25df23cd854120",
      "resp_6ae2bed2acfa254725294b9d",
      "resp_6ae2bed5435431a196ae4d73",
      "resp_6ae2bed76a45d123cc664ef1",
    ].entries()) {
      const detail = await receipt(adminPage, responseId);
      const id = `agent-tools-${i}`;
      await snapshot(id, adminPage, detail.locator("pre").first(), {
        responseId,
        actualToolEvidence: true,
      });
      toolShots.push(screenshots[id]);
      await detail.locator(":scope > summary").click();
    }
    screenshots["agent-tools"] = toolShots;
    const operationDetails = await receipt(adminPage, finalOps.response_id);
    const verifiedActions = operationDetails.getByRole("region", {
      name: "Verified agent action receipts",
    });
    await expect(
      verifiedActions.getByText(/saved proposal belongs to Riverside Ravens/),
    ).toBeVisible();
    await snapshot("agent-records", adminPage, verifiedActions, {
      responseId: finalOps.response_id,
      modelNarrativeUnchanged: true,
      deterministicNameCheck: true,
    });
    await expect(
      verifiedActions.getByText(/Current record: approved/).first(),
    ).toBeVisible();
    await snapshot(
      "approved",
      adminPage,
      verifiedActions.getByText("Riverside Ravens", { exact: true }).first(),
      {
        ownerDecision: "Approve both synthetic moves",
        actualSavedStatus: "approved",
      },
    );
    const recoveryFixture = JSON.parse(
      readFileSync(".local/meta-recovery-fixture-v2.json"),
    );
    assert.equal(recoveryFixture.synthetic, true);
    assert.equal(
      recoveryFixture.league,
      "68513fb6-10fa-49a8-8154-bd71591106d4",
    );
    sensitive.push(recoveryFixture.account.password);
    const recoveryActor = await actor(recoveryFixture.account);
    const recoveryEvidence = (
      await recoveryActor.api(`/api/evidence?league=${recoveryFixture.league}`)
    ).evidence.filter(
      (e) => e.object_id === "8c83cd8e-4d64-4810-a664-429bd6d5380e",
    );
    const failedLookup = recoveryEvidence.find((e) =>
      e.tool_calls.some((t) => t.outcome?.error),
    );
    assert.ok(
      failedLookup,
      "The actual rejected lookup must remain inspectable",
    );
    const recoveryPage = await newPage();
    await login(recoveryPage, recoveryFixture.account);
    await recoveryPage
      .getByLabel("Switch league")
      .selectOption(recoveryFixture.league);
    await nav(recoveryPage, "Meta AI activity");
    const recoveryShots = [];
    for (const [index, responseId] of [
      failedLookup.response_id,
      "resp_6ae2c87c1edd741d27984a3f",
      "resp_6ae2c882b9cb8abb77fc40ef",
    ].entries()) {
      const detail = await receipt(recoveryPage, responseId);
      const id = `recovery-${index}`;
      const focus = detail.locator("pre").nth(index === 0 ? 1 : 0);
      await snapshot(id, recoveryPage, focus, {
        responseId,
        separateSyntheticRecoveryRun: true,
        inferenceMadeDuringCapture: false,
      });
      recoveryShots.push(screenshots[id]);
      await detail.locator(":scope > summary").click();
    }
    screenshots.recovery = recoveryShots;
    await operationDetails.locator(":scope > summary").click();
    await nav(adminPage, "Schedule");
    const v3 = adminPage.locator("section.panel").filter({
      has: adminPage.getByRole("heading", {
        name: "Draft schedule · version 3",
        exact: true,
      }),
    });
    await expect(v3).toBeVisible();
    await snapshot(
      "draft-top",
      adminPage,
      v3.getByRole("heading", {
        name: "Draft schedule · version 3",
        exact: true,
      }),
      {
        version: 3,
        status: "draft",
        publishedDuringCapture: false,
      },
    );
    await snapshot("draft", adminPage, v3, {
      version: 3,
      status: "draft",
      publishedDuringCapture: false,
    });
    screenshots.draft = [screenshots["draft-top"], screenshots.draft];
    let notificationAccount = fixture.accounts.coach,
      notificationLeague = fixture.operations.league,
      notificationState = await (
        await actor(notificationAccount)
      ).api(`/api/league?id=${notificationLeague}`);
    if (!notificationState.notifications.some((n) => n.channel === "in_app")) {
      const audit = JSON.parse(readFileSync(".local/live-audit.json"));
      notificationAccount =
        audit.accounts[config.notificationAccountKey ?? "coach"];
      sensitive.push(notificationAccount.password);
      const tester = await actor(notificationAccount);
      const choices = await tester.api("/api/league");
      notificationLeague = config.notificationLeague;
      for (const choice of notificationLeague
        ? choices.filter((l) => l.id === notificationLeague)
        : choices.slice().reverse()) {
        const candidate = await tester.api(`/api/league?id=${choice.id}`);
        if (
          candidate.role === "coach" &&
          candidate.notifications.some((n) => n.channel === "in_app")
        ) {
          notificationState = candidate;
          notificationLeague = choice.id;
          break;
        }
      }
    }
    assert.ok(
      notificationLeague &&
        notificationState.notifications.some((n) => n.channel === "in_app"),
      "An existing synthetic coach publication notification is required; no publication is performed by capture",
    );
    const notificationPage = await newPage();
    await login(notificationPage, notificationAccount);
    await notificationPage
      .getByLabel("Switch league")
      .selectOption(notificationLeague);
    await nav(notificationPage, "Notifications");
    await expect(
      notificationPage.getByRole("heading", {
        name: "Your team updates",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      notificationPage
        .getByText(
          notificationState.notifications.find((n) => n.channel === "in_app")
            .subject,
          { exact: true },
        )
        .first(),
    ).toBeVisible();
    await expect(
      notificationPage
        .getByRole("button", { name: "View schedule", exact: true })
        .first(),
    ).toBeVisible();
    await snapshot("notifications", notificationPage, null, {
      actualInAppNotification: true,
      separateExistingPublication:
        notificationLeague !== fixture.operations.league,
      mainVersion3Published: false,
    });
    await nav(adminPage, "Schedule");
    await snapshot(
      "close",
      adminPage,
      v3.getByRole("heading", {
        name: "Draft schedule · version 3",
        exact: true,
      }),
      {
        currentDraft: 3,
        ownerPublicationReviewPending: true,
        allScreensFromActualApplication: true,
      },
    );
    const after = await assertPrivate(admin, fixture.operations.league);
    const official = (s) => ({
      revision: s.league.revision,
      dataRevision: s.league.data_revision,
      games: s.games
        .map((g) => [g.id, g.status, g.home_score, g.away_score])
        .sort((a, b) => a[0].localeCompare(b[0])),
      teams: s.teams
        .map((t) => [t.id, t.division_id])
        .sort((a, b) => a[0].localeCompare(b[0])),
      versions: s.versions
        .map((v) => [v.id, v.status])
        .sort((a, b) => a[0].localeCompare(b[0])),
    });
    assert.deepEqual(
      official(after),
      official(before),
      "Capture cannot change official operations state",
    );
    assert.deepEqual(await publicFingerprint(), baseline);
    const guardianHistory = existsSync(
      join(directory, "guardian-setup-history.json"),
    )
      ? JSON.parse(readFileSync(join(directory, "guardian-setup-history.json")))
      : null;
    const result = {
      capturedAt: new Date().toISOString(),
      origin,
      sourceCommit:
        process.argv
          .find((a) => a.startsWith("--source-commit="))
          ?.split("=")[1] ?? "verified by parent deployment check",
      source:
        "Actual read-only application screenshots; one explicitly authorized synthetic guardian setup submission if requested",
      screenshots,
      sources,
      currentCaptureSubmitted: guardianSubmitted,
      earlierAuthorizedSetupSubmitted: Boolean(
        guardianHistory?.earlierAuthorizedSetupSubmitted,
      ),
      guardianSubmittedDuringAuthorizedSetup:
        guardianSubmitted ||
        Boolean(guardianHistory?.earlierAuthorizedSetupSubmitted),
      guardianSetupHistory: guardianHistory
        ? join(directory, "guardian-setup-history.json").replaceAll("\\", "/")
        : null,
      modelCalls: 0,
      emailSends: 0,
      mainSchedulePublication: false,
      publicReferenceUnchanged: true,
      totalSeconds: 180,
    };
    writeFileSync(
      join(directory, "capture-manifest.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(
      "Captured actual public/private review screens. No model calls, email or schedule publication. Private capture manifest saved.",
    );
  } catch (error) {
    let message = String(error.message);
    for (const value of sensitive.filter(Boolean))
      message = message.replaceAll(value, "[redacted]");
    throw Error(message);
  } finally {
    for (const c of contexts) await c.close();
    await browser.close();
  }
}

function waveDuration(bytes) {
  let at = 12,
    byteRate = 0,
    length = 0;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString("ascii", at, at + 4),
      size = bytes.readUInt32LE(at + 4);
    if (id === "fmt ") byteRate = bytes.readUInt32LE(at + 16);
    if (id === "data") length = size;
    at += 8 + size + (size % 2);
  }
  assert.ok(byteRate && length, "Expected a local PCM narration WAV");
  return length / byteRate;
}
async function render() {
  const captureManifest = JSON.parse(
    readFileSync(join(directory, "capture-manifest.json")),
  );
  const speechScript = join(directory, "synthesize.ps1");
  writeFileSync(
    speechScript,
    `param([string]$TextPath,[string]$WavePath,[int]$Rate=1)\nAdd-Type -AssemblyName System.Speech\n$voice=New-Object System.Speech.Synthesis.SpeechSynthesizer\ntry { $voice.SelectVoice('Microsoft David Desktop'); $voice.Rate=$Rate; $voice.SetOutputToWaveFile($WavePath); $voice.Speak([System.IO.File]::ReadAllText($TextPath)); } finally { $voice.Dispose(); }\n`,
  );
  const wavs = [];
  const previousReport = existsSync(join(directory, "render-report.json"))
    ? JSON.parse(readFileSync(join(directory, "render-report.json")))
    : null;
  for (const scene of scenes) {
    const textPath = join(directory, `${scene.id}.txt`),
      wavePath = join(directory, `${scene.id}.wav`);
    if (
      existsSync(textPath) &&
      existsSync(wavePath) &&
      readFileSync(textPath, "utf8") === scene.narration
    ) {
      const previousBytes = readFileSync(wavePath),
        previousDuration = waveDuration(previousBytes);
      if (
        previousDuration <
        scene.end - scene.start - (scene.id === "close" ? 0.75 : 0.25)
      ) {
        wavs.push({
          id: scene.id,
          duration: previousDuration,
          rate:
            previousReport?.narrationSegments.find((s) => s.id === scene.id)
              ?.rate ?? "previous local offline synthesis",
          reusedVerifiedOfflineNarration: true,
          data: previousBytes.toString("base64"),
        });
        continue;
      }
    }
    writeFileSync(textPath, scene.narration);
    let bytes, duration, rate;
    for (rate = 1; rate <= 3; rate++) {
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          resolve(speechScript),
          "-TextPath",
          resolve(textPath),
          "-WavePath",
          resolve(wavePath),
          "-Rate",
          String(rate),
        ],
        { encoding: "utf8", windowsHide: true },
      );
      assert.equal(result.status, 0, "Offline narration synthesis failed");
      bytes = readFileSync(wavePath);
      duration = waveDuration(bytes);
      if (
        duration <
        scene.end - scene.start - (scene.id === "close" ? 0.75 : 0.25)
      )
        break;
    }
    assert.ok(
      duration < scene.end - scene.start - (scene.id === "close" ? 0.75 : 0.25),
      `Narration exceeds scene ${scene.id}: ${duration.toFixed(1)} seconds`,
    );
    wavs.push({ id: scene.id, duration, rate, data: bytes.toString("base64") });
  }
  const images = {};
  for (const [id, files] of Object.entries(captureManifest.screenshots))
    images[id] = (Array.isArray(files) ? files : [files]).map(
      (path) =>
        "data:image/png;base64," + readFileSync(path).toString("base64"),
    );
  const videoPath = join(directory, "courtside-ai-review-draft.webm");
  writeFileSync(videoPath, "");
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
    ],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      offline: true,
    });
    const page = await context.newPage();
    await page.exposeFunction("saveReviewChunk", (value) =>
      appendFileSync(videoPath, Buffer.from(value, "base64")),
    );
    await page.setContent(
      '<html><body style="margin:0;background:#102e28"><canvas id="film" width="1920" height="1080"></canvas></body></html>',
    );
    const rendered = await page.evaluate(
      async ({ scenes, images, wavs }) => {
        const canvas = document.getElementById("film"),
          ctx = canvas.getContext("2d");
        const loaded = {};
        for (const [id, values] of Object.entries(images)) {
          loaded[id] = [];
          for (const url of values) {
            const img = new Image();
            img.src = url;
            await img.decode();
            loaded[id].push(img);
          }
        }
        const audio = new AudioContext(),
          destination = audio.createMediaStreamDestination(),
          buffers = {};
        for (const wav of wavs) {
          const binary = atob(wav.data),
            bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          buffers[wav.id] = await audio.decodeAudioData(bytes.buffer);
        }
        await audio.resume();
        const stream = canvas.captureStream(30);
        for (const track of destination.stream.getAudioTracks())
          stream.addTrack(track);
        const preferred = "video/webm;codecs=vp9,opus",
          mime = MediaRecorder.isTypeSupported(preferred)
            ? preferred
            : "video/webm;codecs=vp8,opus";
        const recorder = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: 3_500_000,
          audioBitsPerSecond: 128000,
        });
        let queued = Promise.resolve();
        recorder.ondataavailable = (e) => {
          if (e.data.size)
            queued = queued.then(async () => {
              const bytes = new Uint8Array(await e.data.arrayBuffer());
              let raw = "";
              for (let at = 0; at < bytes.length; at += 32768)
                raw += String.fromCharCode(...bytes.subarray(at, at + 32768));
              await window.saveReviewChunk(btoa(raw));
            });
        };
        const done = new Promise((resolve) => (recorder.onstop = resolve));
        const start = performance.now();
        let previous = -1;
        function wrap(value, x, y, maximumWidth, lineHeight) {
          let line = "",
            nextY = y;
          for (const word of value.split(/\s+/)) {
            const test = line ? line + " " + word : word;
            if (ctx.measureText(test).width > maximumWidth && line) {
              ctx.fillText(line, x, nextY);
              line = word;
              nextY += lineHeight;
            } else line = test;
          }
          if (line) ctx.fillText(line, x, nextY);
        }
        function frame() {
          const elapsed = Math.min(180, (performance.now() - start) / 1000),
            index = scenes.findIndex(
              (s) => elapsed >= s.start && elapsed < s.end,
            );
          if (index < 0 || elapsed >= 179.5) {
            recorder.stop();
            return;
          }
          const scene = scenes[index],
            shots = loaded[scene.id];
          if (index !== previous) {
            previous = index;
            const source = audio.createBufferSource();
            source.buffer = buffers[scene.id];
            source.connect(destination);
            source.start(audio.currentTime + 0.15);
          }
          ctx.fillStyle = "#102e28";
          ctx.fillRect(0, 0, 1920, 1080);
          ctx.fillStyle = "#bedc62";
          ctx.font = "600 24px Arial";
          ctx.fillText("COURTSIDE AI  /  PRIVATE REVIEW DRAFT", 52, 42);
          ctx.fillStyle = "#ffffff";
          ctx.font = "600 40px Arial";
          ctx.fillText(scene.chapter, 52, 100);
          ctx.font = "600 18px Arial";
          ctx.fillStyle = "#c5d6cb";
          ctx.textAlign = "right";
          ctx.fillText(scene.authority, 1868, 42);
          ctx.textAlign = "left";
          const image =
            shots[
              Math.min(
                shots.length - 1,
                Math.floor(
                  ((elapsed - scene.start) / (scene.end - scene.start)) *
                    shots.length,
                ),
              )
            ];
          const regions = {
            scoresheet: [350, 135, 900, 630],
            placement: [320, 445, 1230, 445],
            vision: [320, 445, 1230, 445],
            "agent-tools": [320, 300, 1230, 595],
            "agent-records": [345, 265, 1170, 595],
            recovery: [320, 300, 1230, 595],
            approved: [345, 540, 1170, 320],
          };
          const zoom =
            elapsed - scene.start > 2 &&
            image.width === 1600 &&
            regions[scene.id];
          const [sx, sy, sw, sh] = zoom || [0, 0, image.width, image.height];
          const scale = Math.min(1816 / sw, 760 / sh),
            width = sw * scale,
            height = sh * scale;
          const x = (1920 - width) / 2,
            y = 125 + (760 - height) / 2;
          ctx.fillStyle = "#f7f8f4";
          ctx.fillRect(x - 3, y - 3, width + 6, height + 6);
          ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
          if (zoom) {
            ctx.font = "16px Arial";
            ctx.fillStyle = "#c5d6cb";
            ctx.fillText(
              "Magnified crop of the actual application screen",
              60,
              912,
            );
          }
          ctx.fillStyle = "#ffffff";
          ctx.font = "28px Arial";
          wrap(scene.caption, 60, 935, 1800, 39);
          ctx.font = "18px Arial";
          ctx.fillStyle = "#c5d6cb";
          ctx.fillText(
            "Actual application screens · saved model responses · synthetic league data · no new inference during capture",
            60,
            1040,
          );
          ctx.fillStyle = "#bedc62";
          ctx.fillRect(0, 1074, (1920 * elapsed) / 180, 6);
          requestAnimationFrame(frame);
        }
        recorder.start(1000);
        frame();
        await done;
        await queued;
        for (const track of stream.getTracks()) track.stop();
        await audio.close();
        return {
          requestedDuration: 180,
          measuredWallSeconds: (performance.now() - start) / 1000,
          width: canvas.width,
          height: canvas.height,
          mimeType: mime,
          localNarration: true,
        };
      },
      { scenes, images, wavs },
      { timeout: 200000 },
    );
    // Leave half a second for recorder timing variance, then measure the actual
    // muxed file and decode review frames through native browser playback.
    const bytes = readFileSync(videoPath);
    await page.setContent(
      '<body style="margin:0"><video id="check" width="1920" height="1080" preload="metadata"></video></body>',
    );
    const checked = await page.evaluate(
      async ({ base64 }) => {
        const binary = atob(base64),
          bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)),
          video = document.getElementById("check");
        video.src = URL.createObjectURL(
          new Blob([bytes], { type: "video/webm" }),
        );
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });
        if (!Number.isFinite(video.duration)) {
          video.currentTime = 1e9;
          await new Promise((resolve) => (video.onseeked = resolve));
        }
        return {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
      },
      { base64: bytes.toString("base64") },
    );
    const reviewFrames = [];
    for (const time of [5, 35, 66, 102, 126, 141, 157, 166, 174]) {
      await page.evaluate(
        (time) =>
          new Promise((resolve, reject) => {
            const video = document.getElementById("check");
            video.onerror = () =>
              reject(new Error("Local review video failed to decode"));
            video.onseeked = () =>
              requestAnimationFrame(() => requestAnimationFrame(resolve));
            video.currentTime = time;
          }),
        time,
      );
      const framePath = join(directory, `video-frame-${time}.png`);
      await page.locator("video").screenshot({ path: framePath });
      reviewFrames.push({
        second: time,
        path: framePath.replaceAll("\\", "/"),
      });
    }
    const report = {
      ...rendered,
      media: checked,
      bytes: bytes.length,
      output: videoPath.replaceAll("\\", "/"),
      publicUpload: false,
      finalPublicationApprovalPending: true,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      reviewFrames,
      narrationSegments: wavs.map(({ id, duration, rate }) => ({
        id,
        duration,
        rate,
      })),
    };
    writeFileSync(
      join(directory, "render-report.json"),
      JSON.stringify(report, null, 2),
    );
    assert.ok(
      checked.duration <= 180,
      "Review draft exceeds 180 seconds; trim before handoff",
    );
    console.log(
      `Rendered private narrated ${checked.width}x${checked.height} WebM draft (${checked.duration.toFixed(2)} seconds). No public upload.`,
    );
  } finally {
    await browser.close();
  }
}

async function verifyEncoded() {
  const sharp = (await import("sharp")).default;
  const videoPath = join(directory, "courtside-ai-review-draft.webm");
  const bytes = readFileSync(videoPath);
  const samples = [];
  const manifest = JSON.parse(
    readFileSync(join(directory, "capture-manifest.json")),
  );
  for (const scene of scenes) {
    const paths = manifest.screenshots[scene.id];
    const count = Array.isArray(paths) ? paths.length : 1;
    for (let index = 0; index < count; index++)
      samples.push({
        id: `${scene.id}-${index + 1}`,
        chapter: scene.chapter,
        second:
          scene.start + ((scene.end - scene.start) * (index + 0.5)) / count,
      });
  }
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      offline: true,
    });
    const page = await context.newPage();
    await page.setContent(
      '<body style="margin:0;background:#102e28"><video id="check" width="1920" height="1080" preload="auto"></video></body>',
    );
    const decoded = await page.evaluate(async (base64) => {
      const binary = atob(base64),
        bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const video = document.getElementById("check");
      video.src = URL.createObjectURL(
        new Blob([bytes], { type: "video/webm" }),
      );
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () =>
          reject(new Error("Encoded video metadata failed"));
      });
      if (!Number.isFinite(video.duration))
        await new Promise((resolve) => {
          video.onseeked = resolve;
          video.currentTime = 1e9;
        });
      const audioContext = new AudioContext();
      const audio = await audioContext.decodeAudioData(bytes.buffer.slice(0));
      let squared = 0,
        peak = 0,
        nonzero = 0,
        sampled = 0;
      for (let channel = 0; channel < audio.numberOfChannels; channel++) {
        const values = audio.getChannelData(channel);
        for (let i = 0; i < values.length; i += 32) {
          const value = values[i];
          squared += value * value;
          peak = Math.max(peak, Math.abs(value));
          if (Math.abs(value) > 0.0001) nonzero++;
          sampled++;
        }
      }
      const result = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        audio: {
          channels: audio.numberOfChannels,
          sampleRate: audio.sampleRate,
          duration: audio.duration,
          peak,
          rms: Math.sqrt(squared / sampled),
          nonzeroSampleFraction: nonzero / sampled,
          source:
            "Decoded audio from the actual encoded WebM file, not the source narration WAVs",
        },
      };
      await audioContext.close();
      return result;
    }, bytes.toString("base64"));
    assert.ok(decoded.duration > 175 && decoded.duration <= 180);
    assert.equal(decoded.width, 1920);
    assert.equal(decoded.height, 1080);
    assert.ok(
      decoded.audio.channels >= 1 &&
        decoded.audio.peak > 0.01 &&
        decoded.audio.rms > 0.005 &&
        decoded.audio.nonzeroSampleFraction > 0.1,
      "Encoded narration must decode into a substantial nonzero signal",
    );
    const tiles = [];
    for (const [index, sample] of samples.entries()) {
      await page.evaluate(
        (second) =>
          new Promise((resolve, reject) => {
            const video = document.getElementById("check");
            video.onerror = () =>
              reject(new Error("Encoded scene seek failed"));
            video.onseeked = () =>
              requestAnimationFrame(() => requestAnimationFrame(resolve));
            video.currentTime = second;
          }),
        sample.second,
      );
      const framePath = join(directory, `encoded-${sample.id}.png`);
      await page.locator("video").screenshot({ path: framePath });
      sample.path = framePath.replaceAll("\\", "/");
      const title = `${sample.second.toFixed(1)}s · ${sample.id}`;
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="38"><rect width="480" height="38" fill="#102e28"/><text x="12" y="25" fill="white" font-family="Arial" font-size="17">${title}</text></svg>`,
      );
      const thumbnail = await sharp(framePath).resize(480, 270).toBuffer();
      const tile = await sharp({
        create: { width: 480, height: 308, channels: 3, background: "#102e28" },
      })
        .composite([
          { input: thumbnail, top: 0, left: 0 },
          { input: label, top: 270, left: 0 },
        ])
        .png()
        .toBuffer();
      tiles.push({
        input: tile,
        top: Math.floor(index / 4) * 308,
        left: (index % 4) * 480,
      });
    }
    const contactSheet = join(directory, "encoded-video-contact-sheet.png");
    decoded.audio.playbackSamples = await page.evaluate(async () => {
      const video = document.getElementById("check");
      const audio = new AudioContext();
      const source = audio.createMediaElementSource(video),
        analyser = audio.createAnalyser(),
        mute = audio.createGain();
      mute.gain.value = 0;
      source.connect(analyser);
      analyser.connect(mute);
      mute.connect(audio.destination);
      await audio.resume();
      const checks = [];
      for (const second of [5, 37, 70, 104, 127, 141, 149, 158, 165, 174]) {
        await new Promise((resolve) => {
          video.onseeked = resolve;
          video.currentTime = second;
        });
        await video.play();
        let peak = 0,
          maximumRms = 0;
        const values = new Float32Array(analyser.fftSize);
        for (let i = 0; i < 6; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          analyser.getFloatTimeDomainData(values);
          let squared = 0;
          for (const value of values) {
            peak = Math.max(peak, Math.abs(value));
            squared += value * value;
          }
          maximumRms = Math.max(maximumRms, Math.sqrt(squared / values.length));
        }
        video.pause();
        checks.push({ second, playedTo: video.currentTime, peak, maximumRms });
      }
      await audio.close();
      return checks;
    });
    await sharp({
      create: {
        width: 1920,
        height: Math.ceil(tiles.length / 4) * 308,
        channels: 3,
        background: "#102e28",
      },
    })
      .composite(tiles)
      .png()
      .toFile(contactSheet);
    const report = {
      verifiedAt: new Date().toISOString(),
      sourceVideo: videoPath.replaceAll("\\", "/"),
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      ...decoded,
      actualDecodedFrames: samples,
      contactSheet: contactSheet.replaceAll("\\", "/"),
      allSceneCutsDecoded: true,
      publicUpload: false,
    };
    writeFileSync(
      join(directory, "encoded-verification-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      `Verified actual ${decoded.duration.toFixed(3)}-second 1080p WebM: ${samples.length} decoded scene-cut frames, ${decoded.audio.channels} audio channels, nonzero encoded narration. Private contact sheet saved.`,
    );
  } finally {
    await browser.close();
  }
}

if (process.argv.includes("--capture-approved-deployment")) await capture();
if (process.argv.includes("--render")) await render();
if (process.argv.includes("--verify-render")) await verifyEncoded();
if (
  !process.argv.includes("--render") &&
  !process.argv.includes("--verify-render") &&
  !process.argv.includes("--capture-approved-deployment")
)
  console.log(
    "Prepared the local 180-second caption/narration plan only. Capture waits for verified production deployment; rendering requires actual captured screens.",
  );
