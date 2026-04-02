/**
 * GET /api/admin/scrape-singapore?secret=<SUPABASE_SERVICE_ROLE_KEY>&batch=10&page=1
 *
 * Crawls https://mysingaporefood.com/recipes/ (paginated) and inserts new
 * recipes into Supabase. Call repeatedly, incrementing &page, until
 * "inserted_total" stops growing or "found_on_page" is 0.
 *
 * Query params:
 *   secret  — your SUPABASE_SERVICE_ROLE_KEY (required)
 *   page    — listing page number to scrape (default 1)
 *   batch   — max recipes to insert per call (default 10, max 15)
 *   target  — total recipes to reach from this site (default 150)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';

export const maxDuration = 60;

const BASE = 'https://mysingaporefood.com';

const BROWSER: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchHtml(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res   = await fetch(url, { headers: BROWSER, redirect: 'follow', signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── Listing page: extract /recipe/* links ────────────────────────────────────

function extractRecipeLinks(html: string): string[] {
  const urls = new Set<string>();
  // Match every href that looks like a recipe URL
  const re = /href=["'](https?:\/\/mysingaporefood\.com\/recipe\/[^"'\/]+\/?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = m[1].replace(/\/$/, '') + '/';
    urls.add(url);
  }
  return [...urls];
}

// ── JSON-LD schema.org/Recipe parser ────────────────────────────────────────

function parseJsonLd(html: string): Record<string, unknown> | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]);
      const nodes: unknown[] = Array.isArray(json)
        ? json
        : json['@graph'] ?? [json];
      for (const node of nodes) {
        if ((node as Record<string,unknown>)['@type'] === 'Recipe') {
          return node as Record<string, unknown>;
        }
      }
    } catch { /* skip */ }
  }
  return null;
}

// ── Extract og:image ─────────────────────────────────────────────────────────

function ogImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

// ── Parse time string → minutes ─────────────────────────────────────────────

function toMins(raw: unknown): number | null {
  if (!raw) return null;
  const s = String(raw);
  const iso = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso) return (parseInt(iso[1] ?? '0') * 60) + parseInt(iso[2] ?? '0');
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*m/i);
  if (h || m) return (parseInt(h?.[1] ?? '0') * 60) + parseInt(m?.[1] ?? '0');
  const plain = parseInt(s);
  return isNaN(plain) ? null : plain;
}

// ── Infer fields from name + ingredients ────────────────────────────────────

function inferDishType(name: string, ingredients: string[]): string {
  const t = `${name} ${ingredients.join(' ')}`.toLowerCase();
  if (/soup|broth|stock|porridge|congee|laksa|bak kut|mee soto|sup/.test(t)) return 'soup';
  if (/chicken|pork|beef|fish|prawn|shrimp|crab|mutton|duck|squid|sotong|egg/.test(t)) return 'meat';
  if (/vegetable|tofu|tempe|spinach|kangkong|kailan|brinjal|eggplant/.test(t)) return 'vegetable';
  return 'other';
}

function inferMealType(name: string): string[] {
  const n = name.toLowerCase();
  if (/kueh|cake|pudding|tart|dessert|chendol|ice kachang|pineapple tart/.test(n)) return ['dessert'];
  if (/toast|breakfast|kaya/.test(n)) return ['breakfast', 'lunch'];
  return ['lunch', 'dinner'];
}

function inferDietaryTags(name: string, ingredients: string[]): string[] {
  const t = `${name} ${ingredients.join(' ')}`.toLowerCase();
  const tags: string[] = [];
  const hasMeat = /chicken|pork|beef|fish|prawn|shrimp|crab|mutton|duck|squid|lard|bacon|anchovy|ikan bilis/.test(t);
  const hasDairy = /milk|cream|butter|cheese/.test(t);
  const hasEgg = /\begg\b/.test(t);
  if (!hasMeat && !hasDairy && !hasEgg) tags.push('Vegan');
  else if (!hasMeat) tags.push('Vegetarian');
  if (!/flour|bread|soy sauce|mee|noodle|pasta|dumpling|wonton|kicap/.test(t)) tags.push('Gluten-Free');
  if (!hasDairy) tags.push('Dairy-Free');
  return tags;
}

// ── Parse a recipe page → DB row ────────────────────────────────────────────

interface RecipeRow {
  name: string;
  source_url: string;
  thumbnail_url: string | null;
  cuisine: string;
  avg_rating: number;
  rating_count: number;
  cook_time_mins: number;
  servings: number;
  ingredients_summary: string[];
  dietary_tags: string[];
  meal_type: string[];
  dish_type: string;
}

