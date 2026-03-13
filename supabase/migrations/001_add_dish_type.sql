-- ================================================================
-- Migration 001: Add dish_type to recipes
-- Run this in Supabase SQL Editor AFTER schema.sql and the seed files.
-- ================================================================

-- 1. Add the column (nullable so existing rows don't break)
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS dish_type TEXT
  CHECK (dish_type IN ('soup', 'meat', 'vegetable', 'other'));

-- 2. Classify the original 48 seed recipes
UPDATE public.recipes SET dish_type = 'other'     WHERE source_url IN (
  'https://www.madewithlau.com/recipes/cantonese-chow-mein',
  'https://www.madewithlau.com/recipes/egg-fried-rice',
  'https://www.madewithlau.com/recipes/yangzhou-fried-rice',
  'https://www.madewithlau.com/recipes/pan-fried-rice-noodles',
  'https://www.madewithlau.com/recipes/hokkien-fried-rice',
  'https://www.maangchi.com/recipe/kimchi-bokkeumbap',
  'https://www.maangchi.com/recipe/haemul-kimchi-bokkeumbap',
  'https://www.maangchi.com/recipe/bokkeumbap',
  'https://redhousespice.com/chow-mein/',
  'https://redhousespice.com/sichuan-dumplings/',
  'https://redhousespice.com/chow-mei-fun/',
  'https://www.malaysianchinesekitchen.com/char-siu-bao-steamed-barbecue-pork-buns/',
  'https://www.malaysianchinesekitchen.com/char-hor-fun/',
  'https://www.malaysianchinesekitchen.com/seremban-siew-pau-baked-bbq-buns/',
  'https://www.justonecookbook.com/chicken-yakisoba/',
  'https://www.justonecookbook.com/gyoza/',
  'https://www.justonecookbook.com/sukiyaki/'
);

UPDATE public.recipes SET dish_type = 'soup' WHERE source_url IN (
  'https://www.malaysianchinesekitchen.com/curry-laksa/',
  'https://www.malaysianchinesekitchen.com/sweet-potato-congee/',
  'https://www.justonecookbook.com/how-to-make-miso-soup/',
  'https://www.loveandlemons.com/lentil-soup/',
  'https://www.loveandlemons.com/red-lentil-soup/',
  'https://www.loveandlemons.com/curry-lentil-soup/'
);

UPDATE public.recipes SET dish_type = 'meat' WHERE source_url IN (
  'https://www.madewithlau.com/recipes/soy-sauce-chicken',
  'https://www.madewithlau.com/recipes/char-siu-pork',
  'https://www.maangchi.com/recipe/bulgogi',
  'https://www.maangchi.com/recipe/la-galbi',
  'https://www.maangchi.com/recipe/spicy-bulgogi',
  'https://redhousespice.com/mapo-tofu-authentic-way/',
  'https://redhousespice.com/kung-pao-chicken/',
  'https://redhousespice.com/pan-fried-vegetarian-dumplings/',
  'https://www.malaysianchinesekitchen.com/char-siu-chinese-barbecue-pork/',
  'https://recipe30.com/chicken-francaise.html/',
  'https://recipe30.com/walnut-crusted-chicken/',
  'https://recipe30.com/crepes-au-gratin/',
  'https://www.justonecookbook.com/chicken-teriyaki/',
  'https://www.justonecookbook.com/gyudon/',
  'https://www.justonecookbook.com/chicken-katsu/',
  'https://www.themediterraneandish.com/mediterranean-fish-shakshuka/'
);

UPDATE public.recipes SET dish_type = 'vegetable' WHERE source_url IN (
  'https://www.themediterraneandish.com/falafel-bowl-recipe/',
  'https://www.themediterraneandish.com/tzatziki-sauce-recipe/',
  'https://www.themediterraneandish.com/how-to-make-falafel/',
  'https://www.themediterraneandish.com/layered-hummus-dip-recipe/',
  'https://recipe30.com/french-peas.html/',
  'https://recipe30.com/french-carrot-salad/',
  'https://www.loveandlemons.com/vegetarian-chili-recipe/',
  'https://www.loveandlemons.com/lentil-salad/',
  'https://www.loveandlemons.com/lentil-salad-recipe/'
);

-- Set 'other' as default for any remaining NULLs
UPDATE public.recipes SET dish_type = 'other' WHERE dish_type IS NULL;

-- 3. Now make the column NOT NULL with a default
ALTER TABLE public.recipes
  ALTER COLUMN dish_type SET DEFAULT 'other',
  ALTER COLUMN dish_type SET NOT NULL;

-- 4. Add index for filtering
CREATE INDEX IF NOT EXISTS idx_recipes_dish_type ON public.recipes (dish_type);
