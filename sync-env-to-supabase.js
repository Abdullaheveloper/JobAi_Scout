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
const apifyApiToken = env.APIFY_API_TOKEN || env.apify_api_token;
const firecrawlApiToken = env.FIRECRAWL_API_TOKEN || env.firecrawl_api_token;
const linkedinLiAt = env.LINKEDIN_LI_AT || env.linkedin_li_at;
const linkedinCookiesJson = env.LINKEDIN_COOKIES_JSON || env.linkedin_cookies_json;
const apifyLinkedinActor = env.APIFY_LINKEDIN_ACTOR;
const apifyIndeedActor = env.APIFY_INDEED_ACTOR;
const apifyMultiJobActor = env.APIFY_MULTI_JOB_ACTOR;
const cvExtractorUrl = env.CV_EXTRACTOR_URL;
const projectRef = env.VITE_SUPABASE_PROJECT_ID;
const token = env.token;

if (!geminiApiKey || !openrouterApiKey || !projectRef) {
  console.warn('Sync warning: Missing one of GEMINI_API_KEY, OPENROUTER_API_KEY, or VITE_SUPABASE_PROJECT_ID in .env');
  process.exit(0);
}

console.log('Syncing secrets to Supabase project:', projectRef);

try {
  const secrets = [
    `GEMINI_API_KEY="${geminiApiKey}"`,
    `OPENROUTER_API_KEY="${openrouterApiKey}"`,
  ];
  if (cvExtractorUrl) {
    secrets.push(`CV_EXTRACTOR_URL="${cvExtractorUrl}"`);
  }
  if (apifyApiToken) secrets.push(`APIFY_API_TOKEN="${apifyApiToken}"`);
  if (firecrawlApiToken) secrets.push(`FIRECRAWL_API_TOKEN="${firecrawlApiToken}"`);
  if (linkedinLiAt) secrets.push(`LINKEDIN_LI_AT="${linkedinLiAt}"`);
  if (linkedinCookiesJson) secrets.push(`LINKEDIN_COOKIES_JSON="${linkedinCookiesJson}"`);
  if (apifyLinkedinActor) secrets.push(`APIFY_LINKEDIN_ACTOR="${apifyLinkedinActor}"`);
  if (apifyIndeedActor) secrets.push(`APIFY_INDEED_ACTOR="${apifyIndeedActor}"`);
  if (apifyMultiJobActor) secrets.push(`APIFY_MULTI_JOB_ACTOR="${apifyMultiJobActor}"`);

  const cmd = `npx supabase secrets set ${secrets.join(' ')} --project-ref ${projectRef}`;
  execSync(cmd, {
    env: token ? { ...process.env, SUPABASE_ACCESS_TOKEN: token } : process.env,
    stdio: 'inherit',
  });
  console.log('Successfully synchronized secrets with Supabase!');
} catch (error) {
  // The CLI error message may include the complete command line, including secrets.
  // Never print it to logs or the terminal.
  console.error('Failed to sync secrets to Supabase. Check Supabase CLI authentication and project access.');
  process.exitCode = 1;
}
