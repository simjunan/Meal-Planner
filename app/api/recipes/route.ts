import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* ignore */ }
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('q') ?? '';
  const cuisine = searchParams.get('cuisine') ?? '';
  const cookTime = searchParams.get('cookTime') ?? '';
  const dietary = searchParams.get('dietary') ?? '';
  const sort = searchParams.get('sort') ?? 'popular';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = 24;
  const offset = (page - 1) * limit;

  let query = supabase.from('recipes').select('*', { count: 'exact' });

  if (search) {
    query = query.textSearch('search_vector', search, { type: 'websearch' });
  }

  if (cuisine && cuisine !== 'All') {
    query = query.eq('cuisine', cuisine);
  }

  if (cookTime === '<30') {
    query = query.lt('cook_time_mins', 30);
  } else if (cookTime === '30-60') {
    query = query.gte('cook_time_mins', 30).lte('cook_time_mins', 60);
  } else if (cookTime === '>60') {
    query = query.gt('cook_time_mins', 60);
  }

  if (dietary) {
    const tags = dietary.split(',').filter(Boolean);
    if (tags.length > 0) {
      query = query.contains('dietary_tags', tags);
    }
  }

  if (sort === 'popular') {
    query = query.order('rating_count', { ascending: false });
  } else if (sort === 'rated') {
    query = query.order('avg_rating', { ascending: false });
  } else if (sort === 'newest') {
    query = query.order('crawled_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ recipes: data, total: count ?? 0, page, limit });
}
