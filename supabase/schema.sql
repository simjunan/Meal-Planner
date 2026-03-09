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
-- 6. Trigger: auto-create profile row when a new auth user signs up
-- Runs as SECURITY DEFINER so it bypasses RLS
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------
-- 7. Helper function: get email by user id (used for username login)
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
-- 8. Seed sample recipes (run once to populate the recipes table)
-- ---------------------------------------------------------------
INSERT INTO public.recipes (name, source_url, cuisine, avg_rating, rating_count, cook_time_mins, servings, ingredients_summary, dietary_tags, meal_type)
VALUES
  ('Kung Pao Chicken', 'https://example.com/kung-pao-chicken', 'Sichuan', 4.8, 12500, 30, 4, ARRAY['chicken breast', 'peanuts', 'dried chillies', 'sichuan pepper', 'soy sauce', 'vinegar', 'sugar'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Steamed Fish with Ginger', 'https://example.com/steamed-fish', 'Cantonese', 4.7, 8300, 25, 2, ARRAY['sea bass', 'ginger', 'spring onion', 'light soy sauce', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Mapo Tofu', 'https://example.com/mapo-tofu', 'Sichuan', 4.9, 15000, 20, 3, ARRAY['soft tofu', 'minced pork', 'doubanjiang', 'sichuan pepper', 'garlic', 'ginger'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Char Siu Pork', 'https://example.com/char-siu', 'Cantonese', 4.8, 9200, 50, 4, ARRAY['pork shoulder', 'hoisin sauce', 'honey', 'soy sauce', 'five spice', 'garlic'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Dan Dan Noodles', 'https://example.com/dan-dan-noodles', 'Sichuan', 4.7, 7800, 25, 2, ARRAY['noodles', 'minced pork', 'sesame paste', 'sichuan pepper', 'chilli oil', 'spring onion'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Wonton Soup', 'https://example.com/wonton-soup', 'Cantonese', 4.6, 6500, 35, 4, ARRAY['wonton wrappers', 'minced pork', 'prawns', 'ginger', 'sesame oil', 'chicken broth'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),
  ('Bibimbap', 'https://example.com/bibimbap', 'Korean', 4.8, 11200, 40, 2, ARRAY['rice', 'beef', 'spinach', 'carrot', 'zucchini', 'egg', 'gochujang', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Pad Thai', 'https://example.com/pad-thai', 'Thai', 4.7, 14300, 20, 2, ARRAY['rice noodles', 'prawns', 'tofu', 'bean sprouts', 'egg', 'tamarind paste', 'fish sauce', 'peanuts'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Japanese Ramen', 'https://example.com/ramen', 'Japanese', 4.9, 18600, 60, 2, ARRAY['ramen noodles', 'chashu pork', 'soft-boiled egg', 'nori', 'bamboo shoots', 'tonkotsu broth'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Green Curry', 'https://example.com/green-curry', 'Thai', 4.7, 9800, 30, 4, ARRAY['chicken', 'coconut milk', 'green curry paste', 'Thai basil', 'eggplant', 'fish sauce', 'lime leaves'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Vegetable Fried Rice', 'https://example.com/veg-fried-rice', 'Chinese', 4.5, 7200, 15, 2, ARRAY['jasmine rice', 'egg', 'carrot', 'peas', 'soy sauce', 'garlic', 'spring onion'], ARRAY['Vegetarian'], ARRAY['lunch', 'dinner']),
  ('Tofu Stir Fry', 'https://example.com/tofu-stir-fry', 'Chinese', 4.4, 5800, 20, 2, ARRAY['firm tofu', 'broccoli', 'bell pepper', 'soy sauce', 'oyster sauce', 'garlic', 'ginger'], ARRAY['Vegetarian', 'Vegan'], ARRAY['lunch', 'dinner']),
  ('Beef Pho', 'https://example.com/beef-pho', 'Vietnamese', 4.8, 13400, 90, 4, ARRAY['rice noodles', 'beef brisket', 'star anise', 'cinnamon', 'ginger', 'bean sprouts', 'basil', 'lime'], ARRAY['Gluten-Free'], ARRAY['breakfast', 'lunch', 'dinner']),
  ('Korean Fried Chicken', 'https://example.com/korean-fried-chicken', 'Korean', 4.9, 16700, 45, 4, ARRAY['chicken wings', 'potato starch', 'gochujang', 'garlic', 'soy sauce', 'honey', 'sesame seeds'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Tom Yum Soup', 'https://example.com/tom-yum', 'Thai', 4.6, 8100, 25, 2, ARRAY['prawns', 'lemongrass', 'galangal', 'lime leaves', 'mushrooms', 'fish sauce', 'lime juice', 'chilli'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner'])
ON CONFLICT (source_url) DO NOTHING;
