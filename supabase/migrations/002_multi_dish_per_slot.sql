-- Allow multiple dishes per meal slot
-- Drop the unique constraint that previously limited each slot to one recipe
ALTER TABLE public.meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_user_id_plan_date_meal_slot_key;

-- Add a regular index for query performance (replaces the implicit unique index)
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date_slot
  ON public.meal_plans (user_id, plan_date, meal_slot);
