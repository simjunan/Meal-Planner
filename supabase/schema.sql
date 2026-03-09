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
  -- Sichuan
  ('Kung Pao Chicken', 'https://example.com/kung-pao-chicken', 'Sichuan', 4.8, 12500, 30, 4, ARRAY['chicken breast', 'peanuts', 'dried chillies', 'sichuan pepper', 'soy sauce', 'vinegar', 'sugar'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Mapo Tofu', 'https://example.com/mapo-tofu', 'Sichuan', 4.9, 15000, 20, 3, ARRAY['soft tofu', 'minced pork', 'doubanjiang', 'sichuan pepper', 'garlic', 'ginger'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Dan Dan Noodles', 'https://example.com/dan-dan-noodles', 'Sichuan', 4.7, 7800, 25, 2, ARRAY['noodles', 'minced pork', 'sesame paste', 'sichuan pepper', 'chilli oil', 'spring onion'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Twice-Cooked Pork', 'https://example.com/twice-cooked-pork', 'Sichuan', 4.7, 6900, 40, 3, ARRAY['pork belly', 'doubanjiang', 'leek', 'black bean paste', 'soy sauce', 'sichuan pepper'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Sichuan Boiled Fish', 'https://example.com/sichuan-boiled-fish', 'Sichuan', 4.8, 8400, 35, 4, ARRAY['fish fillet', 'bean sprouts', 'dried chillies', 'sichuan pepper', 'chilli oil', 'garlic', 'ginger'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  -- Cantonese
  ('Steamed Fish with Ginger', 'https://example.com/steamed-fish', 'Cantonese', 4.7, 8300, 25, 2, ARRAY['sea bass', 'ginger', 'spring onion', 'light soy sauce', 'sesame oil'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Char Siu Pork', 'https://example.com/char-siu', 'Cantonese', 4.8, 9200, 50, 4, ARRAY['pork shoulder', 'hoisin sauce', 'honey', 'soy sauce', 'five spice', 'garlic'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Wonton Soup', 'https://example.com/wonton-soup', 'Cantonese', 4.6, 6500, 35, 4, ARRAY['wonton wrappers', 'minced pork', 'prawns', 'ginger', 'sesame oil', 'chicken broth'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),
  ('Dim Sum Har Gow', 'https://example.com/har-gow', 'Cantonese', 4.8, 9700, 45, 4, ARRAY['prawn', 'wheat starch', 'tapioca starch', 'sesame oil', 'ginger', 'spring onion'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),
  ('Congee with Century Egg', 'https://example.com/congee', 'Cantonese', 4.5, 5600, 60, 4, ARRAY['jasmine rice', 'century egg', 'salted egg', 'ginger', 'spring onion', 'sesame oil'], ARRAY['Gluten-Free'], ARRAY['breakfast']),
  ('Soy Sauce Chicken', 'https://example.com/soy-sauce-chicken', 'Cantonese', 4.7, 7300, 55, 4, ARRAY['whole chicken', 'soy sauce', 'dark soy sauce', 'rock sugar', 'star anise', 'ginger', 'spring onion'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  -- Chinese
  ('Vegetable Fried Rice', 'https://example.com/veg-fried-rice', 'Chinese', 4.5, 7200, 15, 2, ARRAY['jasmine rice', 'egg', 'carrot', 'peas', 'soy sauce', 'garlic', 'spring onion'], ARRAY['Vegetarian'], ARRAY['lunch', 'dinner']),
  ('Tofu Stir Fry', 'https://example.com/tofu-stir-fry', 'Chinese', 4.4, 5800, 20, 2, ARRAY['firm tofu', 'broccoli', 'bell pepper', 'soy sauce', 'oyster sauce', 'garlic', 'ginger'], ARRAY['Vegetarian', 'Vegan'], ARRAY['lunch', 'dinner']),
  ('Egg Fried Rice', 'https://example.com/egg-fried-rice', 'Chinese', 4.6, 11000, 10, 2, ARRAY['cooked rice', 'egg', 'soy sauce', 'spring onion', 'sesame oil', 'garlic'], ARRAY['Vegetarian'], ARRAY['lunch', 'dinner']),
  ('Sweet and Sour Pork', 'https://example.com/sweet-sour-pork', 'Chinese', 4.6, 10200, 35, 4, ARRAY['pork tenderloin', 'bell peppers', 'pineapple', 'vinegar', 'ketchup', 'sugar', 'soy sauce'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Beef and Broccoli', 'https://example.com/beef-broccoli', 'Chinese', 4.5, 9100, 25, 3, ARRAY['beef sirloin', 'broccoli', 'oyster sauce', 'soy sauce', 'garlic', 'ginger', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Spring Rolls', 'https://example.com/spring-rolls', 'Chinese', 4.5, 8600, 40, 4, ARRAY['spring roll wrappers', 'cabbage', 'carrot', 'glass noodles', 'mushrooms', 'soy sauce'], ARRAY['Vegan'], ARRAY['lunch', 'dinner']),
  -- Shanghainese
  ('Xiaolongbao', 'https://example.com/xiaolongbao', 'Shanghainese', 4.9, 14200, 90, 4, ARRAY['pork mince', 'gelatin broth', 'ginger', 'soy sauce', 'sesame oil', 'dumpling wrappers'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),
  ('Red-Braised Pork Belly', 'https://example.com/red-braised-pork', 'Shanghainese', 4.9, 12800, 90, 4, ARRAY['pork belly', 'soy sauce', 'dark soy sauce', 'shaoxing wine', 'rock sugar', 'star anise', 'ginger'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Shanghai Pan-Fried Buns', 'https://example.com/sheng-jian-bao', 'Shanghainese', 4.8, 9300, 50, 4, ARRAY['pork mince', 'gelatin broth', 'spring onion', 'ginger', 'sesame seeds', 'bun dough'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),
  -- Taiwanese
  ('Beef Noodle Soup', 'https://example.com/taiwanese-beef-noodle', 'Taiwanese', 4.9, 13600, 120, 4, ARRAY['beef shank', 'wheat noodles', 'doubanjiang', 'soy sauce', 'tomato', 'star anise', 'garlic', 'ginger'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Three-Cup Chicken', 'https://example.com/three-cup-chicken', 'Taiwanese', 4.8, 10400, 30, 4, ARRAY['chicken thighs', 'soy sauce', 'sesame oil', 'rice wine', 'Thai basil', 'garlic', 'ginger', 'sugar'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Oyster Vermicelli', 'https://example.com/oyster-vermicelli', 'Taiwanese', 4.6, 6700, 30, 2, ARRAY['oysters', 'sweet potato starch', 'vermicelli', 'sweet potato', 'garlic', 'oyster sauce'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  -- Japanese
  ('Japanese Ramen', 'https://example.com/ramen', 'Japanese', 4.9, 18600, 60, 2, ARRAY['ramen noodles', 'chashu pork', 'soft-boiled egg', 'nori', 'bamboo shoots', 'tonkotsu broth'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Chicken Katsu Curry', 'https://example.com/katsu-curry', 'Japanese', 4.8, 14100, 45, 2, ARRAY['chicken breast', 'panko breadcrumbs', 'Japanese curry roux', 'carrot', 'potato', 'onion', 'rice'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Salmon Sushi Rolls', 'https://example.com/salmon-rolls', 'Japanese', 4.7, 10800, 40, 2, ARRAY['sushi rice', 'smoked salmon', 'avocado', 'cucumber', 'nori', 'rice vinegar', 'wasabi', 'soy sauce'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Miso Soup with Tofu', 'https://example.com/miso-soup', 'Japanese', 4.5, 8200, 10, 2, ARRAY['white miso paste', 'silken tofu', 'wakame seaweed', 'spring onion', 'dashi'], ARRAY['Vegetarian', 'Vegan'], ARRAY['breakfast', 'lunch', 'dinner']),
  ('Gyoza', 'https://example.com/gyoza', 'Japanese', 4.8, 12300, 35, 4, ARRAY['minced pork', 'cabbage', 'garlic', 'ginger', 'sesame oil', 'gyoza wrappers', 'soy sauce', 'rice vinegar'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Okonomiyaki', 'https://example.com/okonomiyaki', 'Japanese', 4.7, 8900, 30, 2, ARRAY['cabbage', 'flour', 'egg', 'pork belly', 'spring onion', 'okonomiyaki sauce', 'bonito flakes', 'mayo'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  -- Korean
  ('Bibimbap', 'https://example.com/bibimbap', 'Korean', 4.8, 11200, 40, 2, ARRAY['rice', 'beef', 'spinach', 'carrot', 'zucchini', 'egg', 'gochujang', 'sesame oil'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Korean Fried Chicken', 'https://example.com/korean-fried-chicken', 'Korean', 4.9, 16700, 45, 4, ARRAY['chicken wings', 'potato starch', 'gochujang', 'garlic', 'soy sauce', 'honey', 'sesame seeds'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Kimchi Jjigae', 'https://example.com/kimchi-jjigae', 'Korean', 4.7, 9600, 30, 3, ARRAY['kimchi', 'pork belly', 'tofu', 'spring onion', 'gochugaru', 'soy sauce', 'sesame oil'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Japchae', 'https://example.com/japchae', 'Korean', 4.6, 7400, 35, 4, ARRAY['glass noodles', 'beef', 'spinach', 'mushrooms', 'carrot', 'onion', 'soy sauce', 'sesame oil', 'sugar'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Bulgogi', 'https://example.com/bulgogi', 'Korean', 4.8, 13200, 25, 4, ARRAY['beef sirloin', 'soy sauce', 'sesame oil', 'sugar', 'garlic', 'ginger', 'pear', 'spring onion'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Sundubu Jjigae', 'https://example.com/sundubu-jjigae', 'Korean', 4.7, 8100, 25, 2, ARRAY['soft tofu', 'pork', 'clams', 'gochugaru', 'egg', 'spring onion', 'soy sauce', 'sesame oil'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  -- Thai
  ('Pad Thai', 'https://example.com/pad-thai', 'Thai', 4.7, 14300, 20, 2, ARRAY['rice noodles', 'prawns', 'tofu', 'bean sprouts', 'egg', 'tamarind paste', 'fish sauce', 'peanuts'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Green Curry', 'https://example.com/green-curry', 'Thai', 4.7, 9800, 30, 4, ARRAY['chicken', 'coconut milk', 'green curry paste', 'Thai basil', 'eggplant', 'fish sauce', 'lime leaves'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Tom Yum Soup', 'https://example.com/tom-yum', 'Thai', 4.6, 8100, 25, 2, ARRAY['prawns', 'lemongrass', 'galangal', 'lime leaves', 'mushrooms', 'fish sauce', 'lime juice', 'chilli'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Massaman Curry', 'https://example.com/massaman-curry', 'Thai', 4.8, 10500, 50, 4, ARRAY['beef', 'coconut milk', 'massaman curry paste', 'potato', 'peanuts', 'fish sauce', 'tamarind', 'palm sugar'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Pad See Ew', 'https://example.com/pad-see-ew', 'Thai', 4.6, 7600, 15, 2, ARRAY['wide rice noodles', 'chicken', 'Chinese broccoli', 'egg', 'dark soy sauce', 'oyster sauce', 'garlic'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Mango Sticky Rice', 'https://example.com/mango-sticky-rice', 'Thai', 4.9, 11800, 30, 2, ARRAY['glutinous rice', 'mango', 'coconut milk', 'sugar', 'salt', 'sesame seeds'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['dinner']),
  -- Vietnamese
  ('Beef Pho', 'https://example.com/beef-pho', 'Vietnamese', 4.8, 13400, 90, 4, ARRAY['rice noodles', 'beef brisket', 'star anise', 'cinnamon', 'ginger', 'bean sprouts', 'basil', 'lime'], ARRAY['Gluten-Free'], ARRAY['breakfast', 'lunch', 'dinner']),
  ('Banh Mi', 'https://example.com/banh-mi', 'Vietnamese', 4.7, 10900, 20, 2, ARRAY['baguette', 'char siu pork', 'pate', 'pickled carrot', 'daikon', 'cucumber', 'coriander', 'chilli'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),
  ('Bun Bo Hue', 'https://example.com/bun-bo-hue', 'Vietnamese', 4.7, 7800, 90, 4, ARRAY['rice vermicelli', 'pork hock', 'beef shank', 'lemongrass', 'shrimp paste', 'chilli oil'], ARRAY['Gluten-Free'], ARRAY['breakfast', 'lunch', 'dinner']),
  ('Goi Cuon', 'https://example.com/goi-cuon', 'Vietnamese', 4.6, 8500, 25, 4, ARRAY['rice paper', 'prawns', 'pork', 'rice vermicelli', 'lettuce', 'mint', 'coriander', 'hoisin sauce', 'peanuts'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Com Tam', 'https://example.com/com-tam', 'Vietnamese', 4.7, 9100, 35, 2, ARRAY['broken rice', 'grilled pork chop', 'shredded pork skin', 'egg meatloaf', 'spring onion oil', 'fish sauce'], ARRAY['Gluten-Free'], ARRAY['breakfast', 'lunch', 'dinner']),
  -- Western
  ('Aglio e Olio', 'https://example.com/aglio-e-olio', 'Western', 4.6, 9400, 15, 2, ARRAY['spaghetti', 'garlic', 'olive oil', 'chilli flakes', 'parsley', 'parmesan'], ARRAY['Vegetarian'], ARRAY['lunch', 'dinner']),
  ('Grilled Salmon', 'https://example.com/grilled-salmon', 'Western', 4.7, 10200, 20, 2, ARRAY['salmon fillet', 'lemon', 'garlic', 'olive oil', 'rosemary', 'capers'], ARRAY['Gluten-Free', 'Dairy-Free'], ARRAY['lunch', 'dinner']),
  ('Caesar Salad', 'https://example.com/caesar-salad', 'Western', 4.5, 7600, 15, 2, ARRAY['romaine lettuce', 'parmesan', 'croutons', 'caesar dressing', 'anchovies', 'lemon'], ARRAY['Vegetarian'], ARRAY['lunch']),
  ('Mushroom Risotto', 'https://example.com/mushroom-risotto', 'Western', 4.7, 8800, 40, 4, ARRAY['arborio rice', 'mixed mushrooms', 'parmesan', 'white wine', 'shallots', 'garlic', 'butter', 'thyme'], ARRAY['Vegetarian', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Chicken Tikka Masala', 'https://example.com/chicken-tikka-masala', 'Western', 4.8, 12600, 45, 4, ARRAY['chicken breast', 'yogurt', 'tomato sauce', 'cream', 'garam masala', 'cumin', 'coriander', 'garlic', 'ginger'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner'])
ON CONFLICT (source_url) DO NOTHING;
