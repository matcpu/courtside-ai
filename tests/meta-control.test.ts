import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertMetaScope,
  controlledMetaRequest,
} from "../src/lib/meta-control";
const request = {
  model: "muse-spark-1.3",
  store: false,
  max_output_tokens: 4000,
  input: "synthetic",
};
beforeEach(() => {
  vi.stubEnv("META_CONTROLLED_RUN", "abc1234567");
  vi.stubEnv(
    "META_JOURNAL_ROOT",
    mkdtempSync(join(tmpdir(), "courtside-control-")),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("single authorized Meta run", () => {
  it("denies other actors, tenants and actions even with inference enabled", () => {
    vi.stubEnv(
      "META_CONTROLLED_SCOPE",
      JSON.stringify({ placement: { actor: "coach", league: "synthetic" } }),
    );
    expect(() =>
      assertMetaScope("placement", "synthetic", "coach"),
    ).not.toThrow();
    for (const [feature, league, actor] of [
      ["placement", "public", "coach"],
      ["placement", "synthetic", "other"],
      ["operations", "synthetic", "coach"],
    ] as const)
      expect(() => assertMetaScope(feature, league, actor)).toThrow(
        "restricted",
      );
  });
  it("consumes the placement allowance once and preserves reported usage", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "mock-test-response",
            model: "muse-spark-1.3",
            status: "completed",
            usage: { input_tokens: 123, output_tokens: 45 },
            output: [],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      (await controlledMetaRequest(request, "placement")).usage.output_tokens,
    ).toBe(45);
    await expect(controlledMetaRequest(request, "placement")).rejects.toThrow(
      "allowance is exhausted",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("halts the entire sequence after an uncertain timeout, with zero retries", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetch);
    await expect(controlledMetaRequest(request, "placement")).rejects.toThrow(
      "uncertain",
    );
    await expect(controlledMetaRequest(request, "scoresheet")).rejects.toThrow(
      "previous provider outcome",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("halts on missing usage or an output limit violation", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "mock",
            model: "muse-spark-1.3",
            status: "completed",
            usage: { input_tokens: 100, output_tokens: 4001 },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(controlledMetaRequest(request, "placement")).rejects.toThrow(
      "uncertain",
    );
    await expect(controlledMetaRequest(request, "scoresheet")).rejects.toThrow(
      "previous provider outcome",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects another model, background inference and larger output budgets before dispatch", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const changes of [
      { model: "other" },
      { background: true },
      { max_output_tokens: 4001 },
    ])
      await expect(
        controlledMetaRequest({ ...request, ...changes }, "placement"),
      ).rejects.toThrow("contract");
    expect(fetch).not.toHaveBeenCalled();
  });
});
