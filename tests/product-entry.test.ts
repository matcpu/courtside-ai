import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProductEntry } from "../src/components/product-entry";

it("offers a public read-only dashboard without granting a private workspace", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(
    createElement(ProductEntry, {
      demo: {
        id: "public-demo",
        name: "Synthetic league",
        season: "Fall 2026",
        href: "/league/demo/website",
        publicDashboard: "/league/demo",
      },
      signedIn: false,
      ready: true,
      leagues: [],
      denied: false,
      privateRequest: false,
      onSignIn: noop,
      onCreate: noop,
      onSignOut: noop,
    }),
  );
  expect(html).toContain('href="/league/demo"');
  expect(html).toContain("Open public demo dashboard");
  expect(html).toContain("management require secure sign-in");
  expect(html).not.toContain('href="/workspace/');
});
