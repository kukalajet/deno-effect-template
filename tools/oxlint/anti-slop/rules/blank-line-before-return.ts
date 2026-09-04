import { defineRule } from "@oxlint/plugins";
import type { Comment, ESTree, SourceCode } from "@oxlint/plugins";

type StatementSibling = ESTree.Directive | ESTree.Statement;

function previousSibling(
  node: ESTree.ReturnStatement,
): StatementSibling | undefined {
  const parent = node.parent;
  const siblings = parent.type === "BlockStatement"
    ? parent.body
    : parent.type === "SwitchCase"
    ? parent.consequent
    : undefined;
  if (siblings === undefined) return undefined;

  const index = siblings.indexOf(node);
  return index > 0 ? siblings[index - 1] : undefined;
}

function commentsBetween(
  sourceCode: SourceCode,
  previous: StatementSibling,
  node: ESTree.ReturnStatement,
): Comment[] {
  return sourceCode.getAllComments().filter((comment) =>
    comment.end > previous.end && comment.start < node.start
  );
}

function hasRealEmptyLine(
  sourceCode: SourceCode,
  previous: StatementSibling,
  node: ESTree.ReturnStatement,
  comments: ReadonlyArray<Comment>,
): boolean {
  for (
    let line = previous.loc.end.line + 1;
    line < node.loc.start.line;
    line += 1
  ) {
    const isCommentLine = comments.some((comment) =>
      comment.loc.start.line <= line && comment.loc.end.line >= line
    );
    if (!isCommentLine && sourceCode.lines[line - 1]?.trim() === "") {
      return true;
    }
  }

  return false;
}

function ownLineStart(
  sourceCode: SourceCode,
  start: number,
  line: number,
): number | undefined {
  const lineStart = sourceCode.lineStartIndices[line - 1];
  return lineStart !== undefined &&
      /^[\t ]*$/.test(sourceCode.text.slice(lineStart, start))
    ? lineStart
    : undefined;
}

const blankLineBeforeReturnRule = defineRule({
  meta: {
    type: "layout",
    docs: {
      description:
        "Require a blank line before return statements that follow another statement.",
    },
    fixable: "whitespace",
    messages: {
      blankLine: "Add a blank line before this return statement.",
    },
  },
  createOnce(context) {
    return {
      ReturnStatement(node) {
        const previous = previousSibling(node);
        if (previous === undefined) return;

        const comments = commentsBetween(context.sourceCode, previous, node);
        if (
          hasRealEmptyLine(context.sourceCode, previous, node, comments)
        ) {
          return;
        }

        const returnLineStart = ownLineStart(
          context.sourceCode,
          node.start,
          node.loc.start.line,
        );
        if (returnLineStart === undefined) {
          context.report({ node, messageId: "blankLine" });
          return;
        }

        const leadingComment = comments.find((comment) =>
          comment.loc.start.line > previous.loc.end.line
        );
        const insertionLineStart = leadingComment === undefined
          ? returnLineStart
          : ownLineStart(
            context.sourceCode,
            leadingComment.start,
            leadingComment.loc.start.line,
          );
        if (insertionLineStart === undefined) {
          context.report({ node, messageId: "blankLine" });
          return;
        }

        const newline = context.sourceCode.text.includes("\r\n")
          ? "\r\n"
          : "\n";
        context.report({
          node,
          messageId: "blankLine",
          fix(fixer) {
            return fixer.insertTextBeforeRange(
              [insertionLineStart, insertionLineStart],
              newline,
            );
          },
        });
      },
    };
  },
});

export { blankLineBeforeReturnRule };
