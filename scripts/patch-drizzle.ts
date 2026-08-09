const driverUrl = import.meta.resolve("drizzle-orm/effect-postgres");

if (!driverUrl.startsWith("file:")) {
  throw new Error(
    `Expected a local Drizzle installation, received ${driverUrl}`,
  );
}

const targets = [
  "../cache/core/cache-effect.js",
  "../cache/core/cache-effect.cjs",
  "../effect-core/errors.js",
  "../effect-core/errors.cjs",
];

let patchedFiles = 0;

for (const relativePath of targets) {
  const fileUrl = new URL(relativePath, driverUrl);
  const source = Deno.readTextFileSync(fileUrl);

  if (source.includes("TaggedErrorClass")) {
    Deno.writeTextFileSync(
      fileUrl,
      source.replaceAll("TaggedErrorClass", "TaggedError"),
    );
    patchedFiles += 1;
    continue;
  }

  if (!source.includes("TaggedError")) {
    throw new Error(`Drizzle compatibility signature missing in ${fileUrl}`);
  }
}

console.log(
  patchedFiles === 0
    ? "Drizzle Effect compatibility patch already applied"
    : `Patched ${patchedFiles} Drizzle runtime files`,
);
