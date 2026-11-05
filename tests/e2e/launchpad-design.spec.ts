import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { newSetup, emptyWebsite } from "../../src/lib/launchpad";

test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.LAUNCHPAD_LOCAL_PREVIEW !== "true",
  "Requires synthetic loopback database",
);
let password: string;
test.beforeAll(async ({ request }) => {
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  password = fixture.password;
});
async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (
    (await menu.isVisible()) &&
    !(await page
      .locator(".sidebar")
      .evaluate((e) => e.classList.contains("sidebar-open")))
  )
    await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function login(page: Page) {
  await page.goto("/");
  await navigate(page, "Sign in");
  const d = page.getByRole("dialog");
  await d.getByLabel("Email address").fill("launchpad-admin@example.invalid");
  await d.getByLabel("Password", { exact: true }).fill(password);
  await d.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(d).toHaveCount(0);
  const fixture = await (
    await page.request.get("http://127.0.0.1:3302/__preview")
  ).json();
  await page.goto(`/workspace/${fixture.league}`);
  await expect(page.getByLabel("Switch league")).toHaveValue(fixture.league);
}
const dates = {
  "Season name": "Spring 2027",
  "Season start": "2027-03-01",
  "Season end": "2027-06-30",
  "Expected opening day": "2027-03-06",
  "Age eligibility cutoff": "2027-01-01",
  "Registration / questionnaire deadline": "2027-02-01",
  "Roster deadline": "2027-02-15",
  "Verification deadline": "2027-02-28",
};

test("facilities and policy validate in their steps; review links correct issues and retain a resumable draft", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await login(page);
  await navigate(page, "System settings & access");
  await page
    .getByRole("button", { name: "Create league", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: /I know what I need/ }).click();
  const name = `DESIGN REVIEW · ${info.project.name} · ${Date.now()}`;
  await d.getByLabel("League name", { exact: true }).fill(name);
  await d.getByLabel("Primary city", { exact: true }).fill("Toronto");
  await d.getByRole("button", { name: /Facilities/ }).click();
  await d.getByRole("button", { name: "Add a court", exact: true }).click();
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(d.locator("#setup-step-errors")).toContainText(
    "unique name and venue/address",
  );
  await expect(
    d.getByRole("heading", { name: "Facilities", exact: true }),
  ).toBeVisible();
  await expect(d.locator("#setup-step-errors")).toBeFocused();
  await d.getByLabel("Court 1 name", { exact: true }).fill("Harbour Court A");
  await d
    .getByLabel("Court 1 venue / address", { exact: true })
    .fill("Fictional Harbour Community Centre · Toronto");
  await d.getByRole("button", { name: "Add a court", exact: true }).click();
  await d.getByLabel("Court 2 name", { exact: true }).fill("Harbour Court A");
  await d
    .getByLabel("Court 2 venue / address", { exact: true })
    .fill("Fictional Harbour Community Centre · Toronto");
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(d.locator("#setup-step-errors")).toBeVisible();
  await d.getByLabel("Court 2 name", { exact: true }).fill("Harbour Court B");
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    d.getByRole("heading", { name: "Rules & safety", exact: true }),
  ).toBeVisible();
  await d.getByLabel("Maximum active roster", { exact: true }).fill("12");
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(d.locator("#setup-step-errors")).toContainText(
    "Select at least one accepted proof-of-age document.",
  );
  await d.getByRole("checkbox", { name: "Passport", exact: true }).check();
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    d.getByRole("button", { name: "Finish setup", exact: true }),
  ).toBeDisabled();
  await d
    .getByRole("button", { name: "Go to Season & divisions ↗", exact: true })
    .first()
    .click();
  for (const [label, value] of Object.entries(dates))
    await d.getByLabel(label, { exact: true }).fill(value);
  await d.getByRole("button", { name: /Review & finish/ }).click();
  await expect(
    d.getByRole("button", { name: "Finish setup", exact: true }),
  ).toBeEnabled();
  await expect(d.locator(".setup-review")).toContainText("March 1, 2027");
  await expect(d.locator(".setup-review")).toContainText("2 courts · 1 venue");
  await expect(d.locator(".setup-review")).toContainText(
    "5–12 active players per team",
  );
  await d
    .getByRole("button", { name: "Edit facilities ↗", exact: true })
    .click();
  await expect(d.getByLabel("Court 2 name", { exact: true })).toHaveValue(
    "Harbour Court B",
  );
  await d.getByRole("button", { name: /Review & finish/ }).click();
  fs.mkdirSync(".local/launchpad-design-review", { recursive: true });
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 1500 });
  await d
    .locator(".setup-step")
    .evaluate((e) => e.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: `.local/launchpad-design-review/review-${info.project.name}.png`,
  });
  if (info.project.name === "desktop")
    fs.writeFileSync(
      ".local/launchpad-design-review/review-draft.json",
      JSON.stringify(
        {
          name,
          url: "http://127.0.0.1:3301/",
          path: "Sign in → System settings & access → Create league → resume this named draft → Review & finish",
        },
        null,
        2,
      ),
    );
  await d
    .getByRole("button", { name: "Save draft & exit", exact: true })
    .click();
  await expect(d).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create league", exact: true })
    .click();
  await d
    .getByRole("button", {
      name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    })
    .click();
  await d.getByRole("button", { name: /Review & finish/ }).click();
  await expect(
    d.getByRole("button", { name: "Finish setup", exact: true }),
  ).toBeEnabled();
  await d
    .getByRole("button", { name: "Save draft & exit", exact: true })
    .click();
});

