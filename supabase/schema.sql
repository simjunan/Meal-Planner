-- =============================================================
-- MealMate — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- =============================================================

-- ---------------------------------------------------------------
-- 1. profiles (extends auth.users)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL
                CHECK (char_length(username) BETWEEN 3 AND 30)
                CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------
-- 2. recipes
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  source_url           TEXT UNIQUE NOT NULL,
  thumbnail_url        TEXT,
  cuisine              TEXT,
  avg_rating           NUMERIC(3,2),
  rating_count         INTEGER CHECK (rating_count >= 500),
  cook_time_mins       INTEGER,
  servings             INTEGER,
  ingredients_summary  TEXT[],
  dietary_tags         TEXT[],
  meal_type            TEXT[],
  search_vector        TSVECTOR,
  crawled_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION public.update_recipe_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.cuisine, '') || ' ' ||
    coalesce(array_to_string(NEW.ingredients_summary, ' '), '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_search_vector_update ON public.recipes;
CREATE TRIGGER recipe_search_vector_update
  BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_search_vector();

CREATE INDEX IF NOT EXISTS idx_recipes_search_vector ON public.recipes USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_recipes_rating_count ON public.recipes (rating_count DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON public.recipes (cuisine);

-- Recipes are public read (no RLS needed for reads; only service role writes)
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read recipes"
  ON public.recipes FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------
-- 3. meal_plans
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id   UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  plan_date   DATE NOT NULL,
  meal_slot   TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, plan_date, meal_slot)
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON public.meal_plans (user_id, plan_date);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal plans"
  ON public.meal_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 4. bookmarks
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id   UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks (user_id, created_at DESC);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
  ON public.bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 5. ai_recommendation_cache
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_recommendation_cache (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_date       DATE NOT NULL,
  recommendations  JSONB NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, cache_date)
);

ALTER TABLE public.ai_recommendation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recommendation cache"
  ON public.ai_recommendation_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 6. Helper function: get email by user id (used for username login)
-- This runs as SECURITY DEFINER so it can read auth.users
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_email_by_user_id(uid UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  RETURN user_email;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_email_by_user_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_user_id(UUID) TO anon;

-- ---------------------------------------------------------------
-- 7. Seed sample recipes (optional — remove in production)
-- ---------------------------------------------------------------
-- INSERT INTO public.recipes (name, source_url, cuisine, avg_rating, rating_count, cook_time_mins, servings, ingredients_summary, dietary_tags, meal_type)
-- VALUES
--   ('Kung Pao Chicken', 'https://example.com/kung-pao-chicken', 'Sichuan', 4.8, 12500, 30, 4, ARRAY['chicken breast', 'peanuts', 'dried chillies', 'sichuan pepper', 'soy sauce', 'vinegar', 'sugar'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
--   ('Steamed Fish with Ginger', 'https://example.com/steamed-fish', 'Cantonese', 4.7, 8300, 25, 2, ARRAY['sea bass', 'ginger', 'spring onion', 'light soy sauce', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
--   ('Mapo Tofu', 'https://example.com/mapo-tofu', 'Sichuan', 4.9, 15000, 20, 3, ARRAY['soft tofu', 'minced pork', 'doubanjiang', 'sichuan pepper', 'garlic', 'ginger'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']);
