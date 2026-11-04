import sharp from "sharp";
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
test.use({ trace: "off", video: "off", screenshot: "off" });
test("camera lifecycle, fallbacks, local validation and explicit upload retry", async ({
  page,
  context,
}, info) => {
  test.skip(
    !process.env.E2E_CAMERA_FEED || !existsSync(".local/camera-audit.json"),
    "Opt-in synthetic Chrome camera feed required",
  );
  test.setTimeout(180000);
  const f = JSON.parse(readFileSync(".local/camera-audit.json", "utf8")),
    account = f.accounts[info.project.name + "_admin"],
    env = parse(readFileSync(".env.local")),
    origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
  const c = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
    signed = await c.auth.signInWithPassword(account);
  expect(signed.error).toBeNull();
  const headers = {
    Authorization: "Bearer " + signed.data.session!.access_token,
    "Content-Type": "application/json",
    Origin: origin,
  };
  const fp =
    ".local/camera/controls-" +
    info.project.name +
    (origin.startsWith("https:") ? "-production" : "") +
    ".json";
  let fixture = existsSync(fp) ? JSON.parse(readFileSync(fp, "utf8")) : null;
  if (!fixture) {
    const r = await fetch(origin + "/api/demo", {
      method: "POST",
      headers,
      body: "{}",
    });
    expect(r.ok).toBe(true);
    fixture = await r.json();
    writeFileSync(fp, JSON.stringify(fixture));
  }
  await context.grantPermissions(["camera"]);
  await page.goto("/");
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill(account.email);
  await dialog.getByLabel("Password", { exact: true }).fill(account.password);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Switch league").selectOption(fixture.id);
  await page.getByRole("button", { name: "Scoresheets", exact: true }).click();
  const upload = page.getByRole("button", {
    name: "Upload and review",
    exact: true,
  });
  await expect(upload).toBeDisabled();
  await expect(
    page.getByLabel("Live camera preview", { exact: true }),
  ).toHaveCount(0);
  let posts = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/scoresheet") && r.method() === "POST") posts++;
  });
  const take = () =>
    page.getByRole("button", { name: "Take photo", exact: true }).click();
  await take();
  await expect(
    page.getByRole("button", { name: "Capture photo", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Live camera preview", { exact: true })
    .evaluate((v: HTMLVideoElement) => {
      (window as any).__tracks = (v.srcObject as MediaStream).getTracks();
    });
  await page
    .getByRole("button", { name: "Capture photo", exact: true })
    .click();
  await expect(page.getByAltText("Captured photo to review")).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as any).__tracks.every(
        (t: MediaStreamTrack) => t.readyState === "ended",
      ),
    ),
  ).toBe(true);
  await expect(upload).toBeDisabled();
  expect(posts).toBe(0);
  await page.getByRole("button", { name: "Retake photo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Capture photo", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Capture photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Use photo", exact: true }).click();
  await expect(page.getByAltText("Selected scoresheet preview")).toBeVisible();
  await expect(upload).toBeEnabled();
  expect(posts).toBe(0);
  await take();
  await page
    .getByLabel("Live camera preview", { exact: true })
    .evaluate((v: HTMLVideoElement) => {
      (window as any).__tracks = (v.srcObject as MediaStream).getTracks();
    });
  await page
    .getByRole("button", { name: "Cancel camera", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      (window as any).__tracks.every(
        (t: MediaStreamTrack) => t.readyState === "ended",
      ),
    ),
  ).toBe(true);
  // Browser permission denial is real Chrome permission state, not a fabricated model response.
  await context.clearPermissions();
  const session = await context.newCDPSession(page);
  const target = await session.send("Target.getTargetInfo");
  const browserContextId = target.targetInfo.browserContextId;
  await session.send("Browser.setPermission", {
    browserContextId,
    permission: { name: "camera" },
    setting: "denied",
    origin,
  });
  await take();
  await expect(page.locator(".capture-error")).toContainText(
    "permission was not granted",
  );
  await expect(
    page.getByRole("button", {
      name: "Use device camera instead",
      exact: true,
    }),
  ).toBeEnabled();
  await session.send("Browser.setPermission", {
    browserContextId,
    permission: { name: "camera" },
    setting: "granted",
    origin,
  });
  // A late permission response after cancellation must immediately release its tracks.
  await page.evaluate(() => {
    (window as any).__gum = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        (window as any).__resolveCamera = resolve;
      });
  });
  await take();
  await expect(page.getByText(/Waiting for camera permission/)).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel camera", exact: true })
    .click();
  await page.evaluate(async () => {
    const s = await (window as any).__gum({ video: true, audio: false });
    (window as any).__lateTracks = s.getTracks();
    (window as any).__resolveCamera(s);
    navigator.mediaDevices.getUserMedia = (window as any).__gum;
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__lateTracks.every(
          (t: MediaStreamTrack) => t.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
  // No-device and unreadable-file faults are explicit test injections.
  await page.evaluate(() => {
    (window as any).__gum = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Synthetic no device", "NotFoundError"));
  });
  await take();
  await expect(page.locator(".capture-error")).toContainText("No camera");
  await page.evaluate(
    () => (navigator.mediaDevices.getUserMedia = (window as any).__gum),
  );
  const input = page.getByLabel(
    "Scoresheet photo (JPEG, PNG, WebP · up to 6 MB)",
    { exact: true },
  );
  await input.setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1024 * 1024 + 1),
  });
  await expect(page.locator(".capture-error")).toContainText("under 6 MB");
  await input.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.locator(".capture-error")).toContainText(
    "could not be read",
  );
  await input.setInputFiles("public/demo/scoresheet.png");
  await expect(page.getByAltText("Selected scoresheet preview")).toBeVisible();
  // Native camera files are normalized locally rather than uploading oversized originals.
  await page
    .getByLabel("Native scoresheet camera", { exact: true })
    .setInputFiles({
      name: "large-native.png",
      mimeType: "image/png",
      buffer: Buffer.concat([
        readFileSync("public/demo/scoresheet.png"),
        Buffer.alloc(6 * 1024 * 1024),
      ]),
    });
  await expect(page.getByText(/scoresheet-camera.jpg/)).toBeVisible();
  expect(posts).toBe(0);
  await take();
  await expect(
    page.getByRole("button", { name: "Capture photo", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Live camera preview", { exact: true })
    .evaluate((v: HTMLVideoElement) => {
      (window as any).__tracks = (v.srcObject as MediaStream).getTracks();
    });
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  expect(
    await page.evaluate(() =>
      (window as any).__tracks.every(
        (t: MediaStreamTrack) => t.readyState === "ended",
      ),
    ),
  ).toBe(true);
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Scoresheets", exact: true }).click();
  await page.getByLabel("Published game").selectOption({ index: 1 });
  const webp = await sharp("public/demo/scoresheet.png")
    .webp({ quality: 90 })
    .withMetadata({
      exif: {
        IFD0: { ImageDescription: "Synthetic retry test " + Date.now() },
      },
    })
    .toBuffer();
  await input.setInputFiles({
    name: "synthetic-scoresheet.webp",
    mimeType: "image/webp",
    buffer: webp,
  });
  await expect(page.getByAltText("Selected scoresheet preview")).toBeVisible();
  await page.route("**/storage/v1/object/scoresheets/**", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        statusCode: "503",
        error: "Synthetic upload failure",
        message: "Synthetic upload failure",
      }),
    }),
  );
  await upload.click();
  await expect(
    page.getByText("Synthetic upload failure", { exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText("Selected scoresheet preview")).toBeVisible();
  expect(posts).toBe(0);
  await page.unroute("**/storage/v1/object/scoresheets/**");
  await upload.click();
  await expect(
    page.getByRole("dialog", { name: "Review scoresheet", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/No AI extraction/).first()).toBeVisible();
  expect(posts).toBe(1);
});
