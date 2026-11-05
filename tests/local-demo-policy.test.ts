import { describe, it, expect } from "vitest";
import {
  localDemoAllowed,
  localDemoSameOrigin,
} from "../src/lib/local-demo-policy";
const env = {
  NODE_ENV: "development",
  LAUNCHPAD_LOCAL_PREVIEW: "true",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3302",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-preview-publishable",
  META_API_ENABLED: "false",
  NOTIFICATIONS_ENABLED: "false",
  SMS_ENABLED: "false",
};
const request = (
  url = "http://127.0.0.1:3301/api/local-demo-session",
  origin = "http://127.0.0.1:3301",
  host = "127.0.0.1:3301",
) => new Request(url, { method: "POST", headers: { host, origin } });
describe("local-only demo session security", () => {
  it("allows only a development build, explicit server opt-in and exact loopback synthetic services", () => {
    expect(localDemoAllowed(request(), env, true)).toBe(true);
    expect(
      localDemoAllowed(
        request(),
        { ...env, LAUNCHPAD_LOCAL_PREVIEW: "false" },
        true,
      ),
    ).toBe(false);
  });
  it("cannot be enabled in a production artifact even with development runtime values and a forged local host", () => {
    expect(localDemoAllowed(request(), env, false)).toBe(false);
    expect(
      localDemoAllowed(request(), { ...env, NODE_ENV: "production" }, true),
    ).toBe(false);
    expect(localDemoAllowed(request(), { ...env, VERCEL: "1" }, true)).toBe(
      false,
    );
  });
  it("rejects hosted Supabase, real publishable credentials, external origins and wrong ports", () => {
    expect(
      localDemoAllowed(
        request(),
        {
          ...env,
          NEXT_PUBLIC_SUPABASE_URL: "https://xdmkgoradmbnjofmbojs.supabase.co",
        },
        true,
      ),
    ).toBe(false);
    expect(
      localDemoAllowed(
        request(),
        { ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "real-key" },
        true,
      ),
    ).toBe(false);
    expect(
      localDemoAllowed(
        request(
          "https://courtside.example/api",
          "https://courtside.example",
          "courtside.example",
        ),
        env,
        true,
      ),
    ).toBe(false);
    expect(
      localDemoAllowed(
        request("http://127.0.0.1:3000/api", undefined, "127.0.0.1:3000"),
        env,
        true,
      ),
    ).toBe(false);
  });
  it.each(["META_API_ENABLED", "NOTIFICATIONS_ENABLED", "SMS_ENABLED"])(
    "fails closed when %s permits outbound activity",
    (key) => {
      expect(localDemoAllowed(request(), { ...env, [key]: "true" }, true)).toBe(
        false,
      );
    },
  );
  it("requires a matching same-origin request for bootstrap and cookie-authorized writes", () => {
    expect(localDemoSameOrigin(request())).toBe(true);
    expect(
      localDemoSameOrigin(request(undefined, "https://attacker.invalid")),
    ).toBe(false);
    expect(
      localDemoSameOrigin(
        new Request("http://127.0.0.1:3301", {
          method: "POST",
          headers: { host: "127.0.0.1:3301" },
        }),
      ),
    ).toBe(false);
  });
});
