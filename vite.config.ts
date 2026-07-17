import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
const certificatePath = path.resolve(__dirname, ".certs/jobai-local.pfx");
const certificatePassword = process.env.JOBAI_LOCAL_CERT_PASSWORD;
const localHttps = fs.existsSync(certificatePath) && certificatePassword
  ? { pfx: fs.readFileSync(certificatePath), passphrase: certificatePassword }
  : undefined;

export default defineConfig(({ mode }) => ({
  server: {
    // HTTPS is automatically enabled after `npm run setup:https`.
    // It is required for microphone access through a LAN IP address.
    host: "0.0.0.0",
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
