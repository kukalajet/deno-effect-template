import { defineRule } from "@oxlint/plugins";
import type { ESTree, SourceCode } from "@oxlint/plugins";

type ImportCategory = 0 | 1 | 2 | 3 | 4;

type ImportEntry = {
  readonly category: ImportCategory;
  readonly index: number;
  readonly node: ESTree.ImportDeclaration;
  readonly source: string;
};

function importCategory(source: string): ImportCategory {
  if (source.startsWith("node:")) return 0;
  if (source.startsWith("@deno-effect/")) return 2;
  if (source === ".." || source.startsWith("../")) return 3;
  if (source === "." || source.startsWith("./")) return 4;
  return 1;
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();

  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedEntries(
  imports: ReadonlyArray<ESTree.ImportDeclaration>,
): ImportEntry[] {
  return imports.map((node, index) => ({
    category: importCategory(node.source.value),
    index,
    node,
    source: node.source.value,
  })).sort((left, right) =>
    left.category - right.category ||
    compareText(left.source, right.source) ||
    left.index - right.index
  );
}

function isOrdered(
  imports: ReadonlyArray<ESTree.ImportDeclaration>,
  sorted: ReadonlyArray<ImportEntry>,
): boolean {
  return imports.every((node, index) => sorted[index]?.node === node);
}

function hasCommentsBetween(
  sourceCode: SourceCode,
  left: ESTree.ImportDeclaration,
  right: ESTree.ImportDeclaration,
): boolean {
  return sourceCode.getAllComments().some((comment) =>
    comment.start >= left.end && comment.end <= right.start
  );
}

function hasExpectedSpacing(
  sourceCode: SourceCode,
  imports: ReadonlyArray<ESTree.ImportDeclaration>,
  newline: string,
): boolean {
  for (let index = 1; index < imports.length; index += 1) {
    const previous = imports[index - 1];
    const current = imports[index];
    if (previous === undefined || current === undefined) continue;

    const sameCategory = importCategory(previous.source.value) ===
      importCategory(current.source.value);
    const gap = sourceCode.text.slice(previous.end, current.start);
    if (hasCommentsBetween(sourceCode, previous, current)) {
      if (!sameCategory && !/\n[\t ]*\n/.test(gap.replaceAll("\r\n", "\n"))) {
        return false;
      }
      continue;
    }

    const expected = sameCategory ? newline : newline + newline;
    if (gap !== expected) {
      return false;
    }
  }

  return true;
}

function hasImportComments(
  sourceCode: SourceCode,
  imports: ReadonlyArray<ESTree.ImportDeclaration>,
): boolean {
  const first = imports[0];
  const last = imports.at(-1);
  if (first === undefined || last === undefined) return false;
  if (sourceCode.getCommentsBefore(first).length > 0) return true;

  return sourceCode.getAllComments().some((comment) =>
    comment.loc.start.line >= first.loc.start.line &&
    comment.loc.start.line <= last.loc.end.line
  );
}

function expectedImportBlock(
  sourceCode: SourceCode,
  sorted: ReadonlyArray<ImportEntry>,
  newline: string,
): string {
  let result = "";

  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    if (entry === undefined) continue;

    if (index > 0) {
      const previous = sorted[index - 1];
      result += previous?.category === entry.category
        ? newline
        : newline + newline;
    }
    result += sourceCode.getText(entry.node);
  }

  return result;
}

const importOrderRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Order imports by source category and alphabetically within each category.",
    },
    fixable: "code",
    messages: {
      order:
        "Order imports as Node built-ins, external dependencies, workspace packages, parent modules, then sibling modules, with blank lines between categories.",
    },
  },
  createOnce(context) {
    const checkImportRun = (
      imports: ReadonlyArray<ESTree.ImportDeclaration>,
    ) => {
      if (imports.length < 2) return;

      const newline = context.sourceCode.text.includes("\r\n") ? "\r\n" : "\n";
      const sorted = sortedEntries(imports);
      if (
        isOrdered(imports, sorted) &&
        hasExpectedSpacing(context.sourceCode, imports, newline)
      ) {
        return;
      }

      const first = imports[0];
      const last = imports.at(-1);
      if (first === undefined || last === undefined) return;

      if (hasImportComments(context.sourceCode, imports)) {
        context.report({ node: first, messageId: "order" });
        return;
      }

      context.report({
        node: first,
        messageId: "order",
        fix(fixer) {
          return fixer.replaceTextRange(
            [first.start, last.end],
            expectedImportBlock(context.sourceCode, sorted, newline),
          );
        },
      });
    };

    return {
      Program(node) {
        let importRun: ESTree.ImportDeclaration[] = [];

        const flushImportRun = () => {
          checkImportRun(importRun);
          importRun = [];
        };

        for (const statement of node.body) {
          if (
            statement.type === "ImportDeclaration" &&
            statement.specifiers.length > 0
          ) {
            importRun.push(statement);
          } else {
            flushImportRun();
          }
        }
        flushImportRun();
      },
    };
  },
});

export { importOrderRule };
