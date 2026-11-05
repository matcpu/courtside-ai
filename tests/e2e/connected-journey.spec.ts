import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.LAUNCHPAD_LOCAL_PREVIEW !== "true",
  "Requires existing synthetic loopback demo",
);
test.setTimeout(120000);
let password: string;
test.beforeAll(async ({ request }) => {
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  password = fixture.password;
});
async function homeDemo(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Run the league/ }),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Explore a working demo league ↗", exact: true })
    .getAttribute("href");
  expect(href).toMatch(/^\/league\/.+\/website$/);
  const slug = href!.split("/")[2];
  const pubs = await (await page.request.get("/api/league?public=true")).json();
  const league = pubs.find((l: { slug: string }) => l.slug === slug);
  expect(league).toBeTruthy();
  return { ...league, href };
}
async function signIn(page: Page, email = "launchpad-admin@example.invalid") {
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
async function token(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    )!;
    return JSON.parse(localStorage.getItem(key)!).access_token;
  });
}
async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(".local/connected-journey", { recursive: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/connected-journey/${name}-${project}.png`,
  });
}

test("A/D: product homepage opens the real Scoreboard demo and its product links return home", async ({
  page,
}, info) => {
  const demo = await homeDemo(page);
  await expect(page.getByLabel("Switch league")).toHaveCount(0);
  await expect(page.getByText("Spring 2099", { exact: false })).toHaveCount(0);
  await shot(page, "01-homepage", info.project.name);
  await page
    .getByRole("link", { name: "Explore a working demo league ↗", exact: true })
    .click();
  await expect(page.locator(".site-courtside")).toBeVisible();
  await expect(page.locator(".site-featured-games .site-game")).toHaveCount(4);
  await expect(page.getByRole("link", { name: /Manage league/ })).toHaveCount(
    0,
  );
  await expect(
    page
      .locator(".site-header")
      .getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await shot(page, "02-scoreboard", info.project.name);
  await page
    .getByRole("link", { name: "Powered by Courtside AI", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: /Run the league/ }),
  ).toBeVisible();
  expect(demo.name).toBe("Harbour Hoops League");
});

test("B/C: actual organizer sign-in requires a league choice and keeps the same league across website and dashboard", async ({
  page,
}, info) => {
  const demo = await homeDemo(page);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Choose your league.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Switch league")).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Find your league" })
    .fill("Harbour");
  await expect(
    page.locator(".product-league-card").filter({
      has: page.getByText("Scoreboard demo workspace", { exact: true }),
    }),
  ).toHaveCount(1);
  await shot(page, "03-league-selection", info.project.name);
  await page
    .locator(`.product-league-card[href="/workspace/${demo.id}"]`)
    .click();
  await expect(page.getByLabel("Switch league")).toHaveValue(demo.id);
  await expect(
    page.getByRole("heading", { name: "Your league. In sync.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View league website", exact: true }),
  ).toHaveAttribute("href", demo.href);
  await shot(page, "04-organizer-dashboard", info.project.name);
  await page
    .getByRole("link", { name: "View league website", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(demo.href + "$"));
  await expect(
    page.locator(".site-header").getByRole("link", { name: /Manage league/ }),
  ).toBeVisible();
  await shot(page, "05-authorized-website", info.project.name);
  await page
    .locator(".site-header")
    .getByRole("link", { name: /Manage league/ })
    .click();
  await expect(page).toHaveURL(new RegExp("/workspace/" + demo.id + "$"));
  await expect(page.getByLabel("Switch league")).toHaveValue(demo.id);
  await page
    .getByRole("link", { name: "View league website", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Powered by Courtside AI", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose your league.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Switch league")).toHaveCount(0);
});

test("E: unsigned and unauthorized users cannot open a private workspace or mutate its publication", async ({
  page,
  request,
}, info) => {
  const demo = await homeDemo(page);
  expect((await request.get("/api/league?id=" + demo.id)).status()).toBe(401);
  expect(
    (await request.get("/api/workspace-access?league=" + demo.id)).status(),
  ).toBe(401);
  await page.goto("/workspace/" + demo.id);
  await expect(
    page.getByRole("heading", { name: "Sign in to your league.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await signIn(page, "launchpad-outsider@example.invalid");
  await expect(
    page.getByRole("heading", { name: "League access required.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  const headers = { Authorization: "Bearer " + (await token(page)) };
  expect(
    (await request.get("/api/league?id=" + demo.id, { headers })).status(),
  ).toBe(403);
  expect(
    (
      await request.get("/api/workspace-access?league=" + demo.id, { headers })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/launchpad", {
        headers,
        data: { action: "site_unpublish", payload: { league_id: demo.id } },
      })
    ).status(),
  ).toBe(403);
  const choices = await (await request.get("/api/league", { headers })).json();
  expect(choices.some((l: { id: string }) => l.id === demo.id)).toBe(false);
  await shot(page, "06-access-denied", info.project.name);
  await page.goto(demo.href);
  await expect(page.getByRole("link", { name: /Manage league/ })).toHaveCount(
    0,
  );
});

test("public create-league link reuses existing authentication and five-step setup", async ({
  page,
}) => {
  const demo = await homeDemo(page);
  await page.goto(demo.href);
  await page
    .getByRole("link", { name: "Create your own league ↗", exact: true })
    .click();
  await expect(page).toHaveURL(/\?action=create$/);
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Email address")).toBeVisible();
  await d.getByLabel("Email address").fill("launchpad-admin@example.invalid");
  await d.getByLabel("Password", { exact: true }).fill(password);
  await d.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    d.getByRole("button", { name: /Help me set up a league/ }),
  ).toBeVisible();
  await expect(
    d.getByRole("button", { name: /Copy a previous season/ }),
  ).toBeVisible();
  await expect(
    d.getByRole("button", { name: /I know what I need/ }),
  ).toBeVisible();
  await d.getByRole("button", { name: "Close dialog", exact: true }).click();
});

test("all three website themes and the legacy public website have authorized product navigation", async ({
  page,
  request,
}) => {
  await homeDemo(page);
  const pubs = await (await request.get("/api/league?public=true")).json();
  const themes = pubs.filter(
    (l: { name: string }) => l.name === "Harbour Hoops League",
  );
  expect(themes).toHaveLength(3);
  await signIn(page);
  for (const l of themes) {
    await page.goto(`/league/${l.slug}/website`);
    await expect(
      page.getByRole("link", { name: "Powered by Courtside AI", exact: true }),
    ).toHaveAttribute("href", "/");
    await expect(
      page.getByRole("link", { name: "Create your own league ↗", exact: true }),
    ).toHaveAttribute("href", "/?action=create");
    await expect(
      page.locator(".site-header").getByRole("link", { name: /Manage league/ }),
    ).toHaveAttribute("href", "/workspace/" + l.id);
    await page
      .locator(".site-header")
      .getByRole("link", { name: /Manage league/ })
      .click();
    await expect(page.getByLabel("Switch league")).toHaveValue(l.id);
    await expect(
      page.getByRole("link", { name: "View league website", exact: true }),
    ).toHaveAttribute("href", `/league/${l.slug}/website`);
  }
  await page.goto("/league/northstar-demo/website");
  await expect(
    page.getByRole("link", { name: "Powered by Courtside AI", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("link", { name: "Create your own league ↗", exact: true }),
  ).toBeVisible();
});

test("a coach retains their authorized workspace but cannot acquire organizer controls", async ({
  page,
  request,
}) => {
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  await homeDemo(page);
  await signIn(page, "launchpad-coach@example.invalid");
  await expect(
    page.getByRole("heading", { name: "Choose your league.", exact: true }),
  ).toBeVisible();
  await page.goto("/workspace/" + fixture.league);
  await expect(page.getByLabel("Switch league")).toHaveValue(fixture.league);
  const headers = { Authorization: "Bearer " + (await token(page)) };
  const access = await request.get(
    "/api/workspace-access?league=" + fixture.league,
    { headers },
  );
  expect(access.status()).toBe(200);
  expect((await access.json()).canManage).toBe(false);
  expect(
    (
      await request.post("/api/launchpad", {
        headers,
        data: {
          action: "site_unpublish",
          payload: { league_id: fixture.league },
        },
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/league/${fixture.slug}/website`);
  await expect(page.getByRole("link", { name: /Manage league/ })).toHaveCount(
    0,
  );
  await expect(
    page
      .locator(".site-header")
      .getByRole("link", { name: "Your leagues", exact: true }),
  ).toBeVisible();
});

test("legacy public portal keeps sign-in visible outside the sidebar and returns signed-in users to league selection", async ({
  page,
}, info) => {
  await page.goto("/league/northstar-demo");
  await expect(page.getByText("12 approved for competition")).toBeVisible();
  await page.locator(".sidebar").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    page
      .locator(".topbar")
      .getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await shot(page, "07-header-sign-in", info.project.name);
  await signIn(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Choose your league.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Switch league")).toHaveCount(0);
});
