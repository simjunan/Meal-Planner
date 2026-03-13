'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Recipe, MealSlot } from '@/types';
import { DIETARY_TAGS } from '@/lib/utils';
import RecipeCard from '@/components/recipes/RecipeCard';
import RecipeDetailPanel from '@/components/recipes/RecipeDetailPanel';
import SaveToPlanModal from '@/components/recipes/SaveToPlanModal';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { ToastContainer, showToast } from '@/components/ui/Toast';

const DISH_TYPE_CHIPS = [
  { val: '', label: 'All Types' },
  { val: 'soup', label: '🍲 Soup' },
  { val: 'meat', label: '🥩 Meat' },
  { val: 'vegetable', label: '🥦 Vegetable' },
];

export default function RecipesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedCuisine, setSelectedCuisine] = useState(searchParams.get('cuisine') ?? 'All');
  const [cookTime, setCookTime] = useState(searchParams.get('cookTime') ?? '');
  const [dietary, setDietary] = useState<string[]>(
    searchParams.get('dietary')?.split(',').filter(Boolean) ?? []
  );
  const [dishType, setDishType] = useState(searchParams.get('dishType') ?? '');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'popular');

  const [cuisines, setCuisines] = useState<string[]>(['All']);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [savePlanRecipe, setSavePlanRecipe] = useState<Recipe | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout>();

  // Load cuisines that have at least one recipe
  useEffect(() => {
    fetch('/api/recipes/cuisines').then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setCuisines(data.cuisines ?? ['All']);
      }
    });
  }, []);

  const fetchRecipes = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    const params = new URLSearchParams({
      q: search,
      cuisine: selectedCuisine === 'All' ? '' : selectedCuisine,
      cookTime,
      dietary: dietary.join(','),
      dishType,
      sort,
      page: reset ? '1' : String(page + 1),
    });

    const res = await fetch(`/api/recipes?${params}`);
    const data = await res.json();

    if (reset) {
      setRecipes(data.recipes ?? []);
      setPage(1);
    } else {
      setRecipes((prev) => [...prev, ...(data.recipes ?? [])]);
      setPage((p) => p + 1);
    }
    setTotal(data.total ?? 0);
    setLoading(false);
    setLoadingMore(false);
  }, [search, selectedCuisine, cookTime, dietary, dishType, sort, page]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRecipes(true);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedCuisine, cookTime, dietary, dishType, sort]);

  // Load bookmarks
  useEffect(() => {
    fetch('/api/bookmarks/list').then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setBookmarks(new Set(data.recipe_ids ?? []));
      }
    });
  }, []);

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

  function toggleDietary(tag: string) {
    setDietary((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const hasActiveFilters = cookTime || dietary.length || selectedCuisine !== 'All' || dishType;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Search bar */}
      <div className="sticky top-14 md:top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes, ingredients…"
              className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm text-gray-900 placeholder-gray-400 transition"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`h-11 px-4 rounded-xl border-2 text-sm font-medium transition flex items-center gap-1.5 ${
              showFilters || hasActiveFilters
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
          </button>
        </div>

        {/* Cuisine chips — only cuisines with actual recipes */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-2 pb-0.5">
          {cuisines.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCuisine(c)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium transition border ${
                selectedCuisine === c
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dish Type</p>
              <div className="flex gap-2 flex-wrap">
                {DISH_TYPE_CHIPS.map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setDishType(val)}
                    className={`h-8 px-3 rounded-full text-xs font-medium transition border ${
                      dishType === val
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cook Time</p>
              <div className="flex gap-2 flex-wrap">
                {[{ val: '', label: 'Any' }, { val: '<30', label: '< 30 min' }, { val: '30-60', label: '30–60 min' }, { val: '>60', label: '> 60 min' }].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setCookTime(val)}
                    className={`h-8 px-3 rounded-full text-xs font-medium transition border ${
                      cookTime === val
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dietary</p>
              <div className="flex gap-2 flex-wrap">
                {DIETARY_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleDietary(tag)}
                    className={`h-8 px-3 rounded-full text-xs font-medium transition border ${
                      dietary.includes(tag)
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sort By</p>
              <div className="flex gap-2 flex-wrap">
                {[{ val: 'popular', label: 'Most Popular' }, { val: 'rated', label: 'Highest Rated' }, { val: 'newest', label: 'Newest' }].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setSort(val)}
                    className={`h-8 px-3 rounded-full text-xs font-medium transition border ${
                      sort === val
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-4 py-4">
        {!loading && (
          <p className="text-xs text-gray-400 mb-3">
            {total === 0 ? 'No recipes found' : `${total.toLocaleString()} recipe${total !== 1 ? 's' : ''}`}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-gray-500 font-medium">No recipes found</p>
            <p className="text-sm text-gray-400 mt-1">Try different keywords or remove some filters.</p>
            <button
              onClick={() => { setSearch(''); setSelectedCuisine('All'); setCookTime(''); setDietary([]); setDishType(''); }}
              className="mt-4 text-sm font-medium text-brand-600 underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isBookmarked={bookmarks.has(recipe.id)}
                  onToggleBookmark={handleToggleBookmark}
                  onSelect={setSelectedRecipe}
                />
              ))}
            </div>

            {recipes.length < total && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchRecipes(false)}
                  disabled={loadingMore}
                  className="h-12 px-8 bg-white border-2 border-gray-200 hover:border-brand-500 text-gray-700 font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : `Load More (${total - recipes.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

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
