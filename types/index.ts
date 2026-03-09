export interface Recipe {
  id: string;
  name: string;
  source_url: string;
  thumbnail_url: string | null;
  cuisine: string | null;
  avg_rating: number | null;
  rating_count: number | null;
  cook_time_mins: number | null;
  servings: number | null;
  ingredients_summary: string[] | null;
  dietary_tags: string[] | null;
  meal_type: string[] | null;
  crawled_at: string | null;
}

export interface MealPlan {
  id: string;
  user_id: string;
  recipe_id: string;
  plan_date: string;
  meal_slot: 'breakfast' | 'lunch' | 'dinner';
  created_at: string;
  recipe?: Recipe;
}

export interface Bookmark {
  user_id: string;
  recipe_id: string;
  created_at: string;
  recipe?: Recipe;
}

export interface Profile {
  id: string;
  username: string;
  created_at: string;
}

export interface Recommendation {
  recipe_id: string;
  day_offset: 1 | 2;
  meal_slot: 'breakfast' | 'lunch' | 'dinner';
  recipe?: Recipe;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface FilterState {
  cuisines: string[];
  cookTime: string | null;
  dietaryTags: string[];
}
