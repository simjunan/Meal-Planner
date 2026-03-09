'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Recipe, MealSlot } from '@/types';
import RecipeCard from '@/components/recipes/RecipeCard';
import RecipeDetailPanel from '@/components/recipes/RecipeDetailPanel';
import SaveToPlanModal from '@/components/recipes/SaveToPlanModal';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { ToastContainer, showToast } from '@/components/ui/Toast';

interface BookmarkedRecipe {
  recipe_id: string;
  created_at: string;
  recipe: Recipe;
}

export default function BookmarksPage() {
  const [bookmarked, setBookmarked] = useState<BookmarkedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [savePlanRecipe, setSavePlanRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    fetch('/api/bookmarks/full').then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setBookmarked(data.bookmarks ?? []);
      }
      setLoading(false);
    });
  }, []);

  async function handleToggleBookmark(recipeId: string) {
    // Remove from list immediately (optimistic)
    setBookmarked((prev) => prev.filter((b) => b.recipe_id !== recipeId));
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId }),
    });
    if (!res.ok) {
      // Re-fetch if failed
      const r = await fetch('/api/bookmarks/full');
      if (r.ok) {
        const data = await r.json();
        setBookmarked(data.bookmarks ?? []);
      }
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

  const bookmarkIds = new Set(bookmarked.map((b) => b.recipe_id));

  const filtered = bookmarked.filter((b) =>
    b.recipe?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Bookmarks</h1>
        <span className="text-sm text-gray-400">{bookmarked.length} saved</span>
      </div>

      {/* Search */}
      {bookmarked.length > 0 && (
        <div className="relative mb-5">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter bookmarks…"
            className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm text-gray-900 placeholder-gray-400 transition"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : bookmarked.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-5">💔</div>
          <p className="text-xl font-bold text-gray-900 mb-2">No bookmarks yet</p>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
            Save your favourite recipes by tapping the heart icon while browsing.
          </p>
          <Link
            href="/recipes"
            className="inline-flex h-12 items-center px-6 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition"
          >
            Explore Recipes
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">No bookmarks match &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ recipe }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isBookmarked={bookmarkIds.has(recipe.id)}
              onToggleBookmark={handleToggleBookmark}
              onSelect={setSelectedRecipe}
            />
          ))}
        </div>
      )}

      <RecipeDetailPanel
        recipe={selectedRecipe}
        isBookmarked={selectedRecipe ? bookmarkIds.has(selectedRecipe.id) : false}
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
