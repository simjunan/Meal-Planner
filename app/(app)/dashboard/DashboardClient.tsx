'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MealPlan, Recipe, MealSlot } from '@/types';
import { MEAL_SLOT_LABELS, formatCookTime } from '@/lib/utils';
import SkeletonCard from '@/components/ui/SkeletonCard';
import SaveToPlanModal from '@/components/recipes/SaveToPlanModal';
import RecipeDetailPanel from '@/components/recipes/RecipeDetailPanel';
import { ToastContainer, showToast } from '@/components/ui/Toast';

interface Recommendation {
  recipe_id: string;
  day_offset: 1 | 2;
  meal_slot: MealSlot;
  recipe?: Recipe;
}

interface Props {
  username: string;
  upcomingMeals: MealPlan[];
  bookmarkedIds: string[];
  tomorrow: string;
  dayAfter: string;
}

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export default function DashboardClient({ username, upcomingMeals, bookmarkedIds, tomorrow, dayAfter }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recError, setRecError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [savePlanRecipe, setSavePlanRecipe] = useState<Recipe | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set(bookmarkedIds));
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchRecommendations = useCallback(async () => {
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await fetch('/api/recommendations', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');

      // Fetch recipe details
      const ids = (data.recommendations as Recommendation[]).map((r) => r.recipe_id);
      if (ids.length === 0) { setRecommendations([]); return; }

      const recipeRes = await fetch(`/api/recipes/bulk?ids=${ids.join(',')}`);
      const recipeData = await recipeRes.json();
      const recipeMap: Record<string, Recipe> = {};
      (recipeData.recipes ?? []).forEach((r: Recipe) => { recipeMap[r.id] = r; });

      setRecommendations(
        (data.recommendations as Recommendation[]).map((r) => ({
          ...r,
          recipe: recipeMap[r.recipe_id],
        }))
      );
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecommendations(); }, [fetchRecommendations]);

  async function handleToggleBookmark(recipeId: string) {
    const wasBookmarked = bookmarks.has(recipeId);
    setBookmarks((prev) => {
      const next = new Set(Array.from(prev));
      wasBookmarked ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId }),
    });
    if (!res.ok) {
      setBookmarks((prev) => {
        const next = new Set(Array.from(prev));
        wasBookmarked ? next.add(recipeId) : next.delete(recipeId);
        return next;
      });
    }
  }

  async function handleSaveToPlan(recipeId: string, date: string, slot: MealSlot) {
    const res = await fetch('/api/meal-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId, plan_date: date, meal_slot: slot }),
    });
    if (!res.ok) {
      showToast('Failed to save. Please try again.', { type: 'error' });
    } else {
      showToast('Added to meal plan!', { type: 'success' });
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const day1Recs = recommendations.filter((r) => r.day_offset === 1 && !dismissed.has(`${r.recipe_id}-${r.day_offset}-${r.meal_slot}`));
  const day2Recs = recommendations.filter((r) => r.day_offset === 2 && !dismissed.has(`${r.recipe_id}-${r.day_offset}-${r.meal_slot}`));

  function formatDisplayDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {username}! 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s on the menu.</p>
      </div>

      {/* AI Recommendations */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-1.5">
            <span>✨</span> AI Suggestions
          </h2>
          <button
            onClick={fetchRecommendations}
            disabled={recLoading}
            className="text-sm text-brand-600 font-medium disabled:opacity-50 flex items-center gap-1"
          >
            <svg className={`w-4 h-4 ${recLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {recError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-red-600 mb-1">Failed to load suggestions.</p>
            {recError !== 'Request failed' && (
              <p className="text-xs text-red-500 mb-3 font-mono break-all">{recError}</p>
            )}
            <button onClick={fetchRecommendations} className="text-sm font-medium text-red-700 underline">
              Try again
            </button>
          </div>
        )}

        {!recError && [
          { label: `Tomorrow · ${formatDisplayDate(tomorrow)}`, recs: day1Recs, dayOffset: 1 },
          { label: `Day After · ${formatDisplayDate(dayAfter)}`, recs: day2Recs, dayOffset: 2 },
        ].map(({ label, recs, dayOffset }) => (
          <div key={dayOffset} className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible">
              {recLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="min-w-[160px] md:min-w-0">
                      <SkeletonCard />
                    </div>
                  ))
                : SLOT_ORDER.map((slot) => {
                    const rec = recs.find((r) => r.meal_slot === slot);
                    if (!rec?.recipe) return (
                      <div key={slot} className="min-w-[160px] md:min-w-0 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4 gap-1 min-h-[120px]">
                        <span className="text-xs text-gray-400">{MEAL_SLOT_LABELS[slot]}</span>
                        <span className="text-xs text-gray-300">No suggestion</span>
                      </div>
                    );
                    const recipe = rec.recipe;
                    return (
                      <div key={slot} className="min-w-[160px] md:min-w-0 bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="relative h-24 bg-gray-100 cursor-pointer" onClick={() => setSelectedRecipe(recipe)}>
                          {recipe.thumbnail_url ? (
                            <Image src={recipe.thumbnail_url} alt={recipe.name} fill className="object-cover" sizes="160px" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-2xl">🍽️</div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDismissed((p) => new Set([...Array.from(p), `${rec.recipe_id}-${rec.day_offset}-${rec.meal_slot}`])); }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <div className="absolute bottom-1 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            {MEAL_SLOT_LABELS[slot]}
                          </div>
                        </div>
                        <div className="p-2.5 flex-1 flex flex-col">
                          <p className="text-xs font-semibold text-gray-900 line-clamp-2 flex-1">{recipe.name}</p>
                          {recipe.cook_time_mins && (
                            <p className="text-[10px] text-gray-400 mt-1">{formatCookTime(recipe.cook_time_mins)}</p>
                          )}
                          <button
                            onClick={() => { setSavePlanRecipe(recipe); }}
                            className="mt-2 w-full h-7 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition"
                          >
                            Add to Plan
                          </button>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        ))}
      </section>

      {/* Upcoming meals */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-lg">📅 Upcoming Meals</h2>
          <Link href="/calendar" className="text-sm text-brand-600 font-medium">
            View calendar
          </Link>
        </div>
        {upcomingMeals.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center">
            <p className="text-gray-400 text-sm">No meals planned yet.</p>
            <Link href="/recipes" className="mt-2 inline-block text-sm font-medium text-brand-600">
              Browse recipes →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingMeals.map((meal) => (
              <div key={meal.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {meal.recipe?.thumbnail_url ? (
                    <Image src={meal.recipe.thumbnail_url} alt={meal.recipe.name} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xl">🍽️</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">
                    {new Date(meal.plan_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}{MEAL_SLOT_LABELS[meal.meal_slot]}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{meal.recipe?.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="font-bold text-gray-900 text-lg mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/recipes', icon: '📖', label: 'Browse Recipes', desc: 'Find new dishes' },
            { href: '/calendar', icon: '📅', label: 'Meal Calendar', desc: 'Plan your week' },
            { href: '/bookmarks', icon: '❤️', label: 'Bookmarks', desc: 'Your saved recipes' },
          ].map(({ href, icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition flex items-start gap-3"
            >
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="font-semibold text-sm text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <RecipeDetailPanel
        recipe={selectedRecipe}
        isBookmarked={selectedRecipe ? bookmarks.has(selectedRecipe.id) : false}
        onClose={() => setSelectedRecipe(null)}
        onToggleBookmark={handleToggleBookmark}
        onSaveToPlan={(r) => { setSelectedRecipe(null); setSavePlanRecipe(r); }}
      />

      <SaveToPlanModal
        recipe={savePlanRecipe}
        onClose={() => setSavePlanRecipe(null)}
        onSave={handleSaveToPlan}
      />

      <ToastContainer />
    </div>
  );
}
