'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MealPlan, Recipe, MealSlot } from '@/types';
import { MEAL_SLOT_LABELS, formatCookTime } from '@/lib/utils';
import { ToastContainer, showToast } from '@/components/ui/Toast';

const VALID_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
const MAX_DISHES = 4;

interface Props {
  params: { date: string; slot: string };
}

export default function MealSlotPage({ params }: Props) {
  const { date, slot } = params;
  const mealSlot = VALID_SLOTS.includes(slot as MealSlot) ? (slot as MealSlot) : null;

  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/meal-plans?start=${date}&end=${date}`);
    const data = await res.json();
    setPlans(
      (data.meal_plans ?? []).filter((p: MealPlan) => p.meal_slot === slot)
    );
    setLoading(false);
  }, [date, slot]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // Debounced recipe search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/recipes?q=${encodeURIComponent(search.trim())}`);
        const data = await res.json();
        setSearchResults(data.recipes ?? []);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleAdd(recipe: Recipe) {
    if (!mealSlot) return;
    if (plans.length >= MAX_DISHES) {
      showToast(`Maximum of ${MAX_DISHES} dishes per meal reached.`, { type: 'error' });
      return;
    }
    setAddingId(recipe.id);
    const res = await fetch('/api/meal-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipe.id, plan_date: date, meal_slot: mealSlot }),
    });
    setAddingId(null);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      showToast(errData.error ?? 'Failed to add dish', { type: 'error' });
    } else {
      showToast('Dish added!', { type: 'success' });
      setSearch('');
      setSearchResults([]);
      setShowSearch(false);
      fetchPlans();
    }
  }

  async function handleRemove(plan: MealPlan) {
    setRemovingId(plan.id);
    // Optimistic remove
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    const res = await fetch('/api/meal-plans', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: plan.id }),
    });
    setRemovingId(null);
    if (!res.ok) {
      showToast('Failed to remove dish', { type: 'error' });
      setPlans((prev) => [...prev, plan]);
    } else {
      showToast('Dish removed', {
        type: 'info',
        undoAction: async () => {
          await fetch('/api/meal-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipe_id: plan.recipe_id,
              plan_date: plan.plan_date,
              meal_slot: plan.meal_slot,
            }),
          });
          fetchPlans();
        },
      });
    }
  }

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (!mealSlot) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Invalid meal slot.</p>
        <Link href="/calendar" className="mt-3 inline-block text-brand-600 font-medium text-sm">
          ← Back to calendar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/calendar"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition shrink-0"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-gray-900">{MEAL_SLOT_LABELS[mealSlot]}</h1>
          <p className="text-sm text-gray-500 truncate">{displayDate}</p>
        </div>
        <button
          onClick={() => setShowSearch((v) => !v)}
          disabled={plans.length >= MAX_DISHES}
          className="h-9 px-4 bg-brand-500 text-white text-sm font-semibold rounded-xl hover:bg-brand-600 transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add dish
        </button>
      </div>

      {/* Max dishes banner */}
      {!loading && plans.length >= MAX_DISHES && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-amber-700">
            Maximum of {MAX_DISHES} dishes per meal reached. Remove a dish to add a new one.
          </p>
        </div>
      )}

      {/* Inline recipe search panel */}
      {showSearch && plans.length < MAX_DISHES && (
        <div className="mb-4 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-3 border-b border-gray-100">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes…"
              className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-500 outline-none text-sm transition"
              autoFocus
            />
          </div>

          {searching && (
            <p className="p-4 text-sm text-gray-400 text-center">Searching…</p>
          )}

          {!searching && search.trim() && searchResults.length === 0 && (
            <p className="p-4 text-sm text-gray-400 text-center">No recipes found</p>
          )}

          {!searching && !search.trim() && (
            <p className="p-4 text-sm text-gray-400 text-center">Type to search for recipes</p>
          )}

          {searchResults.slice(0, 8).map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => handleAdd(recipe)}
              disabled={addingId === recipe.id}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition border-t border-gray-50 text-left disabled:opacity-60"
            >
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                {recipe.thumbnail_url ? (
                  <Image
                    src={recipe.thumbnail_url}
                    alt={recipe.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xl">🍽️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{recipe.name}</p>
                <p className="text-xs text-gray-400">
                  {[
                    recipe.cuisine,
                    recipe.cook_time_mins ? formatCookTime(recipe.cook_time_mins) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="text-sm text-brand-500 font-semibold shrink-0">
                {addingId === recipe.id ? '…' : '+ Add'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Planned dishes */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-semibold text-gray-700">Nothing planned yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Tap <span className="text-brand-500 font-medium">+ Add dish</span> to build your meal
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-2xl flex items-center gap-3 p-3 shadow-sm"
            >
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                {plan.recipe?.thumbnail_url ? (
                  <Image
                    src={plan.recipe.thumbnail_url}
                    alt={plan.recipe.name ?? ''}
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🍽️</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{plan.recipe?.name}</p>
                {plan.recipe?.cuisine && (
                  <p className="text-xs text-gray-500 mt-0.5">{plan.recipe.cuisine}</p>
                )}
                {plan.recipe?.cook_time_mins != null && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatCookTime(plan.recipe.cook_time_mins)}
                  </p>
                )}
                {plan.recipe?.dish_type && plan.recipe.dish_type !== 'other' && (
                  <span className="inline-block mt-1 text-[10px] font-medium text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full capitalize">
                    {plan.recipe.dish_type}
                  </span>
                )}
              </div>

              <button
                onClick={() => handleRemove(plan)}
                disabled={removingId === plan.id}
                className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition shrink-0 disabled:opacity-40"
                aria-label="Remove dish"
              >
                {removingId === plan.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
