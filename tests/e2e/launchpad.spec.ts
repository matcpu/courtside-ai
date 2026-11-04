import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import sharp from "sharp";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.LAUNCHPAD_LOCAL_PREVIEW !== "true",
  "Requires the isolated in-memory Launchpad review harness",
);
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL).toBe("http://127.0.0.1:3301");
});
const password = "SyntheticPreview!2099";
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
async function login(page: Page, email = "launchpad-admin@example.invalid") {
  await page.goto("/");
  await expect(page.getByText("12 approved for competition")).toBeVisible();
  await navigate(page, "Sign in");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill(email);
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function api(page: Page, action: string, payload: unknown) {
  return page.evaluate(
    async ({ action, payload }) => {
      const key = Object.keys(localStorage).find(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
      );
      const token = key
        ? JSON.parse(localStorage.getItem(key)!).access_token
        : "";
      const r = await fetch("/api/launchpad", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, payload }),
      });
      return { status: r.status, data: await r.json() };
    },
    { action, payload },
  );
}
test("organizer saves/resumes guided setup, finishes privately, adds genuine capacity and copies a fresh season", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const name = `Synthetic ${info.project.name} League ${Date.now()}`;
  await login(page);
  await navigate(page, "System settings & access");
  await page
    .getByRole("button", { name: "Create league", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: /Help me set up a league/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Copy a previous season/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /I know what I need/ }),
  ).toBeVisible();
  fs.mkdirSync(".local/launchpad-review", { recursive: true });
  await page.screenshot({
    path: `.local/launchpad-review/${info.project.name}-starting-paths.png`,
  });
  await dialog.getByRole("button", { name: /Help me set up a league/ }).click();
  await dialog.getByLabel("League name", { exact: true }).fill(name);
  await dialog.getByLabel("Primary city").fill("Toronto");
  await dialog.getByRole("button", { name: "Save draft & exit" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create league", exact: true })
    .click();
  await dialog.getByRole("button", { name: new RegExp(name) }).click();
  await expect(dialog.getByLabel("League name", { exact: true })).toHaveValue(
    name,
  );
  await dialog.getByRole("button", { name: /Season & divisions/ }).click();
  for (const [label, value] of [
    ["Season name", "Synthetic Spring 2099"],
    ["Season start", "2099-03-01"],
    ["Season end", "2099-06-30"],
    ["Expected opening day", "2099-03-07"],
    ["Age eligibility cutoff", "2099-01-01"],
    ["Registration / questionnaire deadline", "2099-02-01"],
    ["Roster deadline", "2099-02-15"],
    ["Verification deadline", "2099-02-28"],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog
    .getByLabel("Add an age category", { exact: true })
    .fill("U12 Girls");
  await dialog.getByRole("button", { name: "Add three tiers" }).click();
  await dialog.getByRole("button", { name: /Facilities/ }).click();
  await dialog
    .getByRole("button", { name: "Add a court", exact: true })
    .click();
  await dialog.getByLabel("Court 1 name").fill("Fictional Court");
  await dialog
    .getByLabel("Court 1 venue / address")
    .fill("Synthetic Community Hall · Toronto");
  await dialog.getByRole("button", { name: /Rules & safety/ }).click();
  await dialog.getByLabel("Minimum active roster").fill("1");
  await expect(
    dialog.getByRole("checkbox", { name: "Passport", exact: true }),
  ).not.toBeChecked();
  await dialog.getByRole("checkbox", { name: "Passport", exact: true }).check();
  await dialog.getByRole("button", { name: /Review & finish/ }).click();
  await page.screenshot({
    path: `.local/launchpad-review/${info.project.name}-setup-review.png`,
  });
  await dialog
    .getByRole("button", { name: "Finish setup", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "From an idea to opening day." }),
  ).toBeVisible();
  await expect(page.getByText("0 slots", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open registration", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: /Confirm court availability/ })
    .click();
  await page
    .getByRole("button", { name: "Confirm availability", exact: true })
    .click();
  await dialog.getByLabel("Start (America/Toronto)").fill("2099-03-07T10:00");
  await dialog.getByLabel("End (America/Toronto)").fill("2099-03-07T13:00");
  await dialog
    .getByRole("button", { name: "Confirm availability", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await navigate(page, "Launchpad");
  await expect(page.getByText("3 slots", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `.local/launchpad-review/${info.project.name}-launch-overview.png`,
  });
  const id = await page.getByLabel("Switch league").inputValue();
  const w = await api(page, "workspace", { league_id: id });
  expect(w.data.preseason.divisions).toHaveLength(6);
  expect(w.data.preseason.settings.registration_status).toBe("draft");
  expect(w.data.site_published).toBe(false);
  const copied = await api(page, "copy", { league_id: id });
  expect(copied.status).toBe(200);
  expect(copied.data.data.opening).toBe("");
  expect(copied.data.data.courts).toHaveLength(1);
  expect(copied.data.data.divisions).toHaveLength(6);
});
test("website themes, sanitized logo, draft isolation and explicit publication work on real Next routes", async ({
  page,
  request,
}, info) => {
  test.setTimeout(180000);
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  await login(page);
  await page.getByLabel("Switch league").selectOption(fixture.league);
  await navigate(page, "Launchpad");
  await page
    .getByRole("button", { name: "League website", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Live draft preview" }),
  ).toBeVisible();
  const logo = await sharp({
    create: { width: 128, height: 128, channels: 3, background: "#164d3b" },
  })
    .png()
    .withMetadata({ exif: { IFD0: { Copyright: "SYNTHETIC LOGO TEST" } } })
    .toBuffer();
  await page.getByLabel("League logo", { exact: true }).setInputFiles({
    name: "synthetic-logo.png",
    mimeType: "image/png",
    buffer: logo,
  });
  for (const theme of ["community", "arena", "courtside"]) {
    await page.getByLabel("Website theme").selectOption(theme);
    await page
      .getByLabel("Public headline", { exact: true })
      .fill(`A season for everyone. ${theme}`);
    await page.getByRole("button", { name: "Mobile", exact: true }).click();
    await expect(page.locator(".site-preview-frame")).toHaveClass(
      /preview-mobile/,
    );
    await page.getByRole("button", { name: "Desktop", exact: true }).click();
    const publicBefore = await (
      await request.get(`/league/${fixture.slug}/website`)
    ).text();
    expect(publicBefore).not.toContain(`A season for everyone. ${theme}`);
    await page
      .getByRole("button", { name: "Save website draft", exact: true })
      .click();
    await expect(page.locator(".launch-notice")).toContainText(
      "Website draft saved privately",
    );
    const draftOnly = await (
      await request.get(`/league/${fixture.slug}/website`)
    ).text();
    expect(draftOnly).not.toContain(`A season for everyone. ${theme}`);
    await expect(
      page.getByRole("button", { name: "Publish saved website", exact: true }),
    ).toBeDisabled();
    await page.getByLabel(/I reviewed the saved public copy/).check();
    await page
      .getByRole("button", { name: "Publish saved website", exact: true })
      .click();
    await expect(page.locator(".launch-notice")).toContainText(
      "Website published",
    );
    const published = await (
      await request.get(`/league/${fixture.slug}/website`)
    ).text();
    expect(published).toContain(`A season for everyone. ${theme}`);
    expect(published).not.toContain("private-organizer@example.invalid");
    expect(published).not.toContain("guardian_email");
    const view = await page.context().newPage();
    await view.goto(`/league/${fixture.slug}/website`);
    await expect(
      view.getByRole("heading", {
        name: `A season for everyone. ${theme}`,
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await view.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await view.screenshot({
      path: `.local/launchpad-review/${info.project.name}-website-${theme}.png`,
      fullPage: true,
    });
    await view.close();
  }
  await page
    .getByRole("button", { name: "Unpublish website", exact: true })
    .click();
  await expect(page.locator(".launch-notice")).toContainText(
    "Website unpublished",
  );
  const unpublished = await (
    await request.get(`/league/${fixture.slug}/website`)
  ).text();
  expect(unpublished).not.toContain("A season for everyone. courtside");
  await page.getByLabel(/I reviewed the saved public copy/).check();
  await page
    .getByRole("button", { name: "Publish saved website", exact: true })
    .click();
});
test("pre-account private invitation requires confirmed matching Auth identity and enforces coach restrictions", async ({
  page,
  browser,
  request,
}, info) => {
  test.setTimeout(180000);
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  const email = `new-coach-${info.project.name}-${Date.now()}@example.invalid`;
  await login(page);
  await page.getByLabel("Switch league").selectOption(fixture.league);
  await navigate(page, "Launchpad");
  await page.getByLabel("Invited email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Create private invitation", exact: true })
    .click();
  const capability = await page
    .getByLabel("Private member invitation")
    .inputValue();
  expect(capability).toContain("/join#invite=");
  // The test Auth adapter permits only .invalid synthetic identities. No email is sent.
  const signup = await request.post("http://127.0.0.1:3302/auth/v1/signup", {
    data: { email, password },
  });
  expect(signup.ok()).toBe(true);
  const context = await browser.newContext({
    ...info.project.use,
    baseURL: "http://127.0.0.1:3301",
  });
  const invitee = await context.newPage();
  try {
    await invitee.goto(capability);
    await expect(invitee).toHaveURL(/\/join$/);
    await expect(
      invitee.getByRole("button", { name: "Accept league invitation" }),
    ).toHaveCount(0);
    await invitee
      .getByLabel("Invited email", { exact: true })
      .fill("launchpad-outsider@example.invalid");
    await invitee.getByLabel("Password", { exact: true }).fill(password);
    await invitee.getByRole("button", { name: "Sign in", exact: true }).click();
    await invitee
      .getByRole("button", { name: "Accept league invitation" })
      .click();
    await expect(invitee.locator(".launch-error")).toContainText(
      "Access denied",
    );
    await invitee.getByRole("button", { name: "Use another account" }).click();
    await invitee.getByLabel("Invited email", { exact: true }).fill(email);
    await invitee.getByLabel("Password", { exact: true }).fill(password);
    await invitee.getByRole("button", { name: "Sign in", exact: true }).click();
    await invitee
      .getByRole("button", { name: "Accept league invitation" })
      .click();
    await expect(
      invitee.getByRole("heading", { name: "You’re part of the league." }),
    ).toBeVisible();
    await invitee
      .getByRole("link", { name: "Open your league workspace" })
      .click();
    await expect(invitee.getByLabel("Switch league")).toHaveValue(
      fixture.league,
    );
    await expect(
      invitee.getByRole("button", { name: "Launchpad", exact: true }),
    ).toHaveCount(0);
    const denied = await api(invitee, "workspace", {
      league_id: fixture.league,
    });
    expect(denied.status).toBe(403);
    await navigate(invitee, "Preseason Onboarding");
    await expect(invitee.getByText("Loading preseason…")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
test("quick setup allows direct configuration and copy path starts with fresh dates", async ({
  page,
  request,
}) => {
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  await login(page);
  await navigate(page, "System settings & access");
  await page
    .getByRole("button", { name: "Create league", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /I know what I need/ }).click();
  await dialog.getByRole("button", { name: /Rules & safety/ }).click();
  await dialog.getByLabel("Minimum active roster", { exact: true }).fill("7");
  await dialog.getByRole("button", { name: /League basics/ }).click();
  await expect(dialog.getByLabel("League name", { exact: true })).toHaveValue(
    "",
  );
  await dialog.getByRole("button", { name: "Save draft & exit" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create league", exact: true })
    .click();
  await dialog.getByRole("button", { name: /Copy a previous season/ }).click();
  await dialog
    .getByLabel("Previous season", { exact: true })
    .selectOption(fixture.league);
  await dialog
    .getByRole("button", { name: "Copy configuration", exact: true })
    .click();
  await expect(dialog.getByLabel("League name", { exact: true })).toHaveValue(
    "Toronto Community Hoops",
  );
  await dialog.getByRole("button", { name: /Season & divisions/ }).click();
  await expect(
    dialog.getByLabel("Expected opening day", { exact: true }),
  ).toHaveValue("");
  await expect(
    dialog.getByLabel("Age eligibility cutoff", { exact: true }),
  ).toHaveValue("");
  await dialog.getByRole("button", { name: /Facilities/ }).click();
  await expect(dialog.getByLabel("Court 1 name", { exact: true })).toHaveValue(
    "North Court",
  );
  await dialog.getByRole("button", { name: "Save draft & exit" }).click();
  await expect(dialog).toHaveCount(0);
});

test("administrator edits the existing season without creating a replacement workspace", async ({
  page,
  request,
}) => {
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  await login(page);
  await page.getByLabel("Switch league").selectOption(fixture.league);
  await navigate(page, "Launchpad");
  const before = await api(page, "workspace", { league_id: fixture.league });
  const expected = before.data.setup.expectedTeams + 1;
  await page.getByRole("button", { name: /Shape the season/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Expected number of teams", { exact: true })
    .fill(String(expected));
  await dialog.getByRole("button", { name: /Review & finish/ }).click();
  await dialog
    .getByRole("button", { name: "Finish setup", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Switch league")).toHaveValue(fixture.league);
  await expect(
    page.getByText(`0 / ${expected}`, { exact: true }),
  ).toBeVisible();
  const after = await api(page, "workspace", { league_id: fixture.league });
  expect(
    after.data.preseason.divisions.map((d: { id: string }) => d.id).sort(),
  ).toEqual(
    before.data.preseason.divisions.map((d: { id: string }) => d.id).sort(),
  );
  expect(after.data.site_published).toBe(before.data.site_published);
});
test("PR 1 legacy public website preserves approved reference data without signup", async ({
  page,
}, info) => {
  await page.goto("/league/northstar-demo/website");
  await expect(
    page.getByRole("heading", { name: "Northstar Youth League", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("12", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Every result counts.", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/launchpad-review/${info.project.name}-legacy-website.png`,
    fullPage: true,
  });
});
test("stale existing-season draft returns HTTP 409, preserves newer safety rules and all records", async ({
  page,
  request,
}) => {
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  await login(page);
  await page.getByLabel("Switch league").selectOption(fixture.league);
  await navigate(page, "Launchpad");
  const initial = await api(page, "workspace", { league_id: fixture.league });
  await page.getByRole("button", { name: /Shape the season/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("League name", { exact: true })
    .fill("STALE NAME MUST NOT APPLY");
  await dialog.getByRole("button", { name: /Rules & safety/ }).click();
  await expect(
    dialog.getByLabel("Minimum active roster", { exact: true }),
  ).toHaveValue("5");
  await expect(dialog.locator(".setup-save-status")).toContainText(
    "Draft saved privately",
  );
  const saved = await page.evaluate(
    async ({ league, payload }) => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      )!;
      const token = JSON.parse(localStorage.getItem(key)!).access_token;
      const r = await fetch("/api/preseason", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ league, action: "configure", payload }),
      });
      return { status: r.status, data: await r.json() };
    },
    {
      league: fixture.league,
      payload: {
        ...initial.data.preseason.settings,
        questionnaire_deadline: new Date(
          initial.data.preseason.settings.questionnaire_deadline,
        ).toISOString(),
        roster_deadline: new Date(
          initial.data.preseason.settings.roster_deadline,
        ).toISOString(),
        verification_deadline: new Date(
          initial.data.preseason.settings.verification_deadline,
        ).toISOString(),
        season_name: initial.data.setup.season,
        cutoff_date: initial.data.setup.cutoff,
        season_start: initial.data.setup.opening,
        min_roster: 7,
      },
    },
  );
  expect(saved.status).toBe(200);
  const snapshot = async () =>
    page.evaluate(async (league) => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      )!;
      return fetch("/api/league?id=" + league, {
        headers: {
          Authorization:
            "Bearer " + JSON.parse(localStorage.getItem(key)!).access_token,
        },
      }).then((r) => r.json());
    }, fixture.league);
  const before = await snapshot();
  const safetyBefore = await api(page, "workspace", {
    league_id: fixture.league,
  });
  await dialog.getByRole("button", { name: /Review & finish/ }).click();
  const conflict = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/launchpad") &&
      r.request().postDataJSON()?.action === "finish",
  );
  await dialog
    .getByRole("button", { name: "Finish setup", exact: true })
    .click();
  expect((await conflict).status()).toBe(409);
  await expect(dialog.locator(".launch-error")).toContainText(
    "reload the current league",
  );
  await expect(dialog.locator(".launch-error")).toContainText("fresh edit");
  expect(await snapshot()).toEqual(before);
  expect(
    (await api(page, "workspace", { league_id: fixture.league })).data,
  ).toEqual(safetyBefore.data);
  await dialog.getByRole("button", { name: /League basics/ }).click();
  await expect(dialog.getByLabel("League name", { exact: true })).toHaveValue(
    "STALE NAME MUST NOT APPLY",
  );
  await dialog.getByRole("button", { name: "Save draft & exit" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /Shape the season/ }).click();
  await dialog.getByRole("button", { name: /Rules & safety/ }).click();
  await expect(
    dialog.getByLabel("Minimum active roster", { exact: true }),
  ).toHaveValue("7");
  await dialog.getByRole("button", { name: /Review & finish/ }).click();
  await dialog
    .getByRole("button", { name: "Finish setup", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await api(page, "workspace", { league_id: fixture.league })).data.preseason
      .settings.min_roster,
  ).toBe(7);
  // Restore only this local synthetic fixture for the next viewport's regression.
  const current = await api(page, "workspace", { league_id: fixture.league });
  const restored = await page.evaluate(
    async ({ league, payload }) => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      )!;
      const r = await fetch("/api/preseason", {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " + JSON.parse(localStorage.getItem(key)!).access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ league, action: "configure", payload }),
      });
      return r.status;
    },
    {
      league: fixture.league,
      payload: {
        ...current.data.preseason.settings,
        questionnaire_deadline: new Date(
          current.data.preseason.settings.questionnaire_deadline,
        ).toISOString(),
        roster_deadline: new Date(
          current.data.preseason.settings.roster_deadline,
        ).toISOString(),
        verification_deadline: new Date(
          current.data.preseason.settings.verification_deadline,
        ).toISOString(),
        season_name: current.data.setup.season,
        cutoff_date: current.data.setup.cutoff,
        season_start: current.data.setup.opening,
        min_roster: 5,
      },
    },
  );
  expect(restored).toBe(200);
});
