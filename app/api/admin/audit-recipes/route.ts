/**
 * GET /api/admin/audit-recipes?secret=<SUPABASE_SERVICE_ROLE_KEY>&limit=20
 *
 * Checks each recipe's source_url for a 404 response.
 * Deletes any dead (404) recipes from Supabase.
 * Call repeatedly until "remaining_unchecked" is 0.
 *
 * Query params:
 *   secret  — your SUPABASE_SERVICE_ROLE_KEY (required)
 *   limit   — recipes to check per call (default 20, max 40)
 *   offset  — skip first N recipes (default 0, auto-advance via response)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

async function checkUrl(url: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });
    clearTimeout(timer);
    return res.status;
  } catch {
    return null; // timeout / network error — keep recipe
  }
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!secret || secret !== serviceKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit  = Math.min(Number(searchParams.get('limit')  ?? 20), 40);
  const offset = Number(searchParams.get('offset') ?? 0);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  // ── Fetch batch ─────────────────────────────────────────────────────────
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, source_url')
    .order('crawled_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!recipes || recipes.length === 0) {
    const { count } = await supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true });
    return NextResponse.json({
      message: 'All recipes checked.',
      deleted_this_run: 0,
      remaining_unchecked: 0,
      total_remaining: count ?? 0,
    });
  }

  // ── Check each URL ───────────────────────────────────────────────────────
  const dead: { id: string; name: string; url: string }[] = [];
  const results: { name: string; url: string; status: number | null }[] = [];

  for (const r of recipes) {
    const status = await checkUrl(r.source_url);
    results.push({ name: r.name, url: r.source_url, status });
    if (status === 404) dead.push({ id: r.id, name: r.name, url: r.source_url });
  }

  // ── Delete dead recipes ──────────────────────────────────────────────────
  let deleted = 0;
  if (dead.length > 0) {
    const { error: delErr } = await supabase
      .from('recipes')
      .delete()
      .in('id', dead.map((r) => r.id));
    if (!delErr) deleted = dead.length;
  }

  // ── Counts ───────────────────────────────────────────────────────────────
  const { count: totalRemaining } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true });

  const nextOffset = offset + recipes.length - deleted;

  return NextResponse.json({
    checked:             recipes.length,
    deleted_this_run:    deleted,
    dead_recipes:        dead.map((r) => r.name),
    total_remaining:     totalRemaining ?? 0,
    remaining_unchecked: Math.max(0, (totalRemaining ?? 0) - nextOffset),
    next_offset:         nextOffset,
    hint:
      (totalRemaining ?? 0) - nextOffset > 0
        ? `Call again with ?offset=${nextOffset}&limit=${limit}&secret=... to continue.`
        : 'All recipes have been checked!',
    results,
  });
}
