import { describe, it, expect } from "vitest";
import {
  authorizedSelection,
  workspaceHref,
  workspaceView,
} from "../src/lib/product-navigation";
describe("connected workspace navigation", () => {
  it("never chooses the first unrelated or publicly visible league", () => {
    expect(authorizedSelection([{ id: "member" }])).toBe("");
    expect(
      authorizedSelection([{ id: "member" }], "public-demo", "member"),
    ).toBe("");
    expect(authorizedSelection([{ id: "member" }], "member")).toBe("member");
  });
  it("preserves only an explicitly authorized current selection", () => {
    expect(authorizedSelection([{ id: "member" }], undefined, "member")).toBe(
      "member",
    );
    expect(authorizedSelection([], undefined, "member")).toBe("");
  });
  it("keeps navigation local and validates requested views", () => {
    expect(workspaceHref("abc", "Launchpad")).toBe(
      "/workspace/abc?view=Launchpad",
    );
    expect(workspaceHref("../external")).toBe("/workspace/..%2Fexternal");
    expect(workspaceView("Settings")).toBe("Settings");
    expect(workspaceView("https://evil.invalid")).toBe("Overview");
  });
});
