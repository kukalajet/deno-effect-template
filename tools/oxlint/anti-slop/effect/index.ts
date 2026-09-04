import { eslintCompatPlugin } from "@oxlint/plugins";

import { noServiceConstructorImportsRule } from "./rules/no-service-constructor-imports.ts";

export default eslintCompatPlugin({
  meta: { name: "anti-slop-effect" },
  rules: {
    "no-service-constructor-imports": noServiceConstructorImportsRule,
  },
});
