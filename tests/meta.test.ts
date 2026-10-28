import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { metaJSON } from "../src/lib/meta";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Meta Responses API contract (mock provider)", () => {
  beforeEach(() => vi.stubEnv("META_API_ENABLED", "true"));
  it("never calls Meta with a saved key while requests are disabled", async () => {
    vi.stubEnv("MODEL_API_KEY", "unit-test-only");
    vi.stubEnv("META_API_ENABLED", "false");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      metaJSON(z.object({ score: z.number() }), "Read", "image"),
    ).rejects.toThrow("Meta requests are disabled");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("defaults to disabled when the enabling flag is absent", async () => {
    vi.stubEnv("MODEL_API_KEY", "unit-test-only");
    vi.stubEnv("META_API_ENABLED", undefined);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      metaJSON(z.object({ score: z.number() }), "Read", "image"),
    ).rejects.toThrow("Meta requests are disabled");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed without a key", async () => {
    vi.stubEnv("MODEL_API_KEY", "");
    await expect(
      metaJSON(z.object({ explanation: z.string() }), "Explain", "data"),
    ).rejects.toThrow("Meta is not connected");
  });
  it("uses the configured Meta model, structured schema and no provider storage", async () => {
    vi.stubEnv("MODEL_API_KEY", "unit-test-only");
    vi.stubEnv("META_MODEL", "muse-spark-1.3");
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: '{"explanation":"Reviewed facts"}',
                },
              ],
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await metaJSON(
        z.object({ explanation: z.string() }),
        "Explain only facts",
        "facts",
      ),
    ).toEqual({ explanation: "Reviewed facts" });
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(fetch.mock.calls[0][0]).toBe("https://api.meta.ai/v1/responses");
    expect(payload.store).toBe(false);
    expect(payload.model).toBe("muse-spark-1.3");
    expect(payload.text.format.strict).toBe(true);
  });
  it("rejects an invalid extraction rather than manufacturing data", async () => {
    vi.stubEnv("MODEL_API_KEY", "unit-test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: '{"score":"unknown"}' }],
              },
            ],
          }),
        ),
      ),
    );
    await expect(
      metaJSON(z.object({ score: z.number() }), "Read", "image"),
    ).rejects.toThrow("failed structured validation");
  });
  it("rejects incomplete provider responses", async () => {
    vi.stubEnv("MODEL_API_KEY", "unit-test-only");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: "incomplete" })),
        ),
    );
    await expect(
      metaJSON(z.object({ score: z.number() }), "Read", "image"),
    ).rejects.toThrow("incomplete");
  });
});
