import { test, expect } from "@playwright/test";
test("judge sees honest account creation and email test restrictions", async ({
  page,
  request,
}, info) => {
  const health = await (await request.get("/api/health")).json();
  await page.goto("/league/northstar-demo");
  await expect(page.getByText("12 approved for competition")).toBeVisible();
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "New here? Create an account", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Your next season starts here." }),
  ).toBeVisible();
  if (health.emailMode === "test")
    await expect(
      dialog.getByText(
        /Email confirmations are currently restricted to the authorized test inbox/,
      ),
    ).toBeVisible();
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute(
    "minlength",
    "12",
  );
  await expect(dialog.getByLabel("Email address")).toBeEmpty();
});
