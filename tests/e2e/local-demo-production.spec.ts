import { test, expect } from "@playwright/test";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.INTERACTIVE_DEMO_PRODUCTION_TEST !== "true",
  "Production-artifact negative test against loopback only",
);
test("a production build rejects automatic demo authentication even with local preview enabled", async ({
  page,
  request,
  context,
}) => {
  expect((await request.get("/api/local-demo-session")).status()).toBe(404);
  expect(
    (
      await request.post("/api/local-demo-session", {
        headers: { Origin: "http://127.0.0.1:3301" },
        data: { enabled: true },
      })
    ).status(),
  ).toBe(404);
  await context.addCookies([
    {
      name: "courtside_local_preview",
      value: "forged-client-demo-session",
      url: "http://127.0.0.1:3301",
    },
  ]);
  expect((await context.request.get("/api/league")).status()).toBe(401);
  expect(
    (
      await context.request.post("/api/league", {
        headers: { Origin: "http://127.0.0.1:3301", "x-local-preview": "true" },
        data: {
          league: null,
          action: "create_league",
          payload: {
            name: "Must not create",
            season: "Synthetic",
            cutoff: "2026-09-01",
          },
        },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("LAUNCHPAD_LOCAL_PREVIEW", "true"),
  );
  await page
    .locator(".product-header")
    .getByRole("button", { name: "Create a league ↗", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Email address"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open demo dashboard ↗", exact: true }),
  ).toHaveCount(0);
});
