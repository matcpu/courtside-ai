import { afterEach, describe, expect, it, vi } from "vitest";
import { deliver, type Delivery } from "../src/lib/notifications";
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
});
