import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const envPath = path.resolve(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.error('.env file not found at:', envPath);
  process.exit(0);
}

const envContent = fs.readFileSync(envPath, 'utf-8');

const parseEnv = (content) => {
  const env = {};
  const lines = content.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      const key = match[1].trim();
      let value = (match[2] || '').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value;
    }
  }
  return env;
};

const env = parseEnv(envContent);

const geminiApiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
const openrouterApiKey = env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY;
const projectRef = env.VITE_SUPABASE_PROJECT_ID;
const token = env.token;

if (!geminiApiKey || !openrouterApiKey || !projectRef || !token) {
  console.warn('Sync warning: Missing one of GEMINI_API_KEY, OPENROUTER_API_KEY, VITE_SUPABASE_PROJECT_ID, or token in .env');
  process.exit(0);
}

console.log('Syncing secrets to Supabase project:', projectRef);

try {
  // Execute supabase secrets set using the token
  const cmd = `npx supabase secrets set GEMINI_API_KEY="${geminiApiKey}" OPENROUTER_API_KEY="${openrouterApiKey}" --project-ref ${projectRef}`;
  execSync(cmd, {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    stdio: 'inherit',
  });
  console.log('Successfully synchronized secrets with Supabase!');
} catch (error) {
  console.error('Failed to sync secrets to Supabase:', error.message);
}
