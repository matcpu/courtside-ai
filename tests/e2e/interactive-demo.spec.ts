import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.INTERACTIVE_DEMO_TEST !== "true",
  "Loopback development preview only",
);
test.setTimeout(240000);
const origin = "http://127.0.0.1:3301";
async function command(page: Page, action: string, payload: unknown) {
  const r = await page.request.post("/api/launchpad", {
    headers: { Origin: origin },
    data: { action, payload },
  });
  expect(r.status(), await r.text()).toBe(200);
  return r.json();
}
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
async function capture(page: Page, name: string, project: string) {
  fs.mkdirSync(".local/interactive-demo", { recursive: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/interactive-demo/${name}-${project}.png`,
  });
}

test("fresh browser completes guided setup, customization, publication and dashboard return without credentials", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const dashboard = page
    .locator(".product-header")
    .getByRole("link", { name: "Open demo dashboard ↗", exact: true });
  await expect(dashboard).toBeVisible({ timeout: 60000 });
  const status = await (
    await page.request.get("/api/local-demo-session")
  ).json();
  expect(status.user.id).toBeTruthy();
  expect(JSON.stringify(status)).not.toContain("access_token");
  const cookies = await context.cookies();
  const cookie = cookies.find((c) => c.name === "courtside_local_preview");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect(
    await page.evaluate(() =>
      document.cookie.includes("courtside_local_preview"),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.endsWith("-auth-token")),
    ),
  ).toBe(false);
  await capture(page, "01-homepage", info.project.name);
  await dashboard.click();
  await expect(page.getByLabel("Switch league")).toHaveValue(status.demo.id, {
    timeout: 60000,
  });
  await page.goto("/");
  await expect(
    page
      .locator(".product-header")
      .getByRole("link", { name: "Open demo dashboard ↗", exact: true }),
  ).toBeVisible();
  await page
    .locator(".product-header")
    .getByRole("button", { name: "Create a league ↗", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await expect(
    d.getByRole("heading", { name: "League basics", exact: true }),
  ).toBeVisible();
  await expect(d.getByLabel("Email address")).toHaveCount(0);
  const name = `Harbour Spring · ${info.project.name} · ${Date.now()}`;
  await d.getByLabel("League name", { exact: true }).fill(name);
  await d.getByLabel("Primary city", { exact: true }).fill("Toronto");
  await d.getByRole("button", { name: /Season & divisions/ }).click();
  for (const [label, value] of Object.entries({
    "Season name": "Spring 2027",
    "Season start": "2027-03-01",
    "Season end": "2027-06-30",
    "Expected opening day": "2027-03-06",
    "Age eligibility cutoff": "2027-01-01",
    "Registration / questionnaire deadline": "2027-02-01",
    "Roster deadline": "2027-02-15",
    "Verification deadline": "2027-02-28",
  }))
    await d.getByLabel(label, { exact: true }).fill(value);
  for (let i = 1; i <= 3; i++)
    await d.getByLabel(`Division ${i} minimum age`, { exact: true }).fill("12");
  await d.getByRole("button", { name: /Facilities/ }).click();
  await d.getByRole("button", { name: "Add a court", exact: true }).click();
  await d.getByLabel("Court 1 name", { exact: true }).fill("Harbour Court A");
  await d
    .getByLabel("Court 1 venue / address", { exact: true })
    .fill("Harbour Community Centre · Toronto");
  await d.getByRole("button", { name: /Rules & safety/ }).click();
  await d.getByLabel("Maximum active roster", { exact: true }).fill("12");
  await d.getByRole("checkbox", { name: "Passport", exact: true }).check();
  await d.getByRole("button", { name: /Review & finish/ }).click();
  await expect(
    d.getByRole("button", { name: "Finish setup", exact: true }),
  ).toBeEnabled();
  await capture(page, "02-guided-review", info.project.name);
  await d.getByRole("button", { name: "Finish setup", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(page.locator(".launchpad")).toBeVisible({ timeout: 60000 });
  const id = await page.getByLabel("Switch league").inputValue();
  expect(id).not.toBe(status.demo.id);
  await expect(page).toHaveURL(new RegExp("/workspace/" + id));
  const w = await command(page, "workspace", { league_id: id });
  expect(w.site_published).toBe(false);
  await page
    .getByRole("button", { name: "League website", exact: true })
    .click();
  const theme = page.getByRole("combobox", {
    name: "Website theme",
    exact: true,
  });
  await expect(theme).toHaveValue("courtside");
  for (const value of ["arena", "community", "courtside"]) {
    await theme.selectOption(value);
    await expect(
      page.locator(".site-preview-frame .site-" + value),
    ).toBeVisible();
  }
  await page
    .getByLabel("Public headline", { exact: true })
    .fill("Spring basketball, together.");
  await page
    .getByLabel("About the league", { exact: true })
    .fill(
      "A synthetic youth basketball league for the local interactive demonstration. All teams, venues and results are fictional.",
    );
  await page
    .getByLabel("League logo", { exact: true })
    .setInputFiles(".local/launchpad-design-v2/harbour-hoops-1024.png");
  await expect(
    page.locator(".site-preview-frame .site-brand img"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save website draft", exact: true })
    .click();
  await expect(page.locator(".launch-notice")).toContainText("saved privately");
  await capture(page, "03-customization", info.project.name);
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
  const site = await command(page, "site_preview", { league_id: id });
  expect(site.config.theme).toBe("courtside");
  const href = `/league/${site.league.slug}/website`;
  await page.goto(href);
  await expect(page.locator(".site-courtside")).toBeVisible();
  await expect(
    page.locator(".site-header").getByRole("link", { name: /Manage league/ }),
  ).toHaveAttribute("href", "/workspace/" + id, { timeout: 60000 });
  await capture(page, "04-published-scoreboard", info.project.name);
  await page
    .locator(".site-header")
    .getByRole("link", { name: /Manage league/ })
    .click();
  await expect(page.getByLabel("Switch league")).toHaveValue(id);
  await expect(
    page.getByRole("link", { name: "View league website", exact: true }),
  ).toHaveAttribute("href", href);
  await capture(page, "05-returned-dashboard", info.project.name);
  const current = await (
    await page.request.get("/api/local-demo-session")
  ).json();
  expect(current.user.id).toBe(status.user.id);
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `.local/interactive-demo/journey-${info.project.name}.json`,
    JSON.stringify(
      {
        id,
        name,
        website: origin + href,
        dashboard: origin + "/workspace/" + id,
        sessionUser: current.user.id,
        credentialsEntered: false,
        publicationExplicitlyApproved: true,
        passed: true,
      },
      null,
      2,
    ),
  );
});

test("server sessions are isolated and reject original-league access, forged cookies and cross-origin writes", async ({
  page,
  browser,
  request,
}) => {
  await page.goto("/");
  await expect(
    page
      .locator(".product-header")
      .getByRole("link", { name: "Open demo dashboard ↗", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const a = await (await page.request.get("/api/local-demo-session")).json();
  expect(
    (
      await page.request.get(
        "/api/league?id=6f3c65a0-338d-4910-af4f-f2081174406b",
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/local-demo-session", {
        headers: { Origin: "https://attacker.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/league", {
        data: {
          league: null,
          action: "create_league",
          payload: { name: "Cross-site must fail" },
        },
      })
    ).status(),
  ).toBe(401);
  const other = await browser.newContext({ baseURL: origin });
  const second = await other.newPage();
  await second.goto("/");
  await expect(
    second
      .locator(".product-header")
      .getByRole("link", { name: "Open demo dashboard ↗", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const b = await (await second.request.get("/api/local-demo-session")).json();
  expect(b.user.id).not.toBe(a.user.id);
  expect(b.demo.id).not.toBe(a.demo.id);
  expect(
    (await second.request.get("/api/league?id=" + a.demo.id)).status(),
  ).toBe(403);
  expect((await page.request.get("/api/league?id=" + b.demo.id)).status()).toBe(
    403,
  );
  await other.close();
  const forged = await browser.newContext({ baseURL: origin });
  await forged.addCookies([
    { name: "courtside_local_preview", value: "x".repeat(43), url: origin },
  ]);
  expect((await forged.request.get("/api/league")).status()).toBe(401);
  await forged.close();
  expect(
    (
      await request.post("/api/local-demo-session", {
        headers: { Origin: "https://attacker.invalid" },
        data: { enabled: true, role: "admin" },
      })
    ).status(),
  ).toBe(403);
});

test("an immediate Create click from a fresh page opens guided setup, and Explore stays in that demo session", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".product-header")
    .getByRole("button", { name: "Create a league ↗", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await expect(
    d.getByRole("heading", { name: "League basics", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(d.getByLabel("Email address")).toHaveCount(0);
  await d
    .getByRole("button", { name: "Save draft & exit", exact: true })
    .click();
  await expect(d).toHaveCount(0);
  const status = await (
    await page.request.get("/api/local-demo-session")
  ).json();
  await page
    .locator(".product-header")
    .getByRole("link", { name: "Explore demo", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(status.demo.href + "$"));
  await expect(page.locator(".site-courtside")).toBeVisible();
  await expect(
    page.locator(".site-header").getByRole("link", { name: /Manage league/ }),
  ).toHaveAttribute("href", status.dashboard, { timeout: 60000 });
});
