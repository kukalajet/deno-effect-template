import { defineRule } from "@oxlint/plugins";

const noInlineExportsRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require declarations to be exported from an explicit export statement.",
    },
    messages: {
      inlineExport:
        "Move this export to an explicit export statement at the end of the file.",
    },
  },
  createOnce(context) {
    return {
      ExportNamedDeclaration(node) {
        if (node.declaration !== null) {
          context.report({ node, messageId: "inlineExport" });
        }
      },
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: "inlineExport" });
      },
    };
  },
});

export { noInlineExportsRule };
