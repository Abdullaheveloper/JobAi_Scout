import i18next from "eslint-plugin-i18next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// CI's localization gate is intentionally isolated from general TypeScript and
// React lint debt. The regular eslint.config.js remains the full-project gate.
export default tseslint.config(
  { ignores: ["dist", "extension", "services", "supabase"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
  },
  {
    files: [
      "src/pages/Automation.tsx",
      "src/pages/CVUpload.tsx",
      "src/pages/AutoFormFill.tsx",
      "src/pages/VoiceAssistant.tsx",
      "src/components/automation/**/*.{ts,tsx}",
      "src/components/voice/**/*.{ts,tsx}",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: ["placeholder", "alt", "title", "aria-label", "aria-placeholder", "aria-roledescription", "aria-valuetext"],
          },
          words: {
            exclude: [
              "^[\\s\\d\\p{P}\\p{S}]*$",
              "^JobAI Scout$",
              "^(repeat|once|2-digit)$",
              "^https?:\\/\\/.*$",
            ],
          },
        },
      ],
    },
  },
);
