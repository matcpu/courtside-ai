import { test, expect } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Deliberately opt-in: no test account password, token, trace or storageState is committed.
test.use({ trace: "off", screenshot: "off", video: "off" });
test("real coach and administrator operate a private synthetic season", async ({
  page,
}, info) => {
  test.skip(
    !existsSync(".local/live-audit.json"),
    "Run prepare-live-audit.mjs first.",
  );
  test.setTimeout(240000);
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  const state = JSON.parse(readFileSync(".local/live-audit.json", "utf8"));
  const accounts = {
    admin: state.accounts[`${info.project.name}_admin`],
    coach: state.accounts[`${info.project.name}_coach`],
  };
  const env = parse(readFileSync(".env.local"));
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword(accounts.admin);
  expect(error?.message).toBeUndefined();
  const headers = { Authorization: `Bearer ${data.session!.access_token}` };
  const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
  const post = async (url: string, body: unknown) => {
    const response = await fetch(origin + url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    }).catch(() => {
      throw new Error(
        "Audit setup transport failed; request credentials redacted",
      );
    });
    const result = await response.json();
    expect(response.ok, `${url}: ${result.error ?? response.status}`).toBe(
      true,
    );
    return result;
  };
  // A separate production tenant forces an actual upload through Vercel,
  // rather than reusing a photo already submitted to the local server.
  const fixtureFile = `.local/authenticated-${info.project.name}${origin.startsWith("https://") ? "-production" : ""}.json`;
  const fixture = existsSync(fixtureFile)
    ? JSON.parse(readFileSync(fixtureFile, "utf8"))
    : { league: (await post("/api/demo", {})).id };
  writeFileSync(fixtureFile, JSON.stringify(fixture));
  const command = (action: string, payload = {}) =>
    post("/api/league", { league: fixture.league, action, payload });
  const snap = async () => {
    // UI sign-out revokes this user's other sessions too. Obtain a fresh audit
    // session rather than bypassing or weakening the application's auth behavior.
    const { data: refresh, error: refreshError } =
      await client.auth.signInWithPassword(accounts.admin);
    expect(refreshError?.message).toBeUndefined();
    headers.Authorization = `Bearer ${refresh.session!.access_token}`;
    const r = await fetch(origin + `/api/league?id=${fixture.league}`, {
      headers,
      signal: AbortSignal.timeout(30000),
    }).catch(() => {
      throw new Error(
        "Audit snapshot transport failed; request credentials redacted",
      );
    });
    expect(r.ok).toBe(true);
    return r.json();
  };
  await command("invite_member", {
    email: accounts.coach.email,
    role: "coach",
  });
  let s = await snap();
  const eagles = s.teams.find(
    (t: { name: string }) => t.name === "Eastside Eagles",
  );
  if (eagles.coach_id !== accounts.coach.id)
    await command("assign_coach", {
      team_id: eagles.id,
      email: accounts.coach.email,
    });
  const game =
    s.games.find(
      (g: { home_team_id: string; status: string; id: string }) =>
        g.home_team_id === eagles.id &&
        g.status === "scheduled" &&
        s.fixtures.some(
          (f: { game_id: string; starts_at: string }) =>
            f.game_id === g.id && +new Date(f.starts_at) < Date.now(),
        ),
    ) ?? s.games.find((g: { id: string }) => g.id === fixture.game);
  fixture.game = game.id;
  writeFileSync(fixtureFile, JSON.stringify(fixture));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function nav(name: string) {
    if (info.project.name === "mobile")
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await page.getByRole("button", { name, exact: true }).click();
  }
  async function login(role: "coach" | "admin") {
    console.log(`${info.project.name}: signing in as ${role}`);
    await page.goto("/");
    console.log(`${info.project.name}: page loaded`);
    await expect(
      page.getByRole("heading", { name: "Your league. In sync." }),
    ).toBeVisible();
    if (info.project.name === "mobile")
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    console.log(`${info.project.name}: sign-in dialog opened`);
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill(accounts[role].email);
    await dialog
      .getByLabel("Password", { exact: true })
      .fill(accounts[role].password);
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    console.log(`${info.project.name}: authenticated`);
    await expect(
      page
        .getByLabel("Switch league")
        .locator(`option[value="${fixture.league}"]`),
    ).toHaveCount(1);
    await page.getByLabel("Switch league").selectOption(fixture.league);
    await page
      .getByRole("button", { name: "Teams & rosters", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Eastside Eagles", exact: true }),
    ).toBeVisible();
  }
  async function logout() {
    console.log(`${info.project.name}: signing out`);
    if (info.project.name === "mobile")
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  }
  await login("coach");
  await expect(
    page.getByRole("button", { name: "Approve placement", exact: true }),
  ).toHaveCount(0);
  const teamName = `UI Comets ${info.project.name}`;
  if (!s.teams.some((t: { name: string }) => t.name === teamName)) {
    await page
      .getByRole("button", { name: "Register team", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Team name", { exact: true }).fill(teamName);
    await dialog.getByLabel("Competitive experience").selectOption("3");
    await dialog.getByLabel("Years playing together").fill("2");
    await dialog
      .getByRole("button", { name: "Submit team & assessment" })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: teamName, exact: true }),
  ).toBeVisible();
  await logout();
  await login("admin");
  const teamPanel = page.locator("section").filter({
    has: page.getByRole("heading", { name: teamName, exact: true }),
  });
  if (
    await teamPanel
      .getByRole("button", { name: "Approve placement", exact: true })
      .count()
  ) {
    await teamPanel
      .getByRole("button", { name: "Approve placement", exact: true })
      .click();
    await expect(
      teamPanel.getByText("approved", { exact: true }),
    ).toBeVisible();
  }
  await logout();
  await login("coach");
  await nav("Scoresheets");
  s = await snap();
  if (
    !s.scoresheets.some((sh: { game_id: string }) => sh.game_id === game.id)
  ) {
    await page.getByLabel("Published game").selectOption(game.id);
    await page
      .getByLabel("Scoresheet photo (JPEG, PNG, WebP · up to 6 MB)")
      .setInputFiles("public/demo/scoresheet.png");
    await page
      .getByRole("button", { name: "Upload for manual review", exact: true })
      .click();
  } else
    await page
      .getByRole("button", { name: "Review", exact: true })
      .first()
      .click();
  const review = page.getByRole("dialog", { name: "Review scoresheet" });
  await expect(review).toBeVisible();
  await expect(
    review.getByAltText("Private uploaded scoresheet for review"),
  ).toBeVisible();
  expect(
    await review
      .getByAltText("Private uploaded scoresheet for review")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(
    review.getByRole("button", {
      name: "Confirm official result",
      exact: true,
    }),
  ).toHaveCount(0);
  await review.getByRole("button", { name: "Close review" }).click();
  await logout();
  await login("admin");
  await nav("Scoresheets");
  await page
    .getByRole("button", { name: "Review", exact: true })
    .first()
    .click();
  await expect(review).toBeVisible();
  if (
    await review
      .getByRole("button", { name: "Confirm official result", exact: true })
      .count()
  ) {
    await review.getByLabel("Home final score").fill("78");
    await review.getByLabel("Away final score").fill("43");
    await review.getByRole("checkbox").check();
    await review
      .getByRole("button", { name: "Confirm official result", exact: true })
      .click();
    await expect(review).toHaveCount(0);
  } else await review.getByRole("button", { name: "Close review" }).click();
  s = await snap();
  if (
    s.divisions.find(
      (d: { id: string }) =>
        d.id ===
        s.teams.find((t: { id: string }) => t.id === eagles.id).division_id,
    ).tier > 1
  ) {
    await nav("Competitive balance");
    await page
      .getByRole("button", { name: "Evaluate balance", exact: true })
      .click();
    const proposal = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Eastside Eagles",
          exact: true,
        }),
      });
    await proposal
      .getByRole("button", { name: "Approve adjustment", exact: true })
      .click();
    await expect(proposal).toHaveCount(0);
  }
  await nav("Schedule");
  await page
    .getByRole("button", { name: "Generate next round", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Draft schedule/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve & publish", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: /Draft schedule/ }),
  ).toHaveCount(0);
  await nav("Standings");
  await page
    .getByLabel("Standings division")
    .selectOption({ label: "U14 · Development" });
  await expect(
    page.getByRole("heading", { name: "Season standings" }),
  ).toBeVisible();
  await logout();
  await login("coach");
  await nav("Notifications");
  await expect(
    page.getByRole("heading", { name: "Your team updates" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark as read", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark as read", exact: true })
    .first()
    .click();
  await expect(page.getByText("Read", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "View schedule", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Published fixtures" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `.local/verified-${info.project.name}-coach.png`,
    fullPage: true,
  });
});
