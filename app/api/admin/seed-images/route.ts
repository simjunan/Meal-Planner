/**
 * GET /api/admin/seed-images?secret=<SUPABASE_SERVICE_ROLE_KEY>&limit=50&offset=0
 *
 * For every recipe that has no thumbnail_url this route:
 *  1. Fetches the recipe's source page and extracts the og:image meta tag.
 *  2. Falls back to an AI-generated image via Pollinations.ai (free, no API key).
 *  3. Writes the image URL back to the recipes table.
 *
 * Designed to be called once (or in batches) from anywhere with internet access
 * — e.g. directly in the browser after deployment, or with curl.
 *
 * Example:
 *   curl "https://your-app.vercel.app/api/admin/seed-images?secret=SERVICE_ROLE_KEY"
 *   curl "https://your-app.vercel.app/api/admin/seed-images?secret=KEY&limit=50&offset=50"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extract the og:image URL from an HTML string. */
function extractOgImage(html: string): string | null {
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? match[1] : null;
}

/** Simple string → unsigned 32-bit hash (for a stable Pollinations seed). */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Returns a Pollinations.ai URL that always generates the same image for the
 * same recipe name (seed is derived from the name hash).
 */
function pollinationsUrl(recipeName: string, cuisine: string): string {
  const prompt = encodeURIComponent(
    `${recipeName}, ${cuisine} cuisine, appetizing food photography, ` +
    `professional studio lighting, shallow depth of field, white background`
  );
  const seed = hashCode(recipeName);
  return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=600&nologo=true&seed=${seed}`;
}

/** Fetch a URL with a browser-like UA and a reasonable timeout. */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── route handler ─────────────────────────────────────────────────────────────

export const maxDuration = 60; // Vercel Pro allows up to 300 s; Hobby cap is 60 s

export async function GET(req: NextRequest) {
  // ── auth ──────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || secret !== serviceRoleKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── pagination params ─────────────────────────────────────────────────────
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
  const offset = Number(searchParams.get('offset') ?? 0);

  // ── supabase admin client ─────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  // ── fetch recipes without images ──────────────────────────────────────────
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, source_url, cuisine')
    .is('thumbnail_url', null)
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!recipes || recipes.length === 0) {
    return NextResponse.json({ message: 'All recipes already have images.', updated: 0 });
  }

  // ── process each recipe ───────────────────────────────────────────────────
  const results: { id: string; name: string; image: string; source: 'scraped' | 'ai' }[] = [];
  const errors: { id: string; name: string; error: string }[] = [];

  for (const recipe of recipes) {
    let imageUrl: string | null = null;
    let imgSource: 'scraped' | 'ai' = 'ai';

    // 1 — try to scrape og:image from the source page
    const html = await fetchPage(recipe.source_url);
    if (html) {
      imageUrl = extractOgImage(html);
      if (imageUrl) imgSource = 'scraped';
    }

    // 2 — fall back to AI-generated image (Pollinations.ai — free, no API key)
    if (!imageUrl) {
      imageUrl = pollinationsUrl(recipe.name, recipe.cuisine ?? 'food');
      imgSource = 'ai';
    }

    // 3 — persist
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ thumbnail_url: imageUrl })
      .eq('id', recipe.id);

    if (updateError) {
      errors.push({ id: recipe.id, name: recipe.name, error: updateError.message });
    } else {
      results.push({ id: recipe.id, name: recipe.name, image: imageUrl, source: imgSource });
    }

    // small delay to be polite to source websites
    await new Promise((r) => setTimeout(r, 300));
  }

  // ── how many are still left ───────────────────────────────────────────────
  const { count: remaining } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .is('thumbnail_url', null);

  return NextResponse.json({
    updated: results.length,
    failed: errors.length,
    remaining: remaining ?? 0,
    nextOffset: offset + limit,
    hint:
      (remaining ?? 0) > 0
        ? `Call again with ?secret=KEY&offset=${offset + limit} to continue.`
        : 'All recipes now have images!',
    results,
    errors,
  });
}
