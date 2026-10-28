import { test, expect, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("coach, guardian and administrator complete secure preseason onboarding", async ({
  page,
  browser,
}, info) => {
  test.skip(
    !existsSync(".local/live-audit.json"),
    "Prepare isolated audit accounts first.",
  );
  test.setTimeout(300000);
  page.setDefaultTimeout(20000);
  const env = parse(readFileSync(".env.local")),
    state = JSON.parse(readFileSync(".local/live-audit.json", "utf8"));
  const accounts = {
    admin: state.accounts[`${info.project.name}_preseason_admin`],
    coach: state.accounts[`${info.project.name}_preseason_coach`],
  };
  test.skip(
    !accounts.admin || !accounts.coach,
    "Run the updated prepare-live-audit.mjs.",
  );
  const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    client = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  let token = "";
  async function signSetup() {
    const { data, error } = await client.auth.signInWithPassword(
      accounts.admin,
    );
    expect(error?.message).toBeUndefined();
    token = data.session!.access_token;
  }
  await signSetup();
  async function call(
    path: string,
    body?: unknown,
    retry = true,
  ): Promise<any> {
    const response = await fetch(origin + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        Origin: origin,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(45000),
    }).catch(() => {
      throw new Error("Preseason test transport failed; credentials redacted");
    });
    if (response.status === 401 && retry) {
      await signSetup();
      return call(path, body, false);
    }
    const data = await response.json();
    expect(response.ok, `${path}: ${data.error ?? response.status}`).toBe(true);
    return data;
  }
  const health = await call("/api/health");
  expect(health.meta).toBe(false);
  const created = await call("/api/league", {
      league: null,
      action: "create_league",
      payload: {
        name: `Synthetic ${info.project.name} Preseason`,
        season: "Upcoming 2026",
        cutoff: "2026-09-01",
      },
    }),
    league = created.id;
  const core = (action: string, payload: unknown) =>
      call("/api/league", { league, action, payload }),
    preseason = (action: string, payload: unknown) =>
      call("/api/preseason", { league, action, payload });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function menu() {
    if (
      info.project.name === "mobile" &&
      !(await page
        .locator(".sidebar")
        .evaluate((el) => el.classList.contains("sidebar-open")))
    )
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
  }
  async function nav(name: string) {
    await menu();
    await page.getByRole("button", { name, exact: true }).click();
  }
  async function login(role: "admin" | "coach") {
    console.log(`${info.project.name}: preseason ${role} signs in`);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Your league. In sync." }),
    ).toBeVisible();
    await menu();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill(accounts[role].email);
    await dialog
      .getByLabel("Password", { exact: true })
      .fill(accounts[role].password);
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByLabel("Switch league").locator(`option[value="${league}"]`),
    ).toHaveCount(1);
    await page.getByLabel("Switch league").selectOption(league);
    await page
      .getByRole("button", { name: "Preseason Onboarding", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Coach assessment and placement",
        exact: true,
      }),
    ).toBeVisible();
  }
  async function logout() {
    await menu();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  }
  await login("admin");
  await page.getByLabel("Season name", { exact: true }).fill("Upcoming 2026");
  await page.getByLabel("Opening weekend", { exact: true }).fill("2026-11-07");
  await page.getByLabel("Age cutoff date", { exact: true }).fill("2026-09-01");
  await page
    .getByLabel("Registration status", { exact: true })
    .selectOption("open");
  await page.getByLabel("Minimum active roster", { exact: true }).fill("1");
  await page.getByLabel("Maximum active roster", { exact: true }).fill("12");
  for (const [label, days] of [
    ["Questionnaire", 2],
    ["Roster", 3],
    ["Verification", 4],
  ] as const)
    await page
      .getByLabel(`${label} deadline (device timezone)`, { exact: true })
      .fill(new Date(Date.now() + days * 86400000).toISOString().slice(0, 16));
  await page
    .getByRole("button", { name: "Save season rules", exact: true })
    .click();
  await expect(
    page.getByText(
      "Season rules saved. Age-rule changes require renewed administrator review.",
      { exact: true },
    ),
  ).toBeVisible();
  await core("invite_member", { email: accounts.coach.email, role: "coach" });
  await logout();
  await login("coach");
  const teamName = `Fictional ${info.project.name} Comets`,
    playerName = `Fictional ${info.project.name} Player`;
  await page.getByLabel("Preseason team name", { exact: true }).fill(teamName);
  await page
    .getByLabel("Previous league", { exact: true })
    .fill("Synthetic Community League");
  await page
    .getByLabel("Previous division", { exact: true })
    .fill("Competitive");
  await page.getByLabel("Previous season wins", { exact: true }).fill("8");
  await page.getByLabel("Previous season losses", { exact: true }).fill("4");
  await page.getByLabel("Typical winning margin", { exact: true }).fill("12");
  await page.getByLabel("Typical losing margin", { exact: true }).fill("8");
  await page
    .getByLabel("Returning player percentage", { exact: true })
    .fill("70");
  await page
    .getByLabel("Experienced competitive players", { exact: true })
    .fill("5");
  await page
    .getByLabel("Competitive experience level", { exact: true })
    .selectOption("3");
  await page.getByLabel("Years together", { exact: true }).fill("2");
  await page.getByLabel("Practices per week", { exact: true }).fill("2");
  await page
    .getByLabel("Preferred initial division tier", { exact: true })
    .selectOption("2");
  await page
    .getByLabel("Coach placement confidence (%)", { exact: true })
    .fill("70");
  await page
    .getByRole("button", { name: "Save questionnaire draft", exact: true })
    .click();
  await expect(
    page.getByText("Draft saved. You can return to finish it later.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await nav("Preseason Onboarding");
  await page
    .getByLabel("Preseason team", { exact: true })
    .selectOption({ label: teamName });
  await expect(page.getByLabel("Previous league", { exact: true })).toHaveValue(
    "Synthetic Community League",
  );
  await page
    .getByRole("button", { name: "Submit questionnaire", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Initial placement evidence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Interpret with Muse Spark",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Approve preseason placement",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByLabel("Player name (synthetic for demo)", { exact: true })
    .fill(playerName);
  await page.getByLabel("Jersey number", { exact: true }).fill("17");
  await page
    .getByLabel("Declared birth date", { exact: true })
    .fill("2013-02-03");
  await page
    .getByRole("button", { name: "Add preseason player", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `#17 ${playerName}`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Submit roster for preseason review",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Roster submitted. Scheduling stays blocked until every active player is approved.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create guardian invitation", exact: true })
    .click();
  await expect(
    page.getByLabel("New guardian invitation link", { exact: true }),
  ).toBeVisible();
  const invite = await page
    .getByLabel("New guardian invitation link", { exact: true })
    .inputValue();
  const parentContext = await browser.newContext({
    ...devices[info.project.name === "mobile" ? "iPhone 13" : "Desktop Chrome"],
  });
  const parent = await parentContext.newPage();
  parent.setDefaultTimeout(20000);
  parent.on("pageerror", (e) => errors.push(e.message));
  async function proof(name: string) {
    const maker = await browser.newPage({
      viewport: { width: 760, height: 450 },
    });
    await maker.setContent(
      `<html><body style="font:24px Arial;padding:30px;border:10px solid #a00"><h1>SYNTHETIC TEST RECORD</h1><p>NOT A REAL ID</p><p>${name}</p><p>Date of birth: 2013-02-03</p><p>Controlled software test fixture only</p></body></html>`,
    );
    const bytes = await maker.screenshot();
    await maker.close();
    return bytes;
  }
  const image = await proof(playerName);
  async function uploadParent() {
    await parent
      .getByLabel("Guardian full name", { exact: true })
      .fill("Fictional Guardian");
    await parent
      .getByLabel("Proof of age photo", { exact: true })
      .setInputFiles({
        name: "synthetic-proof.png",
        mimeType: "image/png",
        buffer: image,
      });
    await parent
      .getByRole("checkbox", { name: /I confirm the recorded name/ })
      .check();
    await parent
      .getByRole("checkbox", { name: /I am the parent or legal guardian/ })
      .check();
    await parent
      .getByRole("button", {
        name: "Submit proof and guardian consent",
        exact: true,
      })
      .click();
    await expect(
      parent.getByText("Verification: pending", { exact: true }),
    ).toBeVisible();
  }
  try {
    console.log(`${info.project.name}: guardian opens secure invitation`);
    await parent.goto(invite);
    await expect(
      parent.getByRole("heading", { name: playerName, exact: true }),
    ).toBeVisible();
    expect(new URL(parent.url()).hash.length === 0).toBe(true);
    await uploadParent();
    await logout();
    await login("admin");
    await page
      .getByLabel("Preseason team", { exact: true })
      .selectOption({ label: teamName });
    await page
      .getByLabel("Administrator placement tier", { exact: true })
      .selectOption("2");
    await page
      .getByLabel("Placement review or override reason", { exact: true })
      .fill("Prior synthetic competition context reviewed by administrator");
    await page
      .getByRole("button", { name: "Approve preseason placement", exact: true })
      .click();
    await expect(
      page.getByText("Placement approved by league administrator.", {
        exact: true,
      }),
    ).toBeVisible();
    let review = page
      .locator(".preseason-review")
      .filter({
        has: page.getByRole("heading", {
          name: `${playerName} · birth certificate`,
          exact: true,
        }),
      });
    await review
      .getByRole("button", { name: "Open private proof of age", exact: true })
      .click();
    await expect
      .poll(() =>
        review
          .getByAltText(`Private proof of age for ${playerName}`)
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    await review
      .getByLabel(`Review decision for ${playerName}`, { exact: true })
      .selectOption("resubmission");
    await review
      .getByLabel(`Review reason for ${playerName}`, { exact: true })
      .fill("Please resubmit a complete readable synthetic proof.");
    await review
      .getByRole("button", {
        name: "Record verification decision",
        exact: true,
      })
      .click();
    await expect(review).toHaveCount(0);
    await parent
      .getByRole("button", { name: "Refresh verification status", exact: true })
      .click();
    await expect(
      parent.getByText("Verification: resubmission", { exact: true }),
    ).toBeVisible();
    await uploadParent();
    await page
      .getByRole("button", { name: "Refresh preseason", exact: true })
      .click();
    review = page
      .locator(".preseason-review")
      .filter({
        has: page.getByRole("heading", {
          name: `${playerName} · birth certificate`,
          exact: true,
        }),
      });
    await review
      .getByRole("button", { name: "Open private proof of age", exact: true })
      .click();
    await expect
      .poll(() =>
        review
          .getByAltText(`Private proof of age for ${playerName}`)
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    await review
      .getByLabel(`Review decision for ${playerName}`, { exact: true })
      .selectOption("approved");
    await review
      .getByLabel(`Review reason for ${playerName}`, { exact: true })
      .fill(
        "Synthetic proof matches declared name and date; guardian consent checked.",
      );
    await review
      .getByRole("checkbox", { name: /I inspected the original proof/ })
      .check();
    await review
      .getByRole("button", {
        name: "Record verification decision",
        exact: true,
      })
      .click();
    await expect(review).toHaveCount(0);
    await parent
      .getByRole("button", { name: "Refresh verification status", exact: true })
      .click();
    await expect(
      parent.getByText("Verification: approved", { exact: true }),
    ).toBeVisible();
    const ready = page
      .getByRole("row")
      .filter({
        has: page.getByRole("button", { name: teamName, exact: true }),
      });
    await expect(ready.getByText("Ready", { exact: true })).toBeVisible();
    // The other ready team uses the same genuine APIs and signed-upload bridge;
    // only this test's first player uses the complete visible parent journey.
    const answer = {
      ageCategory: "U14",
      previousLeague: "Synthetic League",
      previousDivision: "Competitive",
      wins: 8,
      losses: 4,
      draws: 0,
      winningMargin: 12,
      losingMargin: 8,
      returningPercent: 70,
      competitivePlayers: 5,
      experience: 3,
      yearsTogether: 2,
      practicesPerWeek: 2,
      preferredTier: 2,
      coachConfidence: 70,
      notes: "Synthetic opponent",
    };
    const second = await preseason("save_questionnaire", {
      team_id: null,
      name: "Fictional Opening Opponent",
      data: answer,
      submit: true,
    });
    await core("approve_team", {
      team_id: second.team_id,
      tier: 2,
      override_reason:
        "Synthetic prior competition reviewed for opening opponent",
    });
    const otherName = "Fictional Opponent Player",
      otherPlayer = await core("add_player", {
        team_id: second.team_id,
        display_name: otherName,
        jersey: "4",
        birth_date: "2013-02-03",
        guardian_consent: false,
      });
    await preseason("submit_roster", { team_id: second.team_id });
    const otherInvite = await preseason("invite_guardian", {
      player_id: otherPlayer.id,
      email: "",
      send_email: false,
    });
    const raw = new URLSearchParams(
      new URL(otherInvite.invitationUrl).hash.slice(1),
    ).get("invite");
    async function guardianCall(action: string, payload: unknown, cookie = "") {
      const r = await fetch(origin + "/api/guardian", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({ action, payload }),
      });
      const v = await r.json();
      expect(r.ok, v.error ?? "guardian request").toBe(true);
      return {
        value: v,
        cookie: r.headers.get("set-cookie")?.split(";")[0] ?? cookie,
      };
    }
    const session = await guardianCall("exchange", { token: raw }),
      reservation = await guardianCall(
        "reserve_upload",
        {
          invitation_id: session.value.invitation_id,
          document_type: "birth_certificate",
          mime: "image/png",
        },
        session.cookie,
      );
    const uploaded = await createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    )
      .storage.from("youth-documents")
      .uploadToSignedUrl(
        reservation.value.path,
        reservation.value.uploadToken,
        await proof(otherName),
        { contentType: "image/png", cacheControl: "0" },
      );
    expect(uploaded.error?.message).toBeUndefined();
    await guardianCall(
      "submit",
      {
        invitation_id: session.value.invitation_id,
        document_id: reservation.value.document_id,
        guardian_name: "Fictional Second Guardian",
        relationship: "parent",
        consent: true,
        confirmed_details: true,
      },
      session.cookie,
    );
    const opened = await preseason("open_document", {
      document_id: reservation.value.document_id,
    });
    expect((await fetch(opened.url)).ok).toBe(true);
    await preseason("review_document", {
      document_id: reservation.value.document_id,
      decision: "approved",
      reason: "Matching synthetic opponent proof inspected and consent checked",
      document_checked: true,
      duplicate_acknowledged: false,
    });
    const court = await core("add_court", {
      name: "Fictional Opening Court",
      venue: "Synthetic Gym",
    });
    await core("add_availability", {
      court_id: court.id,
      starts_at: "2026-11-07T14:00:00Z",
      ends_at: "2026-11-07T22:00:00Z",
    });
    await page
      .getByRole("button", { name: "Refresh league", exact: true })
      .click();
    await nav("Schedule");
    await page
      .getByRole("button", { name: "Generate next round", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Draft schedule/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Approve & publish", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Draft schedule/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Published fixtures", exact: true }),
    ).toBeVisible();
    await nav("Meta AI activity");
    await expect(
      page.getByRole("heading", {
        name: "No live Meta evidence recorded",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await parent.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await parent.screenshot({
      path: `.local/preseason-${info.project.name}-guardian-approved.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `.local/preseason-${info.project.name}-meta-prepared.png`,
      fullPage: true,
    });
  } finally {
    await parentContext.close();
  }
});
