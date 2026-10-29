import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import {
  assertMetaScope,
  controlledMetaRequest,
  safeProviderSummary,
} from "../src/lib/meta-control";
const request = {
  model: "muse-spark-1.3",
  store: false,
  max_output_tokens: 4000,
  input: "synthetic",
};
const context = { league: "synthetic", actor: "admin" };
beforeEach(() => {
  vi.stubEnv("MODEL_API_KEY", "mock-key");
  vi.stubEnv("META_API_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("cumulative promotional Meta control", () => {
  it("denies other actors and tenants", () => {
    vi.stubEnv(
      "META_CONTROLLED_SCOPE",
      JSON.stringify({ placement: { actor: "coach", league: "synthetic" } }),
    );
    expect(() =>
      assertMetaScope("placement", "synthetic", "coach"),
    ).not.toThrow();
    expect(() => assertMetaScope("placement", "public", "coach")).toThrow(
      "restricted",
    );
  });
  it("reserves before dispatch and settles actual usage without repeat charging", async () => {
    const order: string[] = [];
    let claimed = false;
    const rpc = vi.fn(async (action: string) => {
      order.push(action);
      if (action === "reserve") {
        if (claimed) throw Error("already attempted");
        claimed = true;
        return { id: "mock-reservation" };
      }
      return { settled: true };
    });
    const fetch = vi.fn(async () => {
      order.push("fetch");
      return new Response(
        JSON.stringify({
          id: "mock-contract",
          model: "muse-spark-1.3",
          status: "completed",
          usage: { input_tokens: 123, output_tokens: 45 },
          output: [],
        }),
      );
    });
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await controlledMetaRequest(
          request,
          "placement",
          undefined,
          context,
          rpc,
        )
      ).usage.output_tokens,
    ).toBe(45);
    expect(order).toEqual(["reserve", "fetch", "settle"]);
    await expect(
      controlledMetaRequest(request, "placement", undefined, context, rpc),
    ).rejects.toThrow("already attempted");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retains uncertain reservations without retrying transport", async () => {
    const rpc = vi.fn(async (action: string) =>
        action === "reserve" ? { id: "mock-reservation" } : {},
      ),
      fetch = vi.fn().mockRejectedValue(Error("timeout"));
    vi.stubGlobal("fetch", fetch);
    await expect(
      controlledMetaRequest(request, "placement", undefined, context, rpc),
    ).rejects.toThrow("uncertain");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.at(-1)?.[0]).toBe("uncertain");
  });
  it("stops before network access if the shared budget refuses a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const rpc = vi.fn(async () => {
      throw Error("Promotional buffer exhausted");
    });
    await expect(
      controlledMetaRequest(request, "placement", undefined, context, rpc),
    ).rejects.toThrow("buffer");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not accept missing usage, wrong models or excessive output", async () => {
    const rpc = vi.fn(async (action: string) =>
      action === "reserve" ? { id: "mock-reservation" } : {},
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "mock",
            model: "muse-spark-1.3",
            status: "completed",
            usage: { input_tokens: 10, output_tokens: 4001 },
          }),
        ),
      ),
    );
    await expect(
      controlledMetaRequest(request, "placement", undefined, context, rpc),
    ).rejects.toThrow("unverifiable");
    expect(rpc.mock.calls.at(-1)?.[0]).toBe("uncertain");
  });
  it("excludes hidden reasoning and input bytes from failed/completed response summaries", () => {
    const r = safeProviderSummary({
      model: "muse-spark-1.3",
      status: "completed",
      output: [
        { type: "reasoning", text: "private reasoning" },
        {
          type: "message",
          content: [{ type: "output_text", text: '{"score":"unknown"}' }],
        },
      ],
    });
    expect(JSON.stringify(r)).not.toContain("private reasoning");
    expect(r.output[0].content[0].text).toContain("unknown");
  });
  it("rejects another model, background inference and larger output budgets before reservation", async () => {
    const rpc = vi.fn();
    for (const change of [
      { model: "other" },
      { background: true },
      { max_output_tokens: 4001 },
      { tools: [{ type: "web_search" }] },
      { tools: [{ type: "function", name: "inspect_league" }] },
    ])
      await expect(
        controlledMetaRequest(
          { ...request, ...change },
          "placement",
          undefined,
          context,
          rpc,
        ),
      ).rejects.toThrow("contract");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects provider built-ins and unauthorized function tools even for an operations run", async () => {
    const rpc = vi.fn();
    for (const tools of [
      [{ type: "web_search" }],
      [{ type: "function", name: "publish_schedule" }],
    ])
      await expect(
        controlledMetaRequest(
          { ...request, max_output_tokens: 2500, tools },
          "operations",
          undefined,
          context,
          rpc,
        ),
      ).rejects.toThrow("contract");
    expect(rpc).not.toHaveBeenCalled();
  });
});
