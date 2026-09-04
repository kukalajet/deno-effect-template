import { strictEqual, throws } from "node:assert/strict";

import {
  replaceTemplateIdentifiers,
  validateProjectName,
} from "./init-template.ts";

const templateName = ["deno", "effect"].join("-");

Deno.test("replaces every project identifier form", () => {
  const source = [
    `@${templateName}/api`,
    `${templateName}-template`,
    templateName.replaceAll("-", "_"),
    "Deno Effect backend template",
  ].join("\n");

  strictEqual(
    replaceTemplateIdentifiers(source, "acme-service"),
    [
      "@acme-service/api",
      "acme-service",
      "acme_service",
      "Deno Effect backend template",
    ].join("\n"),
  );
});

Deno.test("accepts lowercase kebab-case project names", () => {
  strictEqual(validateProjectName("api"), "api");
  strictEqual(validateProjectName("acme-service-2"), "acme-service-2");
  strictEqual(validateProjectName("a".repeat(63)), "a".repeat(63));
});

Deno.test("rejects project names that cannot be package and database names", () => {
  for (
    const projectName of [
      "",
      "Acme",
      "acme_service",
      "acme service",
      "-acme",
      "acme-",
      "acme--service",
      "a".repeat(64),
    ]
  ) {
    throws(() => validateProjectName(projectName));
  }
});
