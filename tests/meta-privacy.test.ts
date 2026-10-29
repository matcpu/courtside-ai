import { expect, it } from "vitest";
import { redactCoachContext } from "../src/lib/meta-privacy";
it("preserves numeric UUID tool identifiers without exempting nearby personal data", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  expect(
    redactCoachContext(
      `Inspect ${id}; contact guardian@example.invalid at +1 (416) 555-0123, born 2013-02-03.`,
    ),
  ).toBe(
    `Inspect ${id}; contact [email removed] at [phone removed], born [date removed].`,
  );
});
it("preserves multiple mixed-case UUIDs and removes standalone phone numbers", () => {
  const ids = [
    "ABCDEF12-3456-4789-ABCD-123456789012",
    "00000000-0000-4000-a000-000000000000",
  ];
  expect(redactCoachContext(`${ids.join(" then ")} 4165550123`)).toBe(
    `${ids.join(" then ")} [phone removed]`,
  );
});
