#!/usr/bin/env node
/**
 * Audit all recipes in Supabase:
 *   1. Fetch every recipe (id, name, source_url)
 *   2. HEAD-request each URL — mark dead if HTTP 404
 *   3. Delete dead recipes from Supabase
 *   4. Report final count
 *
 * Run:
 *   node --env-file=.env.local scripts/audit-recipes.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run with: node --env-file=.env.local scripts/audit-recipes.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'HEAD',
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.status;
  } catch {
    // Timeout or network error — treat as unknown (keep recipe)
    return null;
  }
}

async function main() {
  // ── 1. Fetch all recipes ──────────────────────────────────────────────────
  console.log('Fetching all recipes from Supabase…');
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, source_url')
    .order('crawled_at', { ascending: true });

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }
  console.log(`Total recipes in DB: ${recipes.length}\n`);

  // ── 2. Check each URL ─────────────────────────────────────────────────────
  const dead    = [];
  const alive   = [];
  const unknown = [];

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    process.stdout.write(`[${String(i + 1).padStart(3)}/${recipes.length}] ${r.source_url} … `);
    const status = await checkUrl(r.source_url);

    if (status === 404) {
      console.log('❌ 404 — DEAD');
      dead.push(r);
    } else if (status === null) {
      console.log('⚠️  timeout/error — keeping');
      unknown.push(r);
    } else {
      console.log(`✅ ${status}`);
      alive.push(r);
    }

    await sleep(300); // be polite to servers
  }

  // ── 3. Report ─────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Alive   : ${alive.length}`);
  console.log(`⚠️  Unknown : ${unknown.length}  (timeout / network — NOT deleted)`);
  console.log(`❌ Dead 404: ${dead.length}`);

  // ── 4. Delete dead recipes ────────────────────────────────────────────────
  if (dead.length === 0) {
    console.log('\nNo dead recipes to delete.');
  } else {
    console.log('\nDeleting 404 recipes…');
    const deadIds = dead.map((r) => r.id);
    const { error: delErr } = await supabase
      .from('recipes')
      .delete()
      .in('id', deadIds);

    if (delErr) {
      console.error('Delete error:', delErr.message);
    } else {
      console.log(`Deleted ${dead.length} dead recipe(s):`);
      dead.forEach((r) => console.log(`  • ${r.name}`));
    }
  }

  // ── 5. Final count ────────────────────────────────────────────────────────
  const { count } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true });

  console.log(`\n✅ Recipes remaining in DB: ${count}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
