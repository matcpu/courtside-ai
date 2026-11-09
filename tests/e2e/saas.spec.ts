import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
test.use({
  trace: "off",
  video: "off",
  screenshot: "off",
  actionTimeout: 15000,
  navigationTimeout: 30000,
});
test.skip(
  process.env.SAAS_LOCAL_REVIEW !== "true",
  "Requires isolated synthetic SaaS review runtime",
);
test.setTimeout(180000);
const backend = "http://127.0.0.1:3502";
async function fixture(page: Page) {
  return (await page.request.get(backend + "/__preview")).json();
}
async function login(
  page: Page,
  f: any,
  email = f.accounts.admin,
  url = "/organizations",
) {
  await page.goto(url);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Organizations", exact: true }),
  ).toBeVisible();
}
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      const token = key
        ? JSON.parse(localStorage.getItem(key)!).access_token
        : "";
      const r = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body },
  );
}
async function shot(page: Page, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  fs.mkdirSync(".local/saas-review", { recursive: true });
  await page.screenshot({
    path: `.local/saas-review/${name}.png`,
    fullPage: true,
    mask: [page.getByLabel("Private invitation link")],
  });
}
async function setupSeason(page: Page, name: string) {
  const d = page.getByRole("dialog");
  await d.getByLabel("Primary city").fill("Toronto");
  await d
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("hockey");
  await d.getByRole("button", { name: /Season & divisions/ }).click();
  for (const [label, value] of [
    ["Season name", name],
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
  await d.getByRole("button", { name: /Rules & safety/ }).click();
  await d.getByRole("checkbox", { name: "Passport", exact: true }).check();
  await d.getByRole("button", { name: /Review & finish/ }).click();
  await d.getByRole("button", { name: "Finish setup", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\//);
  await expect(page.getByLabel("Switch league")).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2];
}
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL).toBe("http://127.0.0.1:3501");
});
test("owner creates organization, league and two hockey seasons; plan is Free and billing stays disabled", async ({
  page,
}, info) => {
  const f = await fixture(page);
  await login(page, f);
  const orgName = `Synthetic Business ${info.project.name} ${Date.now()}`;
  await page.getByLabel("New organization name").fill(orgName);
  await page
    .getByRole("button", { name: "Create organization", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: orgName, exact: true }),
  ).toBeVisible();
  const id = await page.getByLabel("Selected organization").inputValue();
  await page
    .getByLabel("Organization name", { exact: true })
    .fill(orgName + " Updated");
  await page
    .getByRole("button", { name: "Save organization", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: orgName + " Updated", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("effective-plan")).toContainText("free");
  await expect(
    page.getByRole("button", { name: "Test checkout: Pro", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await api(page, "/api/billing", {
        organization_id: id,
        action: "checkout",
        plan: "pro",
      })
    ).status,
  ).toBe(503);
  await page
    .getByLabel("League name", { exact: true })
    .fill("Synthetic Hockey Business");
  await page.getByRole("button", { name: "Add league", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Set up season for Synthetic Hockey Business",
      exact: true,
    })
    .click();
  const first = await setupSeason(page, "Synthetic Spring 2099");
  const s = await api(page, `/api/league?id=${first}&public=false`);
  expect(s.data.league).toMatchObject({ organization_id: id, sport: "hockey" });
  await page.getByRole("link", { name: "Organization", exact: true }).click();
  await expect(page.getByLabel("Selected organization")).toHaveValue(id);
  await page
    .getByRole("button", {
      name: "Set up season for Synthetic Hockey Business",
      exact: true,
    })
    .click();
  const second = await setupSeason(page, "Synthetic Summer 2099");
  expect(second).not.toBe(first);
  const w = await api(page, `/api/league?id=${second}&public=false`);
  expect(w.data.league.program_id).toBe(s.data.league.program_id);
  await page.getByRole("link", { name: "Organization", exact: true }).click();
  await expect(page.getByLabel("Selected organization")).toHaveValue(id);
  await expect(page.locator(".saas-program")).toContainText(
    "Synthetic Spring 2099",
  );
  await expect(page.locator(".saas-program")).toContainText(
    "Synthetic Summer 2099",
  );
  await shot(page, `${info.project.name}-organization-seasons`);
});
test("invitation fragment, explicit league grant and revocation enforce independent tenant boundaries", async ({
  page,
  browser,
}, info) => {
  const f = await fixture(page);
  await login(
    page,
    f,
    f.accounts.admin,
    `/organizations?organization=${f.saas.organization}`,
  );
  const target = `synthetic-invited-${info.project.name}@example.invalid`;
  // Local adapter only: a synthetic confirmed account, no email provider involved.
  const signup = await page.request.post(backend + "/auth/v1/signup", {
    data: { email: target, password: f.password },
  });
  expect(signup.ok()).toBe(true);
  const account = (await signup.json()).user;
  await page.getByLabel("Invite account email").fill(target);
  await page
    .getByRole("button", { name: "Create invitation link", exact: true })
    .click();
  const href = await page.getByLabel("Private invitation link").inputValue();
  expect(href).toContain("/organizations#invite=");
  const token = new URL(href).hash.split("=")[1];
  const ctx = await browser.newContext({
    viewport:
      info.project.name === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
  });
  const invited = await ctx.newPage();
  let exposed = false;
  invited.on("request", (r) => {
    if (r.url().includes(token)) exposed = true;
  });
  await login(invited, f, target, href);
  await expect(invited).not.toHaveURL(/#invite/);
  await invited
    .getByRole("button", {
      name: "Accept organization invitation",
      exact: true,
    })
    .click();
  await expect(invited.getByLabel("Selected organization")).toHaveValue(
    f.saas.organization,
  );
  expect(
    (await api(invited, `/api/league?id=${f.saas.season}&public=false`)).status,
  ).toBe(403);
  expect(exposed).toBe(false);
  await page.reload();
  const member = page.locator(".saas-member").filter({ hasText: account.id });
  await member
    .getByRole("button", {
      name: /Grant league admin: Synthetic Private Hockey/,
    })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Explicit league administrator access granted",
  );
  expect(
    (await api(invited, `/api/league?id=${f.saas.season}&public=false`)).data
      .role,
  ).toBe("admin");
  await member
    .getByRole("button", { name: "Remove organization member", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Organization membership removed",
  );
  expect(
    (await api(invited, `/api/league?id=${f.saas.season}&public=false`)).status,
  ).toBe(403);
  expect(
    (
      await api(invited, "/api/organizations", {
        action: "accept",
        payload: { token },
      })
    ).status,
  ).toBe(403);
  await shot(page, `${info.project.name}-organization-permissions`);
  await ctx.close();
});
test("platform administrator sees operational aggregates; other organization owners are denied", async ({
  page,
}, info) => {
  const f = await fixture(page);
  await login(page, f);
  await page.goto("/platform");
  await expect(
    page.getByRole("heading", { name: "Platform administration", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic Separate Organization",
      exact: true,
    }),
  ).toBeVisible();
  const overview = await api(page, "/api/platform");
  expect(overview.status).toBe(200);
  expect(JSON.stringify(overview.data)).not.toContain("birth_date");
  expect(JSON.stringify(overview.data)).not.toContain("guardian_email");
  await shot(page, `${info.project.name}-platform-overview`);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, f, f.accounts.outsider);
  expect((await api(page, "/api/platform")).status).toBe(403);
  expect(
    (await api(page, `/api/organizations?organization=${f.saas.organization}`))
      .status,
  ).toBe(403);
  await page.goto("/platform");
  await expect(page.getByRole("status")).toContainText(
    "Platform administrator access required",
  );
  await expect(
    page.getByRole("heading", {
      name: "Synthetic Demo Organization",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("account change and foreign organization deep link never select or retain an unrelated tenant", async ({
  page,
}) => {
  const f = await fixture(page);
  await login(
    page,
    f,
    f.accounts.admin,
    `/organizations?organization=${f.saas.organization}`,
  );
  await expect(page.getByLabel("Selected organization")).toHaveValue(
    f.saas.organization,
  );
  await page
    .getByLabel("Invite account email")
    .fill("synthetic-unsaved@example.invalid");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Organization team", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(f.accounts.outsider);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Selected organization")).toHaveValue("");
  await expect(
    page.getByRole("heading", {
      name: "Synthetic Demo Organization",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByLabel("Selected organization").selectOption(f.saas.foreign);
  await expect(page.getByLabel("Invite account email")).toHaveValue("");
});