async function scrapeRecipe(url: string): Promise<RecipeRow | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const schema = parseJsonLd(html);

  // Name
  const name: string = String(
    schema?.name ??
    html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ??
    ''
  ).trim().replace(/&amp;/g, '&').replace(/&#\d+;/g, '').slice(0, 200);

  if (!name) return null;

  // Thumbnail
  let thumbnail_url: string | null = null;
  const img = schema?.image;
  if (typeof img === 'string') thumbnail_url = img;
  else if (Array.isArray(img) && img.length) thumbnail_url = typeof img[0] === 'string' ? img[0] : (img[0] as Record<string,string>)?.url ?? null;
  else if (img && typeof img === 'object') thumbnail_url = (img as Record<string,string>).url ?? null;
  if (!thumbnail_url) thumbnail_url = ogImage(html);

  // Cook time
  const rawCook  = schema?.cookTime ?? schema?.totalTime ?? schema?.prepTime;
  const cook_time_mins = Math.max(1, Math.min(toMins(rawCook) ?? 30, 480));

  // Servings
  const servRaw  = String(schema?.recipeYield ?? '').match(/\d+/);
  const servings = Math.max(1, Math.min(servRaw ? parseInt(servRaw[0]) : 4, 20));

  // Ingredients
  const ingredients_summary: string[] = (
    Array.isArray(schema?.recipeIngredient)
      ? (schema.recipeIngredient as string[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : (() => {
          // Fallback: extract from <li> elements inside ingredient sections
          const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
          const items: string[] = [];
          let lm: RegExpExecArray | null;
          while ((lm = liRe.exec(html)) !== null && items.length < 20) {
            const txt = lm[1].replace(/<[^>]+>/g, '').trim();
            if (txt.length > 2 && txt.length < 120) items.push(txt);
          }
          return items;
        })()
  );

  // Cuisine
  const cuisineRaw = schema?.recipeCuisine;
  const cuisine = cuisineRaw
    ? (Array.isArray(cuisineRaw) ? String(cuisineRaw[0]) : String(cuisineRaw))
    : 'Singaporean';

  const dietary_tags      = inferDietaryTags(name, ingredients_summary);
  const meal_type         = inferMealType(name);
  const dish_type         = inferDishType(name, ingredients_summary);

  return {
    name,
    source_url:          url,
    thumbnail_url,
    cuisine:             cuisine.slice(0, 100),
    avg_rating:          4.5,
    rating_count:        500,
    cook_time_mins,
    servings,
    ingredients_summary,
    dietary_tags,
    meal_type,
    dish_type,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret     = searchParams.get('secret');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!secret || secret !== serviceKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const page   = Math.max(1, Number(searchParams.get('page')  ?? 1));
  const batch  = Math.min(Number(searchParams.get('batch') ?? 10), 15);
  const target = Number(searchParams.get('target') ?? 150);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  // ── How many Singapore recipes already exist? ────────────────────────────
  const { count: alreadyInDb } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .like('source_url', '%mysingaporefood%');

  if ((alreadyInDb ?? 0) >= target) {
    return NextResponse.json({
      message: `Target of ${target} recipes already reached.`,
      inserted_total: alreadyInDb,
    });
  }

  // ── Fetch existing URLs to skip duplicates ───────────────────────────────
  const { data: existingRows } = await supabase
    .from('recipes')
    .select('source_url')
    .like('source_url', '%mysingaporefood%');

  const existingUrls = new Set((existingRows ?? []).map((r: {source_url: string}) => r.source_url));

  // ── Scrape listing page ──────────────────────────────────────────────────
  const listingUrl = page === 1
    ? `${BASE}/recipes/`
    : `${BASE}/recipes/page/${page}/`;

  const listingHtml = await fetchHtml(listingUrl);
  if (!listingHtml) {
    return NextResponse.json({
      error: `Could not fetch listing page ${page}`,
      hint: 'The site may be blocking requests. Try again or check if the URL is correct.',
    }, { status: 502 });
  }

  const allLinks = extractRecipeLinks(listingHtml);
  const newLinks = allLinks.filter((u) => !existingUrls.has(u)).slice(0, batch);
  const found_on_page = allLinks.length;

  // ── Scrape & insert each recipe ──────────────────────────────────────────
  const inserted: string[] = [];
  const failed:   string[] = [];

  for (const url of newLinks) {
    if ((alreadyInDb ?? 0) + inserted.length >= target) break;

    const row = await scrapeRecipe(url);
    if (!row) { failed.push(url); continue; }

    const { error } = await supabase
      .from('recipes')
      .upsert(row, { onConflict: 'source_url', ignoreDuplicates: true });

    if (error) failed.push(url);
    else inserted.push(row.name);
  }

  const { count: newTotal } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .like('source_url', '%mysingaporefood%');

  const remaining = Math.max(0, target - (newTotal ?? 0));
  const nextPage  = found_on_page > 0 ? page + 1 : null;

  return NextResponse.json({
    page,
    found_on_page,
    new_links_on_page: newLinks.length,
    inserted_this_call: inserted.length,
    inserted_names: inserted,
    failed_this_call: failed.length,
    inserted_total: newTotal ?? 0,
    target,
    remaining_needed: remaining,
    hint: remaining > 0 && nextPage
      ? `Call again with ?page=${nextPage}&batch=${batch}&secret=... to continue.`
      : remaining > 0
      ? 'No more listing pages found. Target not fully reached.'
      : `Done! ${target} recipes reached.`,
  });
}
