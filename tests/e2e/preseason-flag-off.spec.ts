import { test, expect } from "@playwright/test";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.PRESEASON_FLAG_OFF !== "true",
  "Requires isolated flag-off build",
);
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL).toBe("http://127.0.0.1:3301");
});
test("Preseason remains configurable without a link to disabled expanded Launchpad", async ({
  page,
  request,
}, info) => {
  expect(info.project.use.baseURL ?? "http://127.0.0.1:3301").toBe(
    "http://127.0.0.1:3301",
  );
  const fixture = await (
    await request.get("http://127.0.0.1:3302/__preview")
  ).json();
  await page.goto("/");
  const nav = async (name: string) => {
    const m = page.getByRole("button", {
      name: "Open navigation",
      exact: true,
    });
    if (
      (await m.isVisible()) &&
      !(await page
        .locator(".sidebar")
        .evaluate((e) => e.classList.contains("sidebar-open")))
    )
      await m.click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  await nav("Sign in");
  const d = page.getByRole("dialog");
  await d.getByLabel("Email address").fill(fixture.accounts.admin);
  await d.getByLabel("Password", { exact: true }).fill(fixture.password);
  await d.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(d).toHaveCount(0);
  await page.goto(`/workspace/${fixture.league}`);
  await expect(page.getByLabel("Switch league")).toHaveValue(fixture.league);
  await nav("Preseason Onboarding");
  await expect(
    page.getByRole("button", { name: "League configuration", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Season rules & eligibility", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Passport", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Save season rules", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Season rules saved");
  expect((await request.get("/api/launchpad")).status()).toBe(404);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
