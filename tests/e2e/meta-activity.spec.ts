import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
test.use({ trace: "off", video: "off", screenshot: "off" });
test("saved Meta evidence has working entry points without starting inference", async ({
  page,
}, info) => {
  test.skip(
    !existsSync(".local/demo-manifest.json"),
    "Private judge fixture required",
  );
  test.setTimeout(90000);
  const f = JSON.parse(readFileSync(".local/demo-manifest.json", "utf8"));
  await page.goto("/");
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Email address").fill(f.accounts.admin.email);
  await d
    .getByLabel("Password", { exact: true })
    .fill(f.accounts.admin.password);
  await d.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(d).toHaveCount(0);
  await page.getByLabel("Switch league").selectOption(f.operations.league);
  await page
    .getByRole("button", { name: "Meta AI activity", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Intelligence for a fairer season." }),
  ).toBeVisible();
  await expect(page.getByText(/Live AI processing is paused/)).toBeVisible();
  await expect(page.locator(".ai-capability")).toHaveCount(3);
  // Evaluation envelopes must not be misrepresented as primary score extractions.
  await expect(page.locator(".ai-score")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Start a new AI run", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: ".local/release-meta-" + info.project.name + ".png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Explore saved agent run", exact: true })
    .click();
  const receipt = page.locator(".history-list > details[open]");
  await expect(receipt).toHaveCount(1);
  await expect(
    receipt.getByRole("heading", { name: "Inspect the league", exact: true }),
  ).toBeVisible();
  await expect(
    receipt.getByRole("heading", {
      name: "Prepare a schedule draft",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    receipt.getByText("Riverside Ravens", { exact: true }),
  ).toBeVisible();
  await expect(
    receipt.getByText(/Current record: approved/).first(),
  ).toBeVisible();
  await expect(
    receipt.getByText(/saved proposal belongs to Riverside Ravens/),
  ).toBeVisible();
  await expect(receipt.locator(".ai-original")).not.toHaveAttribute("open");
  await receipt.locator(".ai-original > summary").click();
  await expect(receipt.locator(".ai-original code").first()).toContainText(
    "resp_",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