test("all themes preserve public privacy, explicit publishing and a populated versus empty season", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  const signup = await request.post("http://127.0.0.1:3302/auth/v1/signup", {
    data: {
      email: `design-${info.project.name}-${Date.now()}@example.invalid`,
      password,
    },
  });
  expect(signup.ok()).toBe(true);
  const auth = await signup.json();
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const cmd = async (action: string, payload: unknown) => {
    const r = await request.post("/api/launchpad", {
      headers,
      data: { action, payload },
    });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  };
  const demo = await request.post("/api/demo", { headers });
  expect(demo.ok()).toBe(true);
  const { id } = await demo.json();
  let draft = await cmd("begin_edit", { league_id: id });
  const data = {
    ...draft.data,
    name: `Design basketball ${info.project.name}`,
    city: "Toronto",
    region: "Ontario",
    season: "Fall 2026",
    start: "2026-09-01",
    end: "2026-12-31",
    opening: "2026-09-05",
    cutoff: "2026-09-01",
    registrationDeadline: "2026-08-01",
    rosterDeadline: "2026-08-15",
    verificationDeadline: "2026-08-28",
    allowedDocumentTypes: ["passport"],
  };
  draft = await cmd("save_draft", {
    id: draft.id,
    revision: draft.revision,
    base_revision: draft.base_revision,
    league_id: id,
    data,
  });
  await cmd("finish", { id: draft.id, revision: draft.revision });
  const site = await cmd("site_preview", { league_id: id });
  const url = `/league/${site.league.slug}/website`;
  let revision = 0;
  for (const theme of ["arena", "community", "courtside"]) {
    await cmd("site_save", {
      league_id: id,
      revision,
      site: {
        ...emptyWebsite,
        theme,
        headline: `Basketball in Toronto · ${theme}`,
        colour: "#ffffff",
        accent: "#000000",
      },
    });
    revision++;
    expect(await (await request.get(url)).text()).not.toContain(
      `Basketball in Toronto · ${theme}`,
    );
    await cmd("site_publish", {
      league_id: id,
      revision,
      approved_public: true,
    });
    await page.goto(url);
    await expect(page.locator("h1")).toHaveText(data.name);
    await expect(
      page.locator(".site-featured-games .site-matchup"),
    ).toHaveCount(4);
    await expect(page.locator(".site-fixtures .site-matchup")).toHaveCount(25);
    await expect(page.locator(".site-fixtures")).toBeHidden();
    await expect(page.locator("#standings")).toBeVisible();
    await expect(page.locator("#contact")).toHaveCount(0);
    await expect(page.locator(".site-venues")).toContainText(
      "1 venue · 2 courts",
    );
    const html = await page.content();
    for (const forbidden of [
      "guardian_email",
      "birth_date",
      "private-organizer@example.invalid",
      "service_role",
    ])
      expect(html).not.toContain(forbidden);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText(
      "Skip to league information",
    );
    await page.keyboard.press("Enter");
    await expect(page.locator("#site-main")).toBeFocused();
    await page.locator("#rules summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#rules details")).toHaveAttribute("open", "");
    await page.locator(".site-all-games > summary").click();
    await expect(page.locator(".site-fixtures")).toBeVisible();
    await expect(page.locator(".site-fixtures .site-game-pending")).toHaveCount(
      1,
    );
    await expect(
      page.locator(".site-fixtures .site-game-pending .site-game-status"),
    ).toHaveText("Result pending");
    await page.locator(".site-all-standings > summary").click();
    await expect(page.locator(".site-all-standings tbody tr")).toHaveCount(12);
  }
  // Fresh empty season: no score/schedule/contact navigation, while registration remains discoverable.
  const setup = {
    ...newSetup(),
    name: `Empty design ${info.project.name}`,
    city: "Toronto",
    season: "Spring 2099",
    start: "2099-03-01",
    end: "2099-06-30",
    opening: "2099-03-07",
    cutoff: "2099-01-01",
    registrationDeadline: "2099-02-01",
    rosterDeadline: "2099-02-15",
    verificationDeadline: "2099-02-28",
    allowedDocumentTypes: ["passport"],
  };
  const d = await cmd("save_draft", {
    id: null,
    revision: null,
    league_id: null,
    data: setup,
  });
  const { league_id: empty } = await cmd("finish", {
    id: d.id,
    revision: d.revision,
  });
  await cmd("site_save", { league_id: empty, revision: 0, site: emptyWebsite });
  await cmd("site_publish", {
    league_id: empty,
    revision: 1,
    approved_public: true,
  });
  const blank = await cmd("site_preview", { league_id: empty });
  await page.goto(`/league/${blank.league.slug}/website`);
  for (const section of ["schedule", "standings", "contact", "venues"]) {
    await expect(page.locator(`#${section}`)).toHaveCount(0);
    await expect(page.locator(`nav a[href="#${section}"]`)).toHaveCount(0);
  }
  await expect(page.locator("h1")).toHaveText(setup.name);
});

