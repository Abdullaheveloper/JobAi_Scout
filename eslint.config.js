import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import i18next from "eslint-plugin-i18next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "extension", "services", "supabase", ".tmp-locale-zip"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      i18next,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Catch new hardcoded JSX text; warn so existing pages can migrate gradually.
      "i18next/no-literal-string": [
        "warn",
        {
          mode: "jsx-text-only",
          "jsx-components": {
            exclude: ["Trans", "Icon", "Route"],
          },
          words: {
            exclude: [
              "^[\\s\\d\\p{P}\\p{S}]*$",
              "^JobAI Scout$",
              "^✓$",
              "^✗$",
              "^—$",
              "^·$",
            ],
          },
        },
      ],
    },
  },
  // Critical pages: treat literal JSX strings as errors so regressions fail CI.
  {
    files: [
      "src/pages/Automation.tsx",
      "src/pages/CVUpload.tsx",
      "src/pages/AutoFormFill.tsx",
      "src/pages/VoiceAssistant.tsx",
      "src/components/automation/**/*.{ts,tsx}",
      "src/components/voice/**/*.{ts,tsx}",
    ],
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-text-only",
          words: {
            exclude: [
              "^[\\s\\d\\p{P}\\p{S}]*$",
              "^JobAI Scout$",
              "^✓$",
              "^✗$",
              "^—$",
              "^·$",
            ],
          },
        },
      ],
    },
  },
);
