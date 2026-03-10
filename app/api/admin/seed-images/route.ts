/**
 * GET /api/admin/seed-images?secret=<SUPABASE_SERVICE_ROLE_KEY>&limit=15
 *
 * For every recipe that has no thumbnail_url this route:
 *  1. Fetches the recipe's source page and extracts the og:image meta tag.
 *  2. Falls back to a Pollinations.ai AI-generated image URL (free, no API key).
 *  3. Writes the URL back to the recipes table.
 *
 * Call repeatedly until the response shows "remaining": 0.
 * Keep limit ≤ 15 to stay within Vercel Hobby's 10s timeout (no &offset needed —
 * each call automatically picks up the next batch of un-imaged recipes).
 *
 * Example:
 *   curl "https://your-app.vercel.app/api/admin/seed-images?secret=SERVICE_ROLE_KEY&limit=15"
 *   # repeat until remaining=0
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
 * Stable Pollinations.ai URL — same seed → same image every time.
 * Images are generated on first browser load and then cached by the browser.
 */
function pollinationsUrl(recipeName: string, cuisine: string): string {
  const prompt = encodeURIComponent(
    `${recipeName}, ${cuisine} cuisine, appetizing food photography, ` +
    `professional studio lighting, shallow depth of field`
  );
  const seed = hashCode(recipeName);
  return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=600&nologo=true&seed=${seed}`;
}

/** Fetch a URL with a browser-like UA and a strict timeout. */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000); // 4 s max
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
    // Only read the first 64 KB — og:image is always in <head>
    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = '';
    let done = false;
    while (!done && html.length < 65536) {
      const chunk = await reader.read();
      done = chunk.done;
      if (chunk.value) html += new TextDecoder().decode(chunk.value);
    }
    reader.cancel().catch(() => {});
    return html;
  } catch {
    return null;
  }
}

// ── route handler ─────────────────────────────────────────────────────────────

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // ── auth ──────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || secret !== serviceRoleKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Default limit 15 — safe for Vercel Hobby 10 s limit per function
  const limit = Math.min(Number(searchParams.get('limit') ?? 15), 30);

  // ── supabase admin client ─────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  // ── fetch next batch of recipes without images ────────────────────────────
  // No OFFSET needed: every call fetches the first N recipes still missing images.
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, source_url, cuisine')
    .is('thumbnail_url', null)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!recipes || recipes.length === 0) {
    return NextResponse.json({ message: 'All recipes already have images.', updated: 0, remaining: 0 });
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

    // 2 — fall back to Pollinations.ai (no API key; URL-based, deterministic)
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
  }

  // ── count remaining ───────────────────────────────────────────────────────
  const { count: remaining } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .is('thumbnail_url', null);

  return NextResponse.json({
    updated: results.length,
    failed: errors.length,
    remaining: remaining ?? 0,
    hint:
      (remaining ?? 0) > 0
        ? `Call again (no offset needed) to continue processing.`
        : 'All recipes now have images!',
    results,
    errors,
  });
}
