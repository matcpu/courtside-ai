import { test, expect } from "@playwright/test";
test("real public league dashboard and schedule", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your league. In sync." }),
  ).toBeVisible();
  await expect(page.getByText("FICTIONAL DEMO LEAGUE")).toBeVisible();
  await expect(page.getByText("12 approved for competition")).toBeVisible();
  await page
    .getByRole("button", { name: "View schedule", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Published fixtures" }),
  ).toBeVisible();
  await expect(page.getByText("Published · v1")).toBeVisible();
});
test("public API protects youth and coach privacy", async ({ request }) => {
  const leagues = await (await request.get("/api/league?public=true")).json();
  expect(leagues.length).toBeGreaterThan(0);
  const response = await request.get(
    `/api/league?id=${leagues[0].id}&public=true`,
  );
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.teams).toHaveLength(12);
  expect(data.players).toEqual([]);
  expect(data.scoresheets).toEqual([]);
  expect(JSON.stringify(data)).not.toContain("coach_email");
  expect(JSON.stringify(data)).not.toContain("birth_date");
  expect(JSON.stringify(data)).not.toContain("storage_path");
});
test("unauthenticated workflow commands are rejected", async ({ request }) => {
  for (const url of [
    "/api/league",
    "/api/schedule",
    "/api/scoresheet",
    "/api/agent",
    "/api/notifications",
    "/api/demo",
    "/api/register",
  ]) {
    const response = await request.post(url, { data: {} });
    expect(response.status(), url).toBe(401);
  }
});
test("private results cannot be read with public privileges", async ({
  request,
}) => {
  const leagues = await (await request.get("/api/league?public=true")).json();
  expect((await request.get(`/api/league?id=${leagues[0].id}`)).status()).toBe(
    401,
  );
});
test("public standings and team search work", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("12 approved for competition")).toBeVisible();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Teams & rosters", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search teams" }).fill("Eastside");
  await expect(
    page.getByRole("heading", { name: "Eastside Eagles" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Northside Falcons" }),
  ).toHaveCount(0);
});
test("layout fits viewport and no client errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("12 approved for competition")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
