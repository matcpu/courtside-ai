import { afterEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/server", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/server")>("@/lib/server");
  return {
    ...actual,
    authenticate: vi.fn(async () => ({
      client: { rpc },
      user: { id: "aa000000-0000-4000-8000-000000000001" },
    })),
  };
});
vi.mock("@/lib/document-storage", () => ({
  documentStorage: vi.fn(),
  deleteAgeDocument: vi.fn(),
  invitationHash: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({ deliver: vi.fn() }));
import { POST as finish } from "../src/app/api/launchpad/route";
import { POST as preseason } from "../src/app/api/preseason/route";
afterEach(() => {
  vi.unstubAllEnvs();
  rpc.mockReset();
});
describe("public RPC conflicts remain explicit HTTP 409 responses", () => {
  it.each(["PT409", "40001"])(
    "rejects stale setup with %s and instructs review",
    async (code) => {
      vi.stubEnv("ORGANIZER_SETUP_ENABLED", "true");
      rpc
        .mockResolvedValueOnce({ data: { version: 1 }, error: null })
        .mockResolvedValue({
          data: null,
          error: { code, message: "Safety configuration changed" },
        });
      const response = await finish(
        new Request("http://localhost/api/launchpad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finish",
            payload: {
              id: "aa000000-0000-4000-8000-000000000002",
              revision: 1,
            },
          }),
        }),
      );
      expect(response.status).toBe(409);
      expect((await response.json()).error).toMatch(/reload.*fresh edit/i);
      expect(rpc).toHaveBeenCalledTimes(2);
    },
  );
  it("refuses setup writes before the sport migration is available", async () => {
    vi.stubEnv("ORGANIZER_SETUP_ENABLED", "true");
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const response = await finish(
      new Request("http://localhost/api/launchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finish",
          payload: { id: "aa000000-0000-4000-8000-000000000002", revision: 1 },
        }),
      }),
    );
    expect(response.status).toBe(503);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("sport_capabilities");
  });
  it("returns a non-retrying season-rule conflict", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PT409",
        message: "Season rules changed. Reload and review.",
      },
    });
    const response = await preseason(
      new Request("http://localhost/api/preseason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league: "aa000000-0000-4000-8000-000000000003",
          action: "submit_roster",
          payload: {},
        }),
      }),
    );
    expect(response.status).toBe(409);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
