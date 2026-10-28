import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parse } from "dotenv";
test.use({ trace: "off", video: "off", screenshot: "off" });
test("temporary judge roles explore only their synthetic seasons without signup email", async ({
  browser,
}, info) => {
  test.skip(
    !existsSync(".local/demo-manifest.json"),
    "Prepare private judge fixtures first",
  );
  test.setTimeout(180000);
  const fixture = JSON.parse(readFileSync(".local/demo-manifest.json", "utf8"));
  const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
  test.skip(
    fixture.origin !== origin,
    "Fixture belongs to a different deployment",
  );
  const env = parse(readFileSync(".env.local"));
  const anonymous = await fetch(origin + "/api/league?public=true").then((r) =>
    r.json(),
  );
  const expectedIds = [
    fixture.operations.league,
    fixture.preseason.league,
  ].sort();
  for (const role of ["admin", "coach"] as const) {
    const c = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const signed = await c.auth.signInWithPassword(fixture.accounts[role]);
    expect(Boolean(signed.error)).toBe(false);
    const token = signed.data.session!.access_token;
    const headers = { Authorization: "Bearer " + token };
    const choices = await fetch(origin + "/api/league", { headers }).then((r) =>
      r.json(),
    );
    expect(choices.map((l: { id: string }) => l.id).sort()).toEqual(
      expectedIds,
    );
    for (const l of anonymous) {
      const r = await fetch(`${origin}/api/league?id=${l.id}`, { headers });
      expect(r.status).toBe(403);
    }
    const context = await browser.newContext({
      ...info.project.use,
      baseURL: origin,
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.getByText("12 approved for competition")).toBeVisible();
      if (info.project.name === "mobile")
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Email address")
        .fill(fixture.accounts[role].email);
      await dialog
        .getByLabel("Password", { exact: true })
        .fill(fixture.accounts[role].password)
        .catch(() => {
          throw new Error("Judge password entry failed; value redacted");
        });
      await dialog
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      await page
        .getByLabel("Switch league")
        .selectOption(fixture.preseason.league);
      await page
        .getByRole("button", { name: "Preseason Onboarding", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Coach assessment and placement",
          exact: true,
        }),
      ).toBeVisible();
      if (role === "coach")
        await expect(
          page.getByRole("button", {
            name: "Approve preseason placement",
            exact: true,
          }),
        ).toHaveCount(0);
      if (info.project.name === "mobile")
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
      await page
        .getByRole("button", { name: "Meta AI activity", exact: true })
        .click();
      await expect(
        page.getByText(/Meta is paused until credits are confirmed/),
      ).toBeVisible();
      if (role === "admin") {
        const evidence = await fetch(
          `${origin}/api/evidence?league=${fixture.preseason.league}`,
          { headers },
        ).then((r) => r.json());
        expect(Array.isArray(evidence.evidence)).toBe(true);
        if (evidence.evidence.length)
          await expect(
            page.getByText("Actual Meta response", { exact: true }).first(),
          ).toBeVisible();
        else
          await expect(
            page.getByRole("heading", {
              name: "No live Meta evidence recorded",
            }),
          ).toBeVisible();
      } else
        await expect(
          page.getByText(
            "Only authorized league administrators can inspect model-response history.",
          ),
        ).toBeVisible();
    } finally {
      await context.close();
    }
  }
  const parentContext = await browser.newContext({ ...info.project.use });
  try {
    const page = await parentContext.newPage();
    await page.goto(fixture.preseason.invitationUrl).catch(() => {
      throw new Error("Guardian page did not open; capability redacted");
    });
    await expect(
      page.getByRole("heading", { name: "Fictional Demo Player", exact: true }),
    ).toBeVisible();
    expect(
      new URL(page.url()).hash.length === 0,
      "Private capability removed from visible URL",
    ).toBe(true);
    await expect(
      page.getByRole("button", {
        name: "Submit proof and guardian consent",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await parentContext.close();
  }
});
