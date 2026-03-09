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
  -- ── Made With Lau (madewithlau.com) ── Cantonese home cooking
  ('Cantonese Chow Mein', 'https://www.madewithlau.com/recipes/cantonese-chow-mein', 'Cantonese', 4.8, 11200, 25, 3, ARRAY['egg noodles', 'bean sprouts', 'chives', 'soy sauce', 'oyster sauce', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Egg Fried Rice', 'https://www.madewithlau.com/recipes/egg-fried-rice', 'Cantonese', 4.7, 9800, 15, 2, ARRAY['jasmine rice', 'egg', 'spring onion', 'soy sauce', 'oyster sauce', 'sesame oil'], ARRAY['Vegetarian'], ARRAY['lunch', 'dinner']),
  ('Soy Sauce Chicken', 'https://www.madewithlau.com/recipes/soy-sauce-chicken', 'Cantonese', 4.9, 14600, 55, 4, ARRAY['whole chicken', 'soy sauce', 'oyster sauce', 'honey', 'garlic', 'ginger', 'star anise'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Char Siu (BBQ Pork)', 'https://www.madewithlau.com/recipes/char-siu-pork', 'Cantonese', 4.9, 16200, 60, 6, ARRAY['pork shoulder', 'dark brown sugar', 'oyster sauce', 'hoisin sauce', 'soy sauce', 'five spice', 'garlic'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Yangzhou Fried Rice', 'https://www.madewithlau.com/recipes/yangzhou-fried-rice', 'Cantonese', 4.7, 8400, 20, 3, ARRAY['jasmine rice', 'ham', 'prawns', 'peas', 'carrot', 'egg', 'soy sauce'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Pan-Fried Rice Noodles (Chow Fun)', 'https://www.madewithlau.com/recipes/pan-fried-rice-noodles', 'Cantonese', 4.8, 10300, 25, 3, ARRAY['flat rice noodles', 'beef', 'bean sprouts', 'spring onion', 'dark soy sauce', 'oyster sauce'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Hokkien Fried Rice', 'https://www.madewithlau.com/recipes/hokkien-fried-rice', 'Cantonese', 4.6, 7100, 20, 3, ARRAY['jasmine rice', 'rice noodles', 'chicken', 'prawns', 'soy sauce', 'oyster sauce', 'dark soy sauce'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),

  -- ── The Mediterranean Dish (themediterraneandish.com) ── Mediterranean
  ('Mediterranean Falafel Bowl', 'https://www.themediterraneandish.com/falafel-bowl-recipe/', 'Mediterranean', 4.8, 9700, 30, 4, ARRAY['chickpeas', 'falafel', 'hummus', 'feta', 'cucumber', 'tomato', 'pita'], ARRAY['Vegetarian'], ARRAY['lunch', 'dinner']),
  ('Authentic Tzatziki', 'https://www.themediterraneandish.com/tzatziki-sauce-recipe/', 'Greek', 4.7, 12100, 10, 6, ARRAY['Greek yogurt', 'cucumber', 'garlic', 'fresh dill', 'lemon juice', 'olive oil'], ARRAY['Vegetarian', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Easy Authentic Falafel', 'https://www.themediterraneandish.com/how-to-make-falafel/', 'Mediterranean', 4.8, 14500, 25, 6, ARRAY['dried chickpeas', 'fresh parsley', 'fresh coriander', 'onion', 'garlic', 'cumin', 'coriander powder'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Mediterranean Fish Shakshuka', 'https://www.themediterraneandish.com/mediterranean-fish-shakshuka/', 'Mediterranean', 4.7, 7800, 30, 6, ARRAY['cod fillet', 'tinned tomatoes', 'bell pepper', 'onion', 'turmeric', 'cumin', 'paprika'], ARRAY['Gluten-Free', 'Dairy-Free'], ARRAY['lunch', 'dinner']),
  ('Layered Hummus Dip', 'https://www.themediterraneandish.com/layered-hummus-dip-recipe/', 'Mediterranean', 4.6, 6300, 15, 8, ARRAY['chickpeas', 'tahini', 'lemon', 'garlic', 'olive oil', 'paprika', 'parsley'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch', 'dinner']),

  -- ── Maangchi (maangchi.com) ── Korean home cooking
  ('Kimchi Fried Rice (Kimchi-bokkeumbap)', 'https://www.maangchi.com/recipe/kimchi-bokkeumbap', 'Korean', 4.8, 18400, 15, 2, ARRAY['kimchi', 'cooked rice', 'pork belly', 'spring onion', 'sesame oil', 'gochugaru', 'egg'], ARRAY['Gluten-Free'], ARRAY['breakfast', 'lunch', 'dinner']),
  ('Bulgogi (Korean BBQ Beef)', 'https://www.maangchi.com/recipe/bulgogi', 'Korean', 4.9, 22100, 30, 4, ARRAY['beef sirloin', 'soy sauce', 'sugar', 'garlic', 'ginger', 'sesame oil', 'asian pear', 'spring onion'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('LA Galbi (Grilled Beef Short Ribs)', 'https://www.maangchi.com/recipe/la-galbi', 'Korean', 4.9, 15700, 30, 4, ARRAY['beef short ribs', 'soy sauce', 'sugar', 'garlic', 'pear juice', 'sesame oil', 'spring onion'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Spicy Bulgogi', 'https://www.maangchi.com/recipe/spicy-bulgogi', 'Korean', 4.7, 9300, 20, 4, ARRAY['beef', 'gochugaru', 'soy sauce', 'garlic', 'sesame oil', 'spring onion', 'sugar'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Seafood Kimchi Fried Rice', 'https://www.maangchi.com/recipe/haemul-kimchi-bokkeumbap', 'Korean', 4.8, 8100, 20, 2, ARRAY['kimchi', 'cooked rice', 'prawns', 'squid', 'sesame oil', 'spring onion', 'egg'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Bokkeumbap (Regular Fried Rice)', 'https://www.maangchi.com/recipe/bokkeumbap', 'Korean', 4.6, 7200, 15, 2, ARRAY['cooked rice', 'carrot', 'onion', 'spring onion', 'soy sauce', 'sesame oil', 'egg'], ARRAY['Vegetarian'], ARRAY['breakfast', 'lunch', 'dinner']),

  -- ── Red House Spice (redhousespice.com) ── Chinese/Sichuan
  ('Mapo Tofu (Authentic)', 'https://redhousespice.com/mapo-tofu-authentic-way/', 'Sichuan', 4.9, 17300, 20, 4, ARRAY['soft tofu', 'minced pork', 'doubanjiang', 'sichuan pepper', 'garlic', 'ginger', 'spring onion'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Kung Pao Chicken (Authentic)', 'https://redhousespice.com/kung-pao-chicken/', 'Sichuan', 4.8, 14900, 20, 4, ARRAY['chicken breast', 'peanuts', 'dried chillies', 'sichuan pepper', 'soy sauce', 'vinegar', 'sugar', 'garlic'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Chow Mein (Chinese Fried Noodles)', 'https://redhousespice.com/chow-mein/', 'Chinese', 4.7, 11600, 15, 3, ARRAY['egg noodles', 'cabbage', 'carrot', 'spring onion', 'soy sauce', 'oyster sauce', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Sichuan Dumplings (Zhong Dumplings)', 'https://redhousespice.com/sichuan-dumplings/', 'Sichuan', 4.8, 9400, 30, 4, ARRAY['dumpling wrappers', 'minced pork', 'ginger', 'soy sauce', 'chilli oil', 'sichuan pepper', 'garlic'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Pan-Fried Vegetarian Dumplings', 'https://redhousespice.com/pan-fried-vegetarian-dumplings/', 'Chinese', 4.7, 8200, 35, 4, ARRAY['dumpling wrappers', 'tofu', 'cabbage', 'carrot', 'mushrooms', 'ginger', 'soy sauce', 'sesame oil'], ARRAY['Vegetarian', 'Vegan'], ARRAY['lunch', 'dinner']),
  ('Chow Mei Fun (Rice Vermicelli)', 'https://redhousespice.com/chow-mei-fun/', 'Chinese', 4.6, 7500, 15, 2, ARRAY['rice vermicelli', 'prawns', 'pork', 'bean sprouts', 'spring onion', 'soy sauce', 'curry powder'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),

  -- ── Malaysian Chinese Kitchen (malaysianchinesekitchen.com) ── Malaysian Chinese
  ('Char Siu (Malaysian BBQ Pork)', 'https://www.malaysianchinesekitchen.com/char-siu-chinese-barbecue-pork/', 'Malaysian Chinese', 4.8, 10800, 60, 6, ARRAY['pork shoulder', 'soy sauce', 'hoisin sauce', 'honey', 'garlic', 'five spice', 'red yeast rice powder'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Char Siu Bao (Steamed Pork Buns)', 'https://www.malaysianchinesekitchen.com/char-siu-bao-steamed-barbecue-pork-buns/', 'Malaysian Chinese', 4.8, 9100, 90, 16, ARRAY['flour', 'yeast', 'sugar', 'char siu pork', 'oyster sauce', 'soy sauce', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),
  ('Curry Laksa', 'https://www.malaysianchinesekitchen.com/curry-laksa-curry-mee/', 'Malaysian Chinese', 4.9, 13200, 30, 4, ARRAY['rice noodles', 'coconut milk', 'curry paste', 'chicken', 'tofu puffs', 'bean sprouts', 'prawns', 'hard boiled egg'], ARRAY['Gluten-Free'], ARRAY['breakfast', 'lunch', 'dinner']),
  ('Char Hor Fun (Fried Flat Rice Noodles)', 'https://www.malaysianchinesekitchen.com/char-hor-fun/', 'Malaysian Chinese', 4.7, 8600, 15, 2, ARRAY['flat rice noodles', 'prawns', 'beef', 'bean sprouts', 'choy sum', 'egg', 'dark soy sauce', 'oyster sauce'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Sweet Potato Congee', 'https://www.malaysianchinesekitchen.com/sweet-potato-congee/', 'Malaysian Chinese', 4.5, 5400, 45, 4, ARRAY['jasmine rice', 'sweet potato', 'ginger', 'spring onion', 'sesame oil', 'salt'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['breakfast']),
  ('Seremban Siew Pau (Baked BBQ Buns)', 'https://www.malaysianchinesekitchen.com/seremban-siew-pau-baked-bbq-buns/', 'Malaysian Chinese', 4.8, 7300, 60, 16, ARRAY['flour', 'butter', 'sugar', 'yeast', 'char siu pork', 'oyster sauce', 'sesame oil'], ARRAY[]::TEXT[], ARRAY['breakfast', 'lunch']),

  -- ── Recipe30 (recipe30.com) ── French / Western
  ('Chicken Francaise', 'https://recipe30.com/chicken-francaise.html/', 'French', 4.7, 8900, 20, 4, ARRAY['chicken breast', 'egg', 'parmesan', 'lemon', 'butter', 'white wine', 'parsley'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('French Peas (Petits Pois à la Française)', 'https://recipe30.com/french-peas.html/', 'French', 4.5, 5600, 20, 4, ARRAY['peas', 'lettuce', 'spring onion', 'shallots', 'butter', 'chicken bouillon', 'sugar'], ARRAY['Vegetarian', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('French Carrot Salad', 'https://recipe30.com/french-carrot-salad/', 'French', 4.6, 6200, 15, 4, ARRAY['carrots', 'lemon juice', 'Dijon mustard', 'olive oil', 'parsley', 'garlic'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch']),
  ('Walnut-Crusted Chicken', 'https://recipe30.com/walnut-crusted-chicken/', 'French', 4.7, 7100, 25, 4, ARRAY['chicken breast', 'walnuts', 'breadcrumbs', 'egg', 'Dijon mustard', 'olive oil', 'thyme'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Chicken and Mushroom Crêpes au Gratin', 'https://recipe30.com/crepes-au-gratin/', 'French', 4.8, 8400, 45, 4, ARRAY['crêpes', 'chicken', 'mushrooms', 'béchamel sauce', 'gruyere cheese', 'shallots', 'butter', 'thyme'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),

  -- ── Just One Cookbook (justonecookbook.com) ── Japanese
  ('Chicken Yakisoba', 'https://www.justonecookbook.com/chicken-yakisoba/', 'Japanese', 4.8, 13100, 20, 2, ARRAY['yakisoba noodles', 'chicken thighs', 'cabbage', 'carrot', 'spring onion', 'Worcestershire sauce', 'oyster sauce', 'ketchup'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Chicken Teriyaki', 'https://www.justonecookbook.com/chicken-teriyaki/', 'Japanese', 4.8, 17600, 15, 4, ARRAY['chicken thighs', 'soy sauce', 'sake', 'mirin', 'sugar', 'sesame seeds', 'spring onion'], ARRAY['Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Gyudon (Japanese Beef Rice Bowl)', 'https://www.justonecookbook.com/gyudon/', 'Japanese', 4.8, 14200, 15, 4, ARRAY['thinly sliced beef', 'onion', 'steamed rice', 'dashi', 'soy sauce', 'mirin', 'sugar', 'pickled ginger'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Sukiyaki', 'https://www.justonecookbook.com/sukiyaki/', 'Japanese', 4.9, 11800, 30, 4, ARRAY['beef sirloin', 'tofu', 'shirataki noodles', 'Chinese cabbage', 'mushrooms', 'spring onion', 'sukiyaki sauce'], ARRAY[]::TEXT[], ARRAY['dinner']),
  ('Chicken Katsu', 'https://www.justonecookbook.com/chicken-katsu/', 'Japanese', 4.8, 15300, 20, 4, ARRAY['chicken breast', 'panko breadcrumbs', 'egg', 'flour', 'tonkatsu sauce', 'cabbage', 'steamed rice'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),
  ('Miso Soup', 'https://www.justonecookbook.com/how-to-make-miso-soup/', 'Japanese', 4.7, 12400, 10, 4, ARRAY['white miso paste', 'silken tofu', 'wakame seaweed', 'spring onion', 'dashi'], ARRAY['Vegetarian', 'Vegan'], ARRAY['breakfast', 'lunch', 'dinner']),
  ('Japanese Gyoza', 'https://www.justonecookbook.com/gyoza/', 'Japanese', 4.9, 19800, 35, 4, ARRAY['minced pork', 'cabbage', 'garlic', 'ginger', 'sesame oil', 'gyoza wrappers', 'soy sauce', 'rice vinegar'], ARRAY[]::TEXT[], ARRAY['lunch', 'dinner']),

  -- ── Love and Lemons (loveandlemons.com) ── Vegetarian / Healthy
  ('Vegetarian Chili', 'https://www.loveandlemons.com/vegetarian-chili-recipe/', 'Western', 4.8, 14700, 35, 4, ARRAY['pinto beans', 'kidney beans', 'tinned tomatoes', 'bell peppers', 'corn', 'chipotle', 'cumin', 'smoked paprika'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Lentil Soup', 'https://www.loveandlemons.com/lentil-soup/', 'Western', 4.8, 16300, 35, 6, ARRAY['green lentils', 'carrot', 'celery', 'onion', 'garlic', 'kale', 'vegetable broth', 'lemon'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Red Lentil Soup', 'https://www.loveandlemons.com/red-lentil-soup/', 'Western', 4.7, 11900, 30, 6, ARRAY['red lentils', 'carrot', 'celery', 'onion', 'coconut milk', 'ginger', 'turmeric', 'lemon'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Curry Lentil Soup', 'https://www.loveandlemons.com/curry-lentil-soup/', 'Western', 4.7, 9600, 30, 6, ARRAY['lentils', 'coconut milk', 'garlic', 'ginger', 'curry powder', 'garam masala', 'spinach', 'lemon'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch', 'dinner']),
  ('Lentil Salad', 'https://www.loveandlemons.com/lentil-salad/', 'Western', 4.6, 8200, 20, 4, ARRAY['cooked lentils', 'olives', 'feta', 'cucumber', 'tomato', 'red onion', 'lemon dressing', 'parsley'], ARRAY['Vegetarian', 'Gluten-Free'], ARRAY['lunch']),
  ('Curried Lentil Salad', 'https://www.loveandlemons.com/lentil-salad-recipe/', 'Western', 4.6, 7400, 20, 4, ARRAY['cooked lentils', 'curry powder', 'cumin', 'carrot', 'celery', 'lemon', 'olive oil', 'parsley'], ARRAY['Vegetarian', 'Vegan', 'Gluten-Free'], ARRAY['lunch'])
ON CONFLICT (source_url) DO NOTHING;
