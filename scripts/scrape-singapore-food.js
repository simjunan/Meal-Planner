#!/usr/bin/env node
/**
 * Scrape up to 150 recipes from https://mysingaporefood.com
 * and insert them into Supabase.
 *
 * Strategy:
 *   1. Crawl /recipes/ (paginated) to collect recipe URLs
 *   2. For each URL, fetch the page and extract:
 *      - JSON-LD schema.org/Recipe (most reliable)
 *      - Fallback: WP Recipe Maker plugin HTML
 *   3. Upsert into Supabase (skip duplicates by source_url)
 *
 * Run:
 *   node --env-file=.env.local scripts/scrape-singapore-food.js
 *
 * Optional env:
 *   MAX_RECIPES=150   (default 150)
 */

const { createClient } = require('@supabase/supabase-js');
const { load }         = require('cheerio');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_RECIPES  = parseInt(process.env.MAX_RECIPES ?? '150', 10);
const BASE_URL     = 'https://mysingaporefood.com';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run with: node --env-file=.env.local scripts/scrape-singapore-food.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── HTTP helper ──────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

async function getHtml(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 429) { await sleep(5000 * (i + 1)); continue; }
        return null;
      }
      return await res.text();
    } catch {
      if (i < retries - 1) await sleep(2000 * (i + 1));
    }
  }
  return null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Collect recipe URLs from /recipes/ listing pages ───────────────────────

async function collectRecipeUrls(max) {
  const urls = new Set();
  let page = 1;

  while (urls.size < max) {
    const listingUrl = page === 1
      ? `${BASE_URL}/recipes/`
      : `${BASE_URL}/recipes/page/${page}/`;

    console.log(`  Listing page ${page}: ${listingUrl}`);
    const html = await getHtml(listingUrl);
    if (!html) { console.log('  Could not fetch listing page — stopping.'); break; }

    const $ = load(html);

    // Collect links matching /recipe/* pattern
    let found = 0;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (/\/recipe\/[^\/]+\/?$/.test(href) && !urls.has(href)) {
        urls.add(href.replace(/\/$/, '') + '/');
        found++;
      }
    });

    // Also try article/post links
    $('article a[href], .post a[href], .entry-title a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith(BASE_URL) && href.includes('/recipe/') && !urls.has(href)) {
        urls.add(href.replace(/\/$/, '') + '/');
        found++;
      }
    });

    console.log(`    Found ${found} recipe links (total: ${urls.size})`);
    if (found === 0) break; // No more recipes on this page

    // Check if next page exists
    const hasNext = $('a.next, a[rel="next"], .pagination .next, .nav-links .next').length > 0;
    if (!hasNext && found === 0) break;
    if (!hasNext) break;

    page++;
    await sleep(800);
  }

  return [...urls].slice(0, max);
}

// ── Parse a single recipe page ───────────────────────────────────────────────

function parseTimeToMins(timeStr) {
  if (!timeStr) return null;
  // ISO 8601 duration: PT1H30M, PT45M, PT1H
  const iso = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso) return (parseInt(iso[1] ?? '0') * 60) + parseInt(iso[2] ?? '0');
  // Plain numbers: "45 minutes", "1 hour 30 min"
  const mins = timeStr.match(/(\d+)\s*(?:min|minute)/i);
  const hrs  = timeStr.match(/(\d+)\s*(?:hr|hour)/i);
  if (mins || hrs) return (parseInt(hrs?.[1] ?? '0') * 60) + parseInt(mins?.[1] ?? '0');
  return null;
}

function inferDishType(name, ingredients) {
  const text = `${name} ${(ingredients || []).join(' ')}`.toLowerCase();
  if (/soup|broth|stock|porridge|congee|laksa|bak kut|tom yam/.test(text)) return 'soup';
  if (/chicken|pork|beef|fish|prawn|shrimp|crab|mutton|lamb|duck|squid|sotong|egg/.test(text)) return 'meat';
  if (/vegetable|veggie|tofu|tempe|spinach|kangkong|kailan|brinjal|eggplant/.test(text)) return 'vegetable';
  return 'other';
}

function inferMealType(name) {
  const n = name.toLowerCase();
  if (/kueh|cake|pudding|tart|dessert|chendol|ice kachang|ondeh|pineapple/.test(n)) return ['dessert'];
  if (/breakfast|toast|kaya|mee siam|nasi lemak/.test(n)) return ['breakfast', 'lunch'];
  return ['lunch', 'dinner'];
}

function inferDietaryTags(ingredients, name) {
  const text = `${name} ${(ingredients || []).join(' ')}`.toLowerCase();
  const tags = [];
  if (!/chicken|pork|beef|fish|prawn|shrimp|crab|mutton|lamb|duck|squid|meat|lard|bacon|anchovy|ikan/.test(text)) {
    if (!/egg|milk|cream|butter|cheese/.test(text)) tags.push('Vegan');
    else tags.push('Vegetarian');
  }
  if (!/flour|bread|soy sauce|kicap|mee|noodle|pasta|dumpling/.test(text)) tags.push('Gluten-Free');
  return tags;
}

function parseJsonLd(html) {
  const matches = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of matches) {
    try {
      const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
      const json = JSON.parse(inner);
      const schemas = Array.isArray(json) ? json : [json];
      for (const schema of schemas) {
        if (schema['@type'] === 'Recipe') return schema;
        // Sometimes nested in @graph
        if (schema['@graph']) {
          const recipe = schema['@graph'].find((n) => n['@type'] === 'Recipe');
          if (recipe) return recipe;
        }
      }
    } catch { /* skip */ }
  }
  return null;
}

