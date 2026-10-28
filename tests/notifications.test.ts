import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deliver,
  emailConfiguration,
  type Delivery,
} from "../src/lib/notifications";
const item: Delivery = {
  id: "n",
  channel: "email",
  destination: "coach@example.com",
  subject: "Schedule update",
  body: "Your schedule is published.",
  idempotency_key: "version-team-email",
  lease_id: "lease",
};
afterEach(() => vi.unstubAllEnvs());
describe("notification reliability", () => {
  it("does not simulate provider success when disabled", async () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "false");
    await expect(deliver(item)).rejects.toThrow("disabled");
  });
  it("suppresses fictional recipients", async () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    const mock = vi.fn();
    expect((await deliver(item, mock)).status).toBe("suppressed");
    expect(mock).not.toHaveBeenCalled();
  });
  it("records provider acceptance only with an actual message ID (mock contract)", async () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "unit-test-only");
    vi.stubEnv("RESEND_FROM", "league@test.invalid");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "production");
    const mock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "provider-123" }), { status: 200 }),
      );
    expect(
      (await deliver({ ...item, destination: "coach@real.test" }, mock)).status,
    ).toBe("accepted");
    expect(mock.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      item.idempotency_key,
    );
  });
  it("surfaces notification failures for durable retry", async () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "unit-test-only");
    vi.stubEnv("RESEND_FROM", "league@test.invalid");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "production");
    await expect(
      deliver(
        { ...item, destination: "coach@real.test" },
        vi.fn().mockResolvedValue(new Response("", { status: 429 })),
      ),
    ).rejects.toThrow("429");
  });
  it("never sends unconfigured SMS", async () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    await expect(
      deliver({ ...item, channel: "sms", destination: "+14165550100" }),
    ).rejects.toThrow("SMS sending is not enabled");
  });
  it("fails closed when a test recipient is missing", () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "unit-test-only");
    vi.stubEnv("RESEND_FROM", "COURTSIDE Test <onboarding@resend.dev>");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "test");
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "");
    expect(emailConfiguration).toThrow("one authorized recipient");
  });
  it("never redirects another recipient's private message to the test inbox", async () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "unit-test-only");
    vi.stubEnv("RESEND_FROM", "COURTSIDE Test <onboarding@resend.dev>");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "test");
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "controlled@owned.test");
    const mock = vi.fn();
    expect(
      (await deliver({ ...item, destination: "someone@other.test" }, mock))
        .status,
    ).toBe("suppressed");
    expect(mock).not.toHaveBeenCalled();
  });
  it("allows only the exact authorized address in test mode", async () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "unit-test-only");
    vi.stubEnv("RESEND_FROM", "COURTSIDE Test <onboarding@resend.dev>");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "test");
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "controlled@owned.test");
    const mock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "actual-contract-id" })),
      );
    expect(
      (await deliver({ ...item, destination: "Controlled@owned.test" }, mock))
        .status,
    ).toBe("accepted");
    expect(JSON.parse(mock.mock.calls[0][1].body).to).toEqual([
      "Controlled@owned.test",
    ]);
  });
  it("does not allow a testing sender in production mode", () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "unit-test-only");
    vi.stubEnv("RESEND_FROM", "onboarding@resend.dev");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "production");
    expect(emailConfiguration).toThrow("verified sender");
  });
});