test("redesigned review keeps the HTTP 409 safety conflict atomic and visible", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  await login(page);
  const token = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    )!;
    return JSON.parse(localStorage.getItem(k)!).access_token;
  });
  const headers = { Authorization: `Bearer ${token}` };
  const cmd = async (action: string, payload: unknown) => {
    const r = await request.post("/api/launchpad", {
      headers,
      data: { action, payload },
    });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  };
  const data = {
    ...newSetup(),
    name: `Conflict design ${info.project.name} ${Date.now()}`,
    city: "Toronto",
    season: "Spring 2099",
    start: "2099-03-01",
    end: "2099-06-30",
    opening: "2099-03-07",
    cutoff: "2099-01-01",
    registrationDeadline: "2099-02-01",
    rosterDeadline: "2099-02-15",
    verificationDeadline: "2099-02-28",
    allowedDocumentTypes: ["passport"],
  };
  const draft = await cmd("save_draft", {
    id: null,
    revision: null,
    league_id: null,
    data,
  });
  const { league_id: id } = await cmd("finish", {
    id: draft.id,
    revision: draft.revision,
  });
  // Refresh the administrator's league list; no existing fixture is edited.
  await page.reload();
  await page.getByLabel("Switch league").selectOption(id);
  await navigate(page, "Launchpad");
  await page.getByRole("button", { name: /Shape the season/ }).click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("League name", { exact: true })
    .fill("STALE DESIGN NAME MUST NOT APPLY");
  await expect(d.locator(".setup-save-status")).toContainText(
    "Draft saved privately",
  );
  const w = await cmd("workspace", { league_id: id });
  const settings = w.preseason.settings;
  const updated = await request.post("/api/preseason", {
    headers,
    data: {
      league: id,
      action: "configure",
      payload: {
        ...settings,
        questionnaire_deadline: new Date(
          settings.questionnaire_deadline,
        ).toISOString(),
        roster_deadline: new Date(settings.roster_deadline).toISOString(),
        verification_deadline: new Date(
          settings.verification_deadline,
        ).toISOString(),
        season_name: data.season,
        season_start: data.opening,
        cutoff_date: data.cutoff,
        min_roster: 7,
      },
    },
  });
  expect(updated.status(), await updated.text()).toBe(200);
  const before = await cmd("workspace", { league_id: id });
  const coreBefore = await (
    await request.get("/api/league?id=" + id, { headers })
  ).json();
  await d.getByRole("button", { name: /Review & finish/ }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/launchpad") &&
      r.request().postDataJSON()?.action === "finish",
  );
  await d.getByRole("button", { name: "Finish setup", exact: true }).click();
  expect((await response).status()).toBe(409);
  await expect(d.locator(".launch-error")).toContainText(
    "reload the current league",
  );
  expect(await cmd("workspace", { league_id: id })).toEqual(before);
  expect(
    await (await request.get("/api/league?id=" + id, { headers })).json(),
  ).toEqual(coreBefore);
  expect(before.preseason.settings.min_roster).toBe(7);
  await d
    .getByRole("button", { name: "Save draft & exit", exact: true })
    .click();
});
