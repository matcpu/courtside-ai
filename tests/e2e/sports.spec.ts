import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import sharp from "sharp";
test.use({
  trace: "off",
  video: "off",
  screenshot: "off",
  actionTimeout: 15000,
  navigationTimeout: 30000,
});
test.skip(
  process.env.SPORTS_LOCAL_REVIEW !== "true",
  "Requires isolated loopback multi-sport fixture adapter",
);
test.setTimeout(180000);
const backend = "http://127.0.0.1:3402";
async function fixture(page: Page, size: string, sport: string) {
  const data = await (await page.request.get(backend + "/__preview")).json();
  return {
    ...data.sports[size][sport],
    password: data.password,
    accounts: data.accounts,
  };
}
async function login(
  page: Page,
  password: string,
  email = "launchpad-admin@example.invalid",
) {
  await page.goto("/");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Email address").fill(email);
  await d.getByLabel("Password", { exact: true }).fill(password);
  await d.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(d).toHaveCount(0);
}
async function api(page: Page, path: string, body?: unknown, method?: string) {
  return page.evaluate(
    async ({ path, body, method }) => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      const token = key
        ? JSON.parse(localStorage.getItem(key)!).access_token
        : "";
      const r = await fetch(path, {
        method: method ?? (body ? "POST" : "GET"),
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body, method },
  );
}
async function screenshot(page: Page, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  fs.mkdirSync(".local/sports-review", { recursive: true });
  await page.screenshot({
    path: `.local/sports-review/${name}.png`,
    fullPage: true,
  });
}
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL).toBe("http://127.0.0.1:3401");
});
test("coach and outsider cannot configure competition rules or approve results", async ({
  page,
}, info) => {
  const f = await fixture(page, info.project.name, "hockey");
  await login(page, f.password, f.accounts.coach);
  await page.goto(`/workspace/${f.id}?view=Settings`);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save competition rules", exact: true }),
  ).toHaveCount(0);
  const s = (await api(page, `/api/league?id=${f.id}&public=false`)).data;
  expect(s.role).toBe("coach");
  expect(
    (
      await api(page, "/api/league", {
        league: f.id,
        action: "configure_sport",
        payload: {
          sport: "hockey",
          sportRules: s.league.sport_rules,
          expected_sport_revision: s.league.sport_revision,
        },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await api(
        page,
        "/api/scoresheet",
        {
          league: f.id,
          sheet_id: crypto.randomUUID(),
          reviewed: true,
          extraction: {
            homeTeam: "Synthetic Alpha",
            awayTeam: "Synthetic Beta",
            homeScore: 4,
            awayScore: 3,
            decision: "overtime",
            confidence: 1,
            warnings: [],
            players: [],
          },
        },
        "PATCH",
      )
    ).status,
  ).toBe(403);
  await page.evaluate(() => localStorage.clear());
  await login(page, f.password, f.accounts.outsider);
  expect((await api(page, `/api/league?id=${f.id}&public=false`)).status).toBe(
    403,
  );
});

test("guided hockey setup persists selected sport, custom points and scheduling policy", async ({
  page,
}, info) => {
  const f = await fixture(page, info.project.name, "hockey");
  await login(page, f.password);
  await page.goto(`/workspace/${f.id}?view=Settings`);
  await page
    .getByRole("button", { name: "Create league", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: /Help me set up a league/ }).click();
  const name = `Synthetic Hockey ${info.project.name} ${Date.now()}`;
  await d.getByLabel("League name", { exact: true }).fill(name);
  await d.getByLabel("Primary city").fill("Toronto");
  await d
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("hockey");
  await d.getByRole("button", { name: /Season & divisions/ }).click();
  for (const [label, value] of [
    ["Season name", "Synthetic 2099"],
    ["Season start", "2099-03-01"],
    ["Season end", "2099-06-30"],
    ["Expected opening day", "2099-03-07"],
    ["Age eligibility cutoff", "2099-01-01"],
    ["Registration / questionnaire deadline", "2099-02-01"],
    ["Roster deadline", "2099-02-15"],
    ["Verification deadline", "2099-02-28"],
  ])
    await d.getByLabel(label, { exact: true }).fill(value);
  await d.getByRole("button", { name: /Facilities/ }).click();
  await d.getByRole("button", { name: "Add a rink", exact: true }).click();
  await d.getByLabel("Rink 1 name").fill("Synthetic Ice One");
  await d.getByLabel("Rink 1 venue / address").fill("Synthetic Ice Centre");
  await d.getByRole("button", { name: /Rules & safety/ }).click();
  await expect(
    d.getByRole("combobox", { name: "Sport", exact: true }),
  ).toHaveValue("hockey");
  await expect(
    d.getByLabel("Overtime / shootout loss points", { exact: true }),
  ).toHaveValue("1");
  await d.getByLabel("Win points", { exact: true }).fill("3");
  await d.getByLabel("Game slot minutes").fill("90");
  await d.getByLabel("Minimum team rest minutes").fill("45");
  await d.getByRole("checkbox", { name: "Passport", exact: true }).check();
  await d.getByRole("button", { name: /Review & finish/ }).click();
  await expect(d).toContainText("Hockey");
  await expect(d).toContainText("3 points per win");
  await screenshot(page, `${info.project.name}-hockey-setup`);
  await d.getByRole("button", { name: "Finish setup", exact: true }).click();
  await expect(d).toHaveCount(0);
  const id = await page.getByLabel("Switch league").inputValue();
  const s = await api(page, `/api/league?id=${id}&public=false`);
  expect(s.status).toBe(200);
  expect(s.data.league.sport).toBe("hockey");
  expect(s.data.league.sport_rules).toMatchObject({
    winPoints: 3,
    gameMinutes: 90,
    restMinutes: 45,
    overtimeLossPoints: 1,
  });
  expect(s.data.readiness).toEqual([]);
  const schedule = await api(page, "/api/schedule", {
    league: id,
    round: 0,
    useMeta: false,
  });
  expect(schedule.status).toBe(400);
  expect(schedule.data.error).toContain("scheduling-ready");
  await page.goto(`/workspace/${id}?view=Settings`);
  await expect(
    page.getByRole("combobox", { name: "Sport", exact: true }),
  ).toHaveValue("hockey");
  await page.getByLabel("Win points", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Save competition rules", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await api(page, `/api/league?id=${id}&public=false`)).data.league
          .sport_rules.winPoints,
    )
    .toBe(2);
  const edit = await api(page, "/api/launchpad", {
    action: "begin_edit",
    payload: { league_id: id },
  });
  const {
    sport: omittedSport,
    sportRules: omittedRules,
    ...oldData
  } = edit.data.data;
  const saved = await api(page, "/api/launchpad", {
    action: "save_draft",
    payload: {
      id: edit.data.id,
      revision: edit.data.revision,
      league_id: id,
      data: oldData,
    },
  });
  expect(saved.status).toBe(200);
  expect(
    (
      await api(page, "/api/launchpad", {
        action: "finish",
        payload: { id: saved.data.id, revision: saved.data.revision },
      })
    ).status,
  ).toBe(200);
  expect(
    (await api(page, `/api/league?id=${id}&public=false`)).data.league,
  ).toMatchObject({
    sport: "hockey",
    sport_rules: {
      gameMinutes: 90,
      restMinutes: 45,
      overtimeLossPoints: 1,
      winPoints: 2,
    },
  });
  await screenshot(page, `${info.project.name}-hockey-settings`);
});

for (const sport of ["basketball", "hockey"])
  test(`${sport}: private scoresheet → human result → standings → published website`, async ({
    page,
    request,
    browser,
  }, info) => {
    const f = await fixture(page, info.project.name, sport);
    await login(page, f.password);
    await page.goto(`/workspace/${f.id}?view=Scoresheets`);
    await page.locator('select[name="game_id"]').selectOption(f.game_id);
    const home = sport === "hockey" ? 4 : 78,
      away = sport === "hockey" ? 3 : 43;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><rect width="900" height="500" fill="white"/><text x="30" y="70" font-size="30">SYNTHETIC ${sport} SCORESHEET ${info.project.name}</text><text x="30" y="170" font-size="32">Synthetic Alpha ${home} - Synthetic Beta ${away}</text><text x="30" y="260" font-size="28">${sport === "hockey" ? "Overtime" : "Regulation"} · No player statistics recorded</text></svg>`,
    );
    const buffer = await sharp(svg).png().toBuffer();
    await page
      .getByLabel("Scoresheet photo (JPEG, PNG, WebP · up to 6 MB)", {
        exact: true,
      })
      .setInputFiles({
        name: "synthetic-score.png",
        mimeType: "image/png",
        buffer,
      });
    await page
      .getByRole("button", { name: "Upload and review", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await expect(d.getByLabel("Home final score")).toBeVisible();
    await d.getByLabel("Home final score").fill(String(home));
    await d.getByLabel("Away final score").fill(String(away));
    if (sport === "hockey")
      await d.getByLabel("Result decision").selectOption("overtime");
    await d.getByLabel(/I checked the original scoresheet/).check();
    await screenshot(page, `${info.project.name}-${sport}-score-review`);
    await d
      .getByRole("button", { name: "Confirm official result", exact: true })
      .click();
    await expect(d).toHaveCount(0);
    await page.goto(`/workspace/${f.id}?view=Standings`);
    const s = (await api(page, `/api/league?id=${f.id}&public=false`)).data;
    expect(
      s.games.find((g: { id: string }) => g.id === f.game_id),
    ).toMatchObject({
      status: "confirmed",
      home_score: home,
      away_score: away,
      decision: sport === "hockey" ? "overtime" : "regulation",
    });
    await expect(page.locator("table").first()).toContainText(
      "Synthetic Alpha",
    );
    await screenshot(page, `${info.project.name}-${sport}-standings`);
    if (sport === "hockey") {
      const paused = await api(page, "/api/agent", {
        league: f.id,
        objective: "Inspect synthetic league",
      });
      expect(paused.status).toBe(400);
      expect(paused.data.error).toContain("basketball-only");
    }
    await page.goto(`/workspace/${f.id}?view=Launchpad`);
    await page
      .getByRole("button", { name: "League website", exact: true })
      .click();
    await expect(page.locator(".site-season-sport")).toHaveText(
      sport === "hockey" ? "Hockey" : "Basketball",
    );
    await page
      .getByLabel("Public headline", { exact: true })
      .fill(`Synthetic ${sport} season · ${info.project.name}`);
    await page
      .getByRole("button", { name: "Save website draft", exact: true })
      .click();
    await expect(page.locator(".launch-notice")).toContainText(
      "Website draft saved privately",
    );
    await page.getByLabel(/I reviewed the saved public copy/).check();
    await page
      .getByRole("button", { name: "Publish saved website", exact: true })
      .click();
    await expect(page.locator(".launch-notice")).toContainText(
      "Website published",
    );
    const publicContext = await browser.newContext({
      viewport:
        info.project.name === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 900 },
    });
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`http://127.0.0.1:3401/league/${f.slug}/website`);
    await expect(publicPage.locator(".site-courtside")).toBeVisible();
    await expect(publicPage.locator(".site-season-sport")).toHaveText(
      sport === "hockey" ? "Hockey" : "Basketball",
    );
    if (sport === "hockey") {
      await expect(
        publicPage.locator(".site-featured-games .site-game-status"),
      ).toContainText("Final · OT");
      await expect(publicPage.locator("#standings")).toContainText("OT/SO L");
    }
    await screenshot(publicPage, `${info.project.name}-${sport}-public`);
    expect(
      (await request.get(`/api/league?id=${f.id}&public=false`)).status(),
    ).toBe(401);
    const html = await publicPage.content();
    expect(html).not.toContain("guardian_email");
    expect(html).not.toContain("birth_date");
    await publicContext.close();
  });
