import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
const certificatePath = path.resolve(__dirname, ".certs/jobai-local.pfx");
// The development certificate is generated locally by `npm run setup:https`.
// Keep its password in sync with that script instead of inheriting a stale
// machine-level environment variable from another computer.
const certificatePassword = "jobai-local-dev";
const localHttps = fs.existsSync(certificatePath)
  ? { pfx: fs.readFileSync(certificatePath), passphrase: certificatePassword }
  : undefined;

export default defineConfig(({ mode }) => ({
  server: {
    // HTTPS is automatically enabled after `npm run setup:https`.
    // It is required for microphone access through a LAN IP address.
    // IPv6 dual-stack binding serves both https://localhost and the LAN IPv4 URL.
    host: "::",
    port: 5181,
    strictPort: true,
    https: localHttps,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js"),
    },
  },
}));
