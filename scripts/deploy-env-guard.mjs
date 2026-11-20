// Deployment configuration guard for the styled-landing Vercel project.
//
// Runs at the start of every Vercel build (scripts/vercel-build.sh). If the
// environment variables for a production build would wire styleduk.com to the
// wrong database or site, the build stops before anything is deployed.
//
// Outside Vercel (local machines, GitHub Actions with placeholder values) the
// guard does nothing, so it never needs real secrets to run the test suite.
//
// It never prints secret values, only variable names.

import { pathToFileURL } from 'node:url';

export const LIVE_SUPABASE_URL = 'https://yfwqcidkfjzpwbylgnug.supabase.co';
export const DEV_SUPABASE_REF = 'qkyeitvwscrxbiwamxan';
export const DEV_SITE_HOST = 'styledukprodprogress.vercel.app';
export const LIVE_SITE_URLS = ['https://styleduk.com', 'https://www.styleduk.com'];

const FLAGS = [
  'ENABLE_BOOKING_EMAILS',
  'ENABLE_SUPPORT_EMAILS',
  'ENABLE_APPLICATION_EMAILS',
  'ENABLE_ORDER_WHATSAPP',
  'STYLED_PUBLIC_DEMO_ENABLED',
  'PINTEREST_IMPORT_ENABLED',
];

const blank = (v) => v === undefined || String(v).trim() === '';
const placeholder = (v) => /placeholder|<project-ref>|^sb_publishable_\.\.\.$|^sb_secret_\.\.\.$|changeme|example/i.test(String(v));
const trimSlash = (v) => String(v).trim().replace(/\/+$/, '');

/**
 * Check the build environment. Returns { skipped, errors, warnings }.
 * `env` is a plain object (process.env in real use).
 * `crons` is the number of cron jobs declared in vercel.json.
 */
export function checkDeployEnv(env, { crons = 0 } = {}) {
  const target = env.VERCEL_ENV;
  const errors = [];
  const warnings = [];
  if (!target) return { skipped: true, errors, warnings };

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;

  // Every Vercel build (production and preview) needs a working database connection.
  for (const [name, value] of [
    ['NEXT_PUBLIC_SUPABASE_URL', url],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', anon],
    ['SUPABASE_SERVICE_ROLE_KEY', service],
  ]) {
    if (blank(value)) errors.push(`${name} is not set for ${target}.`);
    else if (placeholder(value)) errors.push(`${name} still holds a placeholder value for ${target}.`);
  }
  if (!blank(service) && !blank(anon) && service === anon) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY must not be the same as the public anon key.');
  }
  if (!blank(service) && String(service).startsWith('sb_publishable_')) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is a publishable key; server routes would fail.');
  }
  if (target === 'production' && !blank(url) && String(url).includes(DEV_SUPABASE_REF)) {
    errors.push(`NEXT_PUBLIC_SUPABASE_URL points at the development database for a ${target} build of the live project.`);
  }

  if (String(anon || '').startsWith('sb_secret_')) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY contains a server-only key.');
  }
  for (const [name, key, role] of [
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', anon, 'anon'],
    ['SUPABASE_SERVICE_ROLE_KEY', service, 'service_role'],
  ]) {
    if (!String(key || '').startsWith('eyJ')) continue;
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (claims.role !== role || (claims.ref && new URL(url).hostname !== claims.ref + '.supabase.co')) {
        errors.push(name + ' has the wrong role or database project.');
      }
    } catch {
      errors.push(name + ' has invalid legacy key metadata.');
    }
  }

  for (const flag of FLAGS) {
    if (!blank(env[flag]) && !['true', 'false'].includes(String(env[flag]).trim())) {
      errors.push(`${flag} must be "true" or "false".`);
    }
  }

  if (target === 'production') {
    if (!blank(url) && trimSlash(url) !== LIVE_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL must be the live Wedding Planner database for production.');
    }
    const site = env.NEXT_PUBLIC_SITE_URL;
    if (blank(site)) {
      errors.push('NEXT_PUBLIC_SITE_URL is not set; emails and the sitemap would link to a vercel.app address.');
    } else if (!LIVE_SITE_URLS.includes(trimSlash(site))) {
      errors.push('NEXT_PUBLIC_SITE_URL must be https://styleduk.com (or www) for production.');
    }
    if (blank(env.RESEND_API_KEY) && blank(env.BREVO_API_KEY)) {
      warnings.push('No email provider key (RESEND_API_KEY or BREVO_API_KEY): no emails will be sent.');
    }
    if (crons > 0 && blank(env.CRON_SECRET)) {
      warnings.push(`vercel.json declares ${crons} cron job(s) but CRON_SECRET is not set, so they all refuse to run.`);
    }
  } else if (target === 'preview' && trimSlash(url) !== `https://${DEV_SUPABASE_REF}.supabase.co`) {
    errors.push('Branch previews must use the Wedding Planner Dev database.');
  }

  return { skipped: false, errors, warnings };
}

async function main() {
  let crons = 0;
  try {
    const { readFile } = await import('node:fs/promises');
    crons = (JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')).crons || []).length;
  } catch {}
  const { skipped, errors, warnings } = checkDeployEnv(process.env, { crons });
  if (skipped) {
    console.log('Deployment environment guard: not a Vercel build, skipped.');
    return;
  }
  for (const w of warnings) console.warn(`WARNING: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(`Deployment environment guard failed for ${process.env.VERCEL_ENV}. Fix the Vercel environment variables, then redeploy.`);
    process.exit(1);
  }
  console.log(`Deployment environment guard passed for ${process.env.VERCEL_ENV}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