function parseIngredients($, schema) {
  if (schema?.recipeIngredient?.length) {
    return schema.recipeIngredient.slice(0, 20).map((s) => String(s).trim()).filter(Boolean);
  }
  // WP Recipe Maker
  const items = [];
  $('.wprm-recipe-ingredient, .wprm-recipe-ingredient-name, .tasty-recipes-ingredients li, .ingredients li').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt) items.push(txt.slice(0, 80));
  });
  return items.slice(0, 20);
}

async function scrapeRecipe(url) {
  const html = await getHtml(url);
  if (!html) return null;

  const $ = load(html);
  const schema = parseJsonLd(html);

  // ── Name ──────────────────────────────────────────────────────────────────
  const name = schema?.name
    || $('h1.entry-title, h1.recipe-title, h1.wprm-recipe-name, h1').first().text().trim()
    || '';
  if (!name) return null;

  // ── Image ─────────────────────────────────────────────────────────────────
  const imageRaw = schema?.image;
  let thumbnail_url = null;
  if (typeof imageRaw === 'string') thumbnail_url = imageRaw;
  else if (Array.isArray(imageRaw) && imageRaw.length) thumbnail_url = typeof imageRaw[0] === 'string' ? imageRaw[0] : imageRaw[0]?.url ?? null;
  else if (imageRaw?.url) thumbnail_url = imageRaw.url;
  if (!thumbnail_url) {
    thumbnail_url = $('meta[property="og:image"]').attr('content')
      || $('.wprm-recipe-image img, .tasty-recipes-image img, article img').first().attr('src')
      || null;
  }

  // ── Times ─────────────────────────────────────────────────────────────────
  const cookRaw  = schema?.cookTime  || $('[class*="cook-time"], [class*="cookTime"]').text().trim() || '';
  const prepRaw  = schema?.prepTime  || $('[class*="prep-time"], [class*="prepTime"]').text().trim() || '';
  const totalRaw = schema?.totalTime || $('[class*="total-time"], [class*="totalTime"]').text().trim() || '';

  let cook_time_mins = parseTimeToMins(cookRaw)
    ?? parseTimeToMins(totalRaw)
    ?? parseTimeToMins(prepRaw)
    ?? 30;

  // ── Servings ──────────────────────────────────────────────────────────────
  let servings = 4;
  const servStr = String(schema?.recipeYield ?? '').match(/\d+/);
  if (servStr) servings = parseInt(servStr[0], 10);
  else {
    const wpServings = $('.wprm-recipe-servings').text().trim();
    if (wpServings) servings = parseInt(wpServings, 10) || 4;
  }

  // ── Ingredients ───────────────────────────────────────────────────────────
  const ingredients_summary = parseIngredients($, schema);

  // ── Cuisine & tags ────────────────────────────────────────────────────────
  const cuisine = schema?.recipeCuisine
    ? (Array.isArray(schema.recipeCuisine) ? schema.recipeCuisine[0] : schema.recipeCuisine)
    : 'Singaporean';

  const dietary_tags = inferDietaryTags(ingredients_summary, name);
  const meal_type    = inferMealType(name);
  const dish_type    = inferDishType(name, ingredients_summary);

  return {
    name:                name.slice(0, 200),
    source_url:          url,
    thumbnail_url:       thumbnail_url ?? null,
    cuisine:             String(cuisine).slice(0, 100),
    avg_rating:          4.5,   // default — site doesn't show star ratings
    rating_count:        500,   // minimum allowed by schema
    cook_time_mins:      Math.max(1, Math.min(cook_time_mins, 480)),
    servings:            Math.max(1, Math.min(servings, 20)),
    ingredients_summary,
    dietary_tags,
    meal_type,
    dish_type,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🍜 Scraping up to ${MAX_RECIPES} recipes from ${BASE_URL}\n`);

  // ── Step 1: Get existing source_urls to avoid duplicates ─────────────────
  const { data: existing } = await supabase
    .from('recipes')
    .select('source_url')
    .like('source_url', `%mysingaporefood%`);

  const existingUrls = new Set((existing || []).map((r) => r.source_url));
  console.log(`Already in DB from this site: ${existingUrls.size}\n`);

  // ── Step 2: Collect recipe URLs ───────────────────────────────────────────
  console.log('Collecting recipe URLs from listing pages…');
  const allUrls = await collectRecipeUrls(MAX_RECIPES + existingUrls.size + 20);
  const newUrls = allUrls.filter((u) => !existingUrls.has(u));
  const toScrape = newUrls.slice(0, MAX_RECIPES);
  console.log(`\nURLs found: ${allUrls.length}, new: ${newUrls.length}, will scrape: ${toScrape.length}\n`);

  if (toScrape.length === 0) {
    console.log('Nothing new to scrape.');
    return;
  }

  // ── Step 3: Scrape each recipe ────────────────────────────────────────────
  const inserted = [];
  const failed   = [];

  for (let i = 0; i < toScrape.length; i++) {
    const url = toScrape[i];
    process.stdout.write(`[${String(i + 1).padStart(3)}/${toScrape.length}] ${url.replace(BASE_URL, '')} … `);

    const recipe = await scrapeRecipe(url);
    if (!recipe) {
      console.log('⚠️  parse failed');
      failed.push(url);
      await sleep(500);
      continue;
    }

    const { error } = await supabase
      .from('recipes')
      .upsert(recipe, { onConflict: 'source_url', ignoreDuplicates: true });

    if (error) {
      console.log(`❌ DB error: ${error.message}`);
      failed.push(url);
    } else {
      console.log(`✅ ${recipe.name}`);
      inserted.push(recipe.name);
    }

    await sleep(700); // polite delay
  }

  // ── Step 4: Summary ───────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Inserted : ${inserted.length}`);
  console.log(`⚠️  Failed   : ${failed.length}`);

  const { count } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true });

  console.log(`\n✅ Total recipes in DB now: ${count}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
