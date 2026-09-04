const SOURCE_PROJECT_NAME = ["deno", "effect"].join("-");
const PROJECT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROJECT_NAME_LENGTH = 63;
const IGNORED_DIRECTORIES = new Set([
  ".deno",
  ".git",
  "coverage",
  "node_modules",
]);
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function validateProjectName(projectName: string): string {
  if (
    projectName.length > MAX_PROJECT_NAME_LENGTH ||
    !PROJECT_NAME_PATTERN.test(projectName)
  ) {
    throw new Error(
      "Project name must be 1-63 characters of lowercase letters or digits separated by single hyphens",
    );
  }

  return projectName;
}

function replaceTemplateIdentifiers(
  source: string,
  projectName: string,
): string {
  const sourceDatabaseName = SOURCE_PROJECT_NAME.replaceAll("-", "_");
  const databaseName = projectName.replaceAll("-", "_");

  return source
    .replaceAll(`${SOURCE_PROJECT_NAME}-template`, projectName)
    .replaceAll(sourceDatabaseName, databaseName)
    .replaceAll(SOURCE_PROJECT_NAME, projectName);
}

function entryUrl(directoryUrl: URL, name: string, directory: boolean): URL {
  const suffix = directory ? "/" : "";
  return new URL(`${encodeURIComponent(name)}${suffix}`, directoryUrl);
}

function decodeText(contents: Uint8Array): string | undefined {
  if (contents.includes(0)) return undefined;

  try {
    return textDecoder.decode(contents);
  } catch {
    return undefined;
  }
}

async function replaceInDirectory(
  directoryUrl: URL,
  projectName: string,
): Promise<number> {
  let filesChanged = 0;

  for await (const entry of Deno.readDir(directoryUrl)) {
    if (entry.isDirectory) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;

      filesChanged += await replaceInDirectory(
        entryUrl(directoryUrl, entry.name, true),
        projectName,
      );
      continue;
    }

    if (!entry.isFile) continue;

    const fileUrl = entryUrl(directoryUrl, entry.name, false);
    const source = decodeText(await Deno.readFile(fileUrl));
    if (source === undefined) continue;

    const updated = replaceTemplateIdentifiers(source, projectName);
    if (updated === source) continue;

    await Deno.writeTextFile(fileUrl, updated);
    filesChanged += 1;
  }

  return filesChanged;
}

async function initializeTemplate(
  rootUrl: URL,
  projectName: string,
): Promise<number> {
  validateProjectName(projectName);
  return await replaceInDirectory(rootUrl, projectName);
}

if (import.meta.main) {
  const [projectName, extraArgument] = Deno.args;

  if (projectName === undefined || extraArgument !== undefined) {
    console.error("Usage: deno task init <project-name>");
    Deno.exit(1);
  }

  try {
    const rootUrl = new URL("../", import.meta.url);
    const filesChanged = await initializeTemplate(rootUrl, projectName);

    console.log(
      filesChanged === 0
        ? "No template identifiers found"
        : `Initialized ${projectName} in ${filesChanged} files`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export { initializeTemplate, replaceTemplateIdentifiers, validateProjectName };
