import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import sharp from "sharp";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.LAUNCHPAD_LOCAL_PREVIEW !== "true",
  "Loopback synthetic adapter only",
);
const origin = "http://127.0.0.1:3301";
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL).toBe(origin);
});
async function nav(page: Page, name: string) {
  const m = page.getByRole("button", { name: "Open navigation", exact: true });
  if (
    (await m.isVisible()) &&
    !(await page
      .locator(".sidebar")
      .evaluate((e) => e.classList.contains("sidebar-open")))
  )
    await m.click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function login(page: Page, email: string) {
  await page.goto("/");
  await nav(page, "Sign in");
  const d = page.getByRole("dialog");
  await d.getByLabel("Email address").fill(email);
  await d.getByLabel("Password", { exact: true }).fill("SyntheticPreview!2099");
  await d.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(d).toHaveCount(0);
}
async function call(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const k = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      const token = k ? JSON.parse(localStorage.getItem(k)!).access_token : "";
      const r = await fetch(path, {
        signal: AbortSignal.timeout(15000),
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body },
  );
}
const proof = () =>
  sharp(
    Buffer.from(
      '<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="600" fill="white"/><g fill="black" font-size="35"><text x="40" y="90">SYNTHETIC PASSPORT - NOT VALID</text><text x="40" y="180">Name: Fictional Comet Player</text><text x="40" y="250">Date of birth: 2087-02-03</text><text x="40" y="350">TEST RECORD ONLY</text></g></svg>',
    ),
  )
    .png()
    .toBuffer();
async function overflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("admin, coach and guardian complete proof review, resubmission and explicit declaration policy", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(10000);
  fs.mkdirSync(".local/preseason-review", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "launchpad-admin@example.invalid");
  const baseline = await page.request.get(
    origin + "/league/northstar-demo/website",
  );
  const before = await baseline.text();
  const created = await call(page, "/api/league", {
    league: null,
    action: "create_league",
    payload: {
      name: "Synthetic UX " + info.project.name + " " + Date.now(),
      season: "Synthetic 2099",
      cutoff: "2099-01-01",
    },
  });
  expect(created.status).toBe(200);
  const league = created.data.id;
  const pre = (action: string, payload: unknown) =>
    call(page, "/api/preseason", { league, action, payload });
  await page.reload();
  await page.getByLabel("Switch league").selectOption(league);
  await nav(page, "Preseason Onboarding");
  await expect(
    page.getByText("Start with a team.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage roster & guardian links" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Season rules & eligibility", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Passport", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Birth certificate", exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("Season name", { exact: true }).fill("Synthetic 2099");
  await page.getByLabel("Opening weekend", { exact: true }).fill("2099-03-07");
  await page.getByLabel("Age cutoff date", { exact: true }).fill("2099-01-01");
  await page
    .getByLabel("Registration status", { exact: true })
    .selectOption("open");
  await page.getByLabel("Minimum active roster", { exact: true }).fill("1");
  for (const [label, date] of [
    ["Questionnaire", "2099-02-01T12:00"],
    ["Roster", "2099-02-15T12:00"],
    ["Verification", "2099-02-28T12:00"],
  ])
    await page
      .getByLabel(label + " deadline (device timezone)", { exact: true })
      .fill(date);
  await page
    .getByRole("button", { name: "Save season rules", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("alert"),
  ).toContainText("Select at least one accepted document");
  await expect(
    page.locator(".preseason-workspace").getByRole("alert"),
  ).toBeFocused();
  await page.getByRole("checkbox", { name: "Passport", exact: true }).focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Save season rules", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Season rules saved");
  await page
    .getByRole("button", { name: "Refresh preseason", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Passport", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Birth certificate", exact: true }),
  ).not.toBeChecked();
  await overflow(page);
  await page.screenshot({
    path: ".local/preseason-review/" + info.project.name + "-rules-after.png",
    fullPage: true,
  });
  await call(page, "/api/league", {
    league,
    action: "invite_member",
    payload: { email: "launchpad-coach@example.invalid", role: "coach" },
  });
  const coachContext = await browser.newContext(info.project.use);
  const coach = await coachContext.newPage();
  coach.setDefaultTimeout(10000);
  await login(coach, "launchpad-coach@example.invalid");
  await coach.getByLabel("Switch league").selectOption(league);
  await nav(coach, "Preseason Onboarding");
  await expect(
    coach.getByRole("button", {
      name: "Season rules & eligibility",
      exact: true,
    }),
  ).toHaveCount(0);
  await coach
    .getByRole("button", { name: "Register a new team", exact: true })
    .click();
  await coach
    .getByLabel("Preseason team name", { exact: true })
    .fill("Fictional Comets");
  await coach
    .getByLabel("Previous league", { exact: true })
    .fill("Synthetic League");
  await coach
    .getByLabel("Previous division", { exact: true })
    .fill("Competitive");
  await coach.getByLabel("Previous season wins", { exact: true }).fill("8");
  await coach.getByLabel("Previous season losses", { exact: true }).fill("4");
  await coach.getByLabel("Typical winning margin", { exact: true }).fill("12");
  await coach.getByLabel("Typical losing margin", { exact: true }).fill("8");
  await coach
    .getByLabel("Returning player percentage", { exact: true })
    .fill("70");
  await coach
    .getByLabel("Experienced competitive players", { exact: true })
    .fill("5");
  await coach
    .getByLabel("Competitive experience level", { exact: true })
    .selectOption("3");
  await coach.getByLabel("Years together", { exact: true }).fill("2");
  await coach.getByLabel("Practices per week", { exact: true }).fill("2");
  await coach
    .getByRole("button", { name: "Save questionnaire draft", exact: true })
    .click();
  await expect(
    coach.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Draft saved");
  await coach.reload();
  await nav(coach, "Preseason Onboarding");
  await coach
    .getByLabel("Preseason team", { exact: true })
    .selectOption({ label: "Fictional Comets" });
  await coach
    .getByRole("button", { name: "Submit questionnaire", exact: true })
    .click();
  await expect(
    coach.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Questionnaire submitted");
  const snapshot = await call(page, "/api/preseason?league=" + league);
  const team = snapshot.data.teams[0].id;
  await page
    .getByRole("button", { name: "Teams & players", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Refresh preseason", exact: true })
    .click();
  await page.getByLabel("Preseason team", { exact: true }).selectOption(team);
  if (
    !(await page
      .locator(".preseason-assessment")
      .evaluate((d: HTMLDetailsElement) => d.open))
  )
    await page.locator(".preseason-assessment > summary").click();
  await page
    .getByRole("button", { name: "Approve preseason placement", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Placement approved");
  await coach
    .getByLabel("Player name (synthetic for demo)", { exact: true })
    .fill("Fictional Comet Player");
  await coach.getByLabel("Jersey number", { exact: true }).fill("7");
  await coach
    .getByLabel("Declared birth date", { exact: true })
    .fill("2087-02-03");
  await coach
    .getByRole("button", { name: "Add preseason player", exact: true })
    .click();
  await expect(
    coach.getByRole("heading", { name: "#7 Fictional Comet Player" }),
  ).toBeVisible();
  await coach
    .getByRole("button", { name: "Invite guardian to verify age", exact: true })
    .click();
  await expect(
    coach.getByLabel("New guardian invitation link", { exact: true }),
  ).toBeVisible();
  const invite = await coach
    .getByLabel("New guardian invitation link", { exact: true })
    .inputValue();
  await coach
    .getByRole("button", {
      name: "Submit roster for preseason review",
      exact: true,
    })
    .click();
  await expect(
    coach.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Roster submitted");
  await overflow(coach);
  await coach.screenshot({
    path: ".local/preseason-review/" + info.project.name + "-team-after.png",
    fullPage: true,
  });
  const gc = await browser.newContext(info.project.use);
  const guardian = await gc.newPage();
  guardian.setDefaultTimeout(10000);
  await guardian.goto(invite);
  await expect(
    guardian.getByRole("radio", { name: "Passport", exact: true }),
  ).toBeVisible();
  await expect(
    guardian.getByRole("radio", { name: "Birth certificate", exact: true }),
  ).toHaveCount(0);
  await expect(
    guardian.getByRole("radio", { name: "Passport", exact: true }),
  ).not.toBeChecked();
  await expect(guardian).not.toHaveURL(/invite=/);
  await guardian.getByRole("radio", { name: "Passport", exact: true }).check();
  await guardian
    .getByLabel("Guardian full name", { exact: true })
    .fill("Synthetic Guardian");
  const [fileChooser] = await Promise.all([
    guardian.waitForEvent("filechooser"),
    guardian
      .getByRole("button", { name: "Upload an existing photo", exact: true })
      .click(),
  ]);
  await fileChooser.setFiles({
    name: "synthetic-passport.png",
    mimeType: "image/png",
    buffer: await proof(),
  });
  await expect(
    guardian.getByAltText("Selected proof of age preview"),
  ).toBeVisible();
  await overflow(guardian);
  await guardian.screenshot({
    path:
      ".local/preseason-review/" + info.project.name + "-guardian-after.png",
    fullPage: true,
  });
  await guardian
    .getByRole("checkbox", { name: /I confirm the recorded/ })
    .check();
  await guardian.getByRole("checkbox", { name: /I am the parent/ }).check();
  await guardian
    .getByRole("button", {
      name: "Submit proof and guardian consent",
      exact: true,
    })
    .click();
  await expect(guardian.getByText(/Proof and consent submitted/)).toBeVisible({
    timeout: 40000,
  });
  await page
    .getByRole("button", { name: "Age verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Refresh preseason", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Comet Player · passport",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /I inspected the original/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Open private proof of age", exact: true })
    .click();
  await expect(
    page.getByAltText("Private proof of age for Fictional Comet Player"),
  ).toBeVisible();
  expect(
    await page
      .getByAltText("Private proof of age for Fictional Comet Player")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  const signedProof = await page
    .getByAltText("Private proof of age for Fictional Comet Player")
    .getAttribute("src");
  const rawProof = new URL(signedProof!);
  rawProof.pathname = rawProof.pathname.replace("/object/sign/", "/object/");
  rawProof.search = "";
  expect((await gc.request.get(rawProof.href)).status()).toBe(403);
  await page
    .getByLabel("Review reason for Fictional Comet Player", { exact: true })
    .fill("Please send a clearer synthetic passport image.");
  await page
    .getByRole("button", { name: "Record verification decision", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("decision recorded");
  await guardian
    .getByRole("button", { name: "Refresh verification status", exact: true })
    .click();
  await expect(
    guardian.getByText("Please send a clearer synthetic passport image.", {
      exact: false,
    }),
  ).toBeVisible();
  await guardian
    .getByLabel("Guardian full name", { exact: true })
    .fill("Synthetic Guardian");
  await guardian.getByRole("radio", { name: "Passport", exact: true }).check();
  await guardian
    .getByLabel("Proof of age photo", { exact: true })
    .setInputFiles({
      name: "synthetic-passport-retry.png",
      mimeType: "image/png",
      buffer: await proof(),
    });
  await guardian
    .getByRole("checkbox", { name: /I confirm the recorded/ })
    .check();
  await guardian.getByRole("checkbox", { name: /I am the parent/ }).check();
  await guardian
    .getByRole("button", {
      name: "Submit proof and guardian consent",
      exact: true,
    })
    .click();
  await expect(guardian.getByText(/Proof and consent submitted/)).toBeVisible({
    timeout: 40000,
  });
  await page
    .getByRole("button", { name: "Refresh preseason", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open private proof of age", exact: true })
    .click();
  await page
    .getByLabel("Review decision for Fictional Comet Player", { exact: true })
    .selectOption("approved");
  await page
    .getByLabel("Review reason for Fictional Comet Player", { exact: true })
    .fill(
      "Inspected original synthetic proof and checked consent and age rules.",
    );
  await page
    .getByRole("checkbox", { name: /I inspected the original/ })
    .check();
  await page
    .getByRole("button", { name: "Record verification decision", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("decision recorded");
  let data = (await call(page, "/api/preseason?league=" + league)).data;
  expect(data.readiness[0].eligible_for_scheduling).toBe(true);
  expect(data.readiness[0].verified).toBe(1);
  // Private object cannot be read by a coach or a signed-out visitor using a raw path.
  const unauth = await gc.request.get(
    "http://127.0.0.1:3302/storage/v1/object/youth-documents/" +
      league +
      "/nonexistent.png",
  );
  expect(unauth.status()).toBe(403);
  await page.screenshot({
    path:
      ".local/preseason-review/" +
      info.project.name +
      "-verification-after.png",
    fullPage: true,
  });
  // An older setup draft must not restore a policy changed in Preseason.
  const opened = await call(page, "/api/launchpad", {
    action: "begin_edit",
    payload: { league_id: league },
  });
  expect(opened.status).toBe(200);
  const stale = await call(page, "/api/launchpad", {
    action: "save_draft",
    payload: {
      id: opened.data.id,
      revision: opened.data.revision,
      league_id: league,
      data: {
        ...opened.data.data,
        city: "Toronto",
        start: "2099-03-01",
        end: "2099-06-30",
      },
    },
  });
  expect(stale.status).toBe(200);
  await page
    .getByRole("button", { name: "Season rules & eligibility", exact: true })
    .click();
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await page
    .getByRole("checkbox", { name: /I understand this changes the evidence/ })
    .check();
  await page
    .getByRole("button", { name: "Save season rules", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Season rules saved");
  const rejected = await call(page, "/api/launchpad", {
    action: "finish",
    payload: { id: stale.data.id, revision: stale.data.revision },
  });
  expect(rejected.status).toBe(409);
  data = (await call(page, "/api/preseason?league=" + league)).data;
  expect(data.settings.proof_required).toBe(false);
  expect(data.settings.enabled).toBe(true);
  expect(data.settings.allowed_document_types).toEqual(["passport"]);
  const denied = await call(coach, "/api/preseason", {
    league,
    action: "review_declaration",
    payload: {
      player_id: data.players[0].id,
      decision: "approved",
      reason: "Coach cannot review this declaration",
      details_checked: true,
      duplicate_acknowledged: false,
    },
  });
  expect(denied.status).toBe(403);

  await coach
    .getByRole("button", { name: "Refresh preseason", exact: true })
    .click();
  await coach
    .getByLabel("Player name (synthetic for demo)", { exact: true })
    .fill("Fictional Declaration Player");
  await coach.getByLabel("Jersey number", { exact: true }).fill("8");
  await coach
    .getByLabel("Declared birth date", { exact: true })
    .fill("2087-02-04");
  await coach
    .getByRole("button", { name: "Add preseason player", exact: true })
    .click();
  await coach
    .getByRole("button", { name: "Invite guardian to verify age", exact: true })
    .click();
  const declarationRegion = coach.getByRole("region", {
    name: "Private guardian link for Fictional Declaration Player",
    exact: true,
  });
  await expect(declarationRegion).toBeVisible();
  const declarationInvite = await declarationRegion
    .getByLabel("New guardian invitation link", { exact: true })
    .inputValue();
  await coach
    .getByRole("button", {
      name: "Submit roster for preseason review",
      exact: true,
    })
    .click();
  await guardian.goto(declarationInvite, {
    waitUntil: "commit",
    timeout: 10000,
  });
  await expect(
    guardian.getByRole("heading", {
      name: "Confirm details and provide consent",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    guardian.getByRole("button", { name: "Take a photo", exact: true }),
  ).toHaveCount(0);
  await guardian
    .getByRole("checkbox", { name: /I confirm the recorded/ })
    .check();
  await guardian.getByRole("checkbox", { name: /I am the parent/ }).check();
  await guardian
    .getByRole("button", { name: "Submit guardian confirmation", exact: true })
    .click();
  await expect(
    guardian.getByText(/Guardian confirmation submitted for a human/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Age verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Refresh preseason", exact: true })
    .click();
  await page
    .getByRole("combobox", {
      name: "Declaration decision for Fictional Declaration Player",
      exact: true,
    })
    .selectOption("approved");
  await page
    .getByRole("textbox", {
      name: "Declaration review reason for Fictional Declaration Player",
      exact: true,
    })
    .fill(
      "Reviewed guardian declaration, cutoff age and consent under the no-document policy.",
    );
  await page
    .getByRole("checkbox", { name: /I reviewed the guardian confirmation/ })
    .check();
  await page
    .getByRole("button", { name: "Record declaration decision", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("No document was verified");
  data = (await call(page, "/api/preseason?league=" + league)).data;
  expect(data.readiness[0].eligible_for_scheduling).toBe(true);
  expect(data.readiness[0].verified).toBe(1);
  expect(data.readiness[0].eligible_players).toBe(2);
  await page
    .getByRole("button", { name: "Season rules & eligibility", exact: true })
    .click();
  await page.getByRole("radio", { name: "Yes", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "Passport", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: /I understand this changes the evidence/ })
    .check();
  await page
    .getByRole("button", { name: "Save season rules", exact: true })
    .click();
  await expect(
    page.locator(".preseason-workspace").getByRole("status"),
  ).toContainText("Season rules saved");
  data = (await call(page, "/api/preseason?league=" + league)).data;
  expect(data.readiness[0].eligible_for_scheduling).toBe(false);
  expect(
    data.players.find(
      (p: any) => p.display_name === "Fictional Declaration Player",
    ).verification_status,
  ).toBe("not_invited");
  const after = await (
    await page.request.get(origin + "/league/northstar-demo/website")
  ).text();
  for (const text of ["Northstar Youth League", "12", "Every result counts."]) {
    expect(before).toContain(text);
    expect(after).toContain(text);
  }
  await overflow(page);
  if (info.project.name === "desktop") {
    await page.setViewportSize({ width: 640, height: 480 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await overflow(page);
    await expect(
      page.getByRole("button", { name: "Save season rules", exact: true }),
    ).toBeEnabled();
  }
  expect(errors).toEqual([]);
  await gc.close();
  await coachContext.close();
});

test("guardian camera preview, retake, confirmation, cancellation and upload fallback require explicit submit", async ({
  page,
  context,
}, info) => {
  test.setTimeout(90000);
  // A synthetic capability response isolates camera behavior; no uploaded proof is manufactured.
  const state = {
    invitation_id: "ee000000-0000-4000-8000-000000000001",
    child: { name: "Synthetic Camera Child", birth_date: "2087-02-03" },
    league: "Synthetic Camera League",
    team: "Fictional Comets",
    status: "invited",
    guardian_consent: false,
    expires_at: "2099-02-28T12:00:00Z",
    deadline: "2099-02-28T12:00:00Z",
    retention_days: 14,
    allowed_document_types: ["passport"],
    proof_required: true,
    review_reason: null,
    can_submit: true,
  };
  let submissions = 0;
  await page.route("**/api/guardian", (r) => {
    const action = r.request().postDataJSON()?.action;
    if (action && action !== "exchange") submissions++;
    return r.fulfill({ json: state });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 600;
        const c = canvas.getContext("2d")!;
        c.fillStyle = "white";
        c.fillRect(0, 0, 900, 600);
        c.fillStyle = "black";
        c.font = "35px sans-serif";
        c.fillText("SYNTHETIC CAMERA DOCUMENT", 40, 150);
        const stream = canvas.captureStream(15);
        (window as any).__testStream = stream;
        return stream;
      },
    });
  });
  await page.goto("/verify#invite=" + "a".repeat(43));
  await page.getByRole("radio", { name: "Passport", exact: true }).check();
  await page.getByRole("button", { name: "Take a photo", exact: true }).click();
  await expect(
    page.getByLabel("Live camera preview", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Capture photo", exact: true })
    .click();
  await expect(page.getByAltText("Captured photo to review")).toBeVisible();
  await page.getByRole("button", { name: "Retake photo", exact: true }).click();
  await expect(
    page.getByLabel("Live camera preview", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Capture photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Use photo", exact: true }).click();
  await expect(
    page.getByAltText("Selected proof of age preview"),
  ).toBeVisible();
  expect(submissions).toBe(0);
  expect(
    await page.evaluate(() =>
      (window as any).__testStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Take a photo", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel camera", exact: true })
    .click();
  await page.getByLabel("Proof of age photo", { exact: true }).setInputFiles({
    name: "synthetic-existing.png",
    mimeType: "image/png",
    buffer: await proof(),
  });
  await expect(
    page.getByAltText("Selected proof of age preview"),
  ).toBeVisible();
  expect(submissions).toBe(0);
  await overflow(page);
});
