import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["jsdoc", "typescript", "vue"],
  jsPlugins: [{ name: "jsdoc-js", specifier: "eslint-plugin-jsdoc" }],
  settings: {
    jsdoc: { mode: "typescript" }
  },
  categories: {
    correctness: "warn"
  },
  rules: {
    "jsdoc-js/require-jsdoc": [
      "error",
      {
        enableFixer: false,
        require: {
          FunctionDeclaration: true,
          FunctionExpression: true,
          ArrowFunctionExpression: true,
          MethodDefinition: true
        }
      }
    ],
    "jsdoc-js/require-description": "error",
    "jsdoc-js/require-param": ["error", { enableFixer: false, checkDestructured: false }],
    "jsdoc-js/require-param-description": "error",
    "jsdoc-js/check-param-names": ["error", { checkDestructured: false }],
    "jsdoc-js/require-returns": "error",
    "jsdoc-js/require-returns-description": "error",
    "jsdoc-js/require-throws": "error",
    "jsdoc/require-throws-description": "error",
    "vue/prop-name-casing": "off",
    "eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }
    ]
  },
  overrides: [
    {
      files: ["tests/**"],
      rules: {
        "jsdoc-js/require-jsdoc": "off",
        "jsdoc-js/require-description": "off",
        "jsdoc-js/require-param": "off",
        "jsdoc-js/require-param-description": "off",
        "jsdoc-js/check-param-names": "off",
        "jsdoc-js/require-returns": "off",
        "jsdoc-js/require-returns-description": "off",
        "jsdoc-js/require-throws": "off",
        "jsdoc/require-throws-description": "off"
      }
    }
  ],
  ignorePatterns: [
    ".agents/**",
    ".starters/**",
    "docs/content/**",
    "env.d.ts",
    "layer/envs/env.d.ts"
  ]
});
