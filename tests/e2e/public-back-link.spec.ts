import { test, expect } from "@playwright/test";
import fs from "node:fs";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.LAUNCHPAD_LOCAL_PREVIEW !== "true",
  "Existing local synthetic preview required",
);
test("signed-out homepage and every public theme have a direct, visible header return link", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Run the league/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore a working demo league ↗", exact: true })
    .click();
  const back = page
    .locator("header")
    .getByRole("link", { name: "← Back to Courtside AI", exact: true });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("href", "/");
  await back.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: /Run the league/ }),
  ).toBeVisible();
  const pubs = await (await request.get("/api/league?public=true")).json();
  const leagues = pubs.filter(
    (l: { name: string; slug: string }) =>
      l.name === "Harbour Hoops League" || l.slug === "northstar-demo",
  );
  expect(leagues).toHaveLength(4);
  fs.mkdirSync(".local/public-back-link", { recursive: true });
  for (const l of leagues) {
    await page.goto(`/league/${l.slug}/website`);
    const link = page
      .locator("header")
      .getByRole("link", { name: "← Back to Courtside AI", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/");
    await expect(page.locator("header nav")).toBeVisible();
    await expect(
      page.locator("header img,header .launchpad-legacy-site-emblem"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Powered by Courtside AI", exact: true }),
    ).toHaveAttribute("href", "/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const box = await link.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      info.project.use.viewport?.height ?? 844,
    );
    await link.focus();
    await expect(link).toBeFocused();
    const website = page.locator(".league-website");
    const theme = (await website.count())
      ? await website.getAttribute("class")
      : null;
    await page.screenshot({
      path: `.local/public-back-link/${info.project.name}-${theme?.match(/site-(arena|community|courtside)/)?.[1] ?? "legacy"}.png`,
    });
    await link.click();
    await expect(
      page.getByRole("heading", { name: /Run the league/ }),
    ).toBeVisible();
  }
});
