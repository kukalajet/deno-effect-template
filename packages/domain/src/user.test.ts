import { strictEqual, throws } from "node:assert/strict";

import { Schema } from "effect";

import { DisplayName, Email } from "@deno-effect/domain";

Deno.test("domain user schemas trim and validate input", () => {
  const decodeEmail = Schema.decodeUnknownSync(Email);
  const decodeDisplayName = Schema.decodeUnknownSync(DisplayName);

  strictEqual(decodeEmail("  ada@example.com  "), "ada@example.com");
  strictEqual(decodeDisplayName("  Ada Lovelace  "), "Ada Lovelace");
  throws(() => decodeEmail("not-an-email"));
  throws(() => decodeDisplayName("   "));
});
