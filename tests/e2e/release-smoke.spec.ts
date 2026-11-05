import { test, expect } from "@playwright/test";
import fs from "node:fs";

test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.RELEASE_SMOKE !== "true",
  "Explicit read-only remote release check",
);

test("HTTPS preview connects the public journey and denies private/demo administration", async ({
  page,
  context,
  baseURL,
}, info) => {
  test.setTimeout(120000);
  const origin = new URL(baseURL!).origin;
  expect(new URL(origin).protocol).toBe("https:");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.RELEASE_ACCESS_URL || origin);
  await expect(
    page.getByRole("heading", { name: /Run the league/ }),
  ).toBeVisible();
  await expect(
    page
      .locator(".product-header")
      .getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open demo dashboard ↗", exact: true }),
  ).toHaveCount(0);
  const fits = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  await fits();
  fs.mkdirSync(".local/release-candidate/screenshots", { recursive: true });
  await page.screenshot({
    path: `.local/release-candidate/screenshots/homepage-${info.project.name}.png`,
  });
  await page
    .locator(".product-header")
    .getByRole("button", { name: "Create a league ↗", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Email address"),
  ).toBeVisible();
  // No credentials entered, account created, email sent or hosted mutation attempted with authentication.
  await page.goto(origin);
  await page
    .getByRole("link", { name: "Explore a working demo league ↗", exact: true })
    .click();
  const back = page
    .locator("header")
    .getByRole("link", { name: "← Back to Courtside AI", exact: true });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("href", "/");
  await fits();
  await page.screenshot({
    path: `.local/release-candidate/screenshots/public-website-${info.project.name}.png`,
  });
  const publicWebsite = page.url();
  await back.click();
  await expect(page).toHaveURL(origin + "/");
  const request = context.request;
  const healthResponse = await request.get(origin + "/api/health");
  expect(healthResponse.status()).toBe(200);
  const health = await healthResponse.json();
  expect(health.database).toBe(true);
  expect(health.meta).toBe(false);
  expect(health.metaEnabled).toBe(false);
  expect(health.emailMode).toBe("disabled");
  expect(health.sms).toBe(false);
  const directory = await (
    await request.get(origin + "/api/league?public=true")
  ).json();
  const reference = directory.find(
    (row: { slug: string }) => row.slug === "northstar-demo",
  );
  expect(reference).toBeTruthy();
  const data = await (
    await request.get(origin + `/api/league?id=${reference.id}&public=true`)
  ).json();
  expect(data.players).toEqual([]);
  expect(data.scoresheets).toEqual([]);
  for (const field of [
    "birth_date",
    "coach_email",
    "storage_path",
    "guardian_email",
  ])
    expect(JSON.stringify(data)).not.toContain(field);
  await context.addCookies([
    { name: "courtside_local_preview", value: "x".repeat(43), url: origin },
  ]);
  expect((await request.get(origin + "/api/local-demo-session")).status()).toBe(
    404,
  );
  expect(
    (
      await request.post(origin + "/api/local-demo-session", {
        headers: { Origin: origin },
        data: { enabled: true },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await request.get(origin + `/api/league?id=${reference.id}`)).status(),
  ).toBe(401);
  expect(
    (
      await request.get(origin + `/api/workspace-access?league=${reference.id}`)
    ).status(),
  ).toBe(401);
  for (const endpoint of [
    "league",
    "schedule",
    "scoresheet",
    "agent",
    "notifications",
    "demo",
    "register",
  ])
    expect(
      (
        await request.post(origin + "/api/" + endpoint, {
          headers: { Origin: origin, "x-local-preview": "true" },
          data: {},
        })
      ).status(),
      endpoint,
    ).toBe(401);
  await page.goto(origin + `/workspace/${reference.id}`);
  await expect(
    page.getByRole("heading", { name: "Sign in to your league.", exact: true }),
  ).toBeVisible();
  await fits();
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `.local/release-candidate/remote-${info.project.name}.json`,
    JSON.stringify(
      {
        origin,
        publicWebsite,
        checkedAt: new Date().toISOString(),
        meta: false,
        outboundDisabled: true,
        publicRedaction: true,
        unauthenticatedAdministrationDenied: true,
        credentialsEntered: false,
        hostedWrites: false,
      },
      null,
      2,
    ),
  );
});
