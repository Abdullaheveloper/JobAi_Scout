import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const targetPath = path.join(root, "extension", "config.local.json");
const manifestPath = path.join(root, "extension", "manifest.json");

const fileVariables = fs.existsSync(envPath)
  ? Object.fromEntries(fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const raw = line.slice(separator + 1).trim();
      return [key, raw.replace(/^(["'])(.*)\1$/, "$2")];
    }))
  : {};

// Hosted CI providers such as Vercel inject variables into process.env and do
// not upload the ignored local .env file. Environment values take precedence,
// while the file remains a convenient local-development fallback.
const variables = { ...fileVariables, ...process.env };

const supabaseUrl = variables.VITE_SUPABASE_URL;
const anonKey = variables.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Configure them in the current environment or a local .env file.");
}

fs.writeFileSync(targetPath, `${JSON.stringify({ supabaseUrl, anonKey }, null, 2)}\n`, "utf8");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const supabaseHostPermission = `${new URL(supabaseUrl).origin}/*`;
manifest.host_permissions = Array.from(new Set([
  ...(manifest.host_permissions || []).filter((permission) => !/^https:\/\/[^/]+\.supabase\.co\/\*$/.test(permission)),
  supabaseHostPermission,
]));
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Extension connection and host permission synced from ${process.env.VITE_SUPABASE_URL ? "environment variables" : ".env"}.`);
