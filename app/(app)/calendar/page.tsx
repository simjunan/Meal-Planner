'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { MealPlan, Recipe, MealSlot } from '@/types';
import { getWeekDates, formatDate, isSameDay, addDays, DAY_LABELS, MEAL_SLOT_LABELS, MEAL_SLOTS } from '@/lib/utils';
import SaveToPlanModal from '@/components/recipes/SaveToPlanModal';
import RecipeDetailPanel from '@/components/recipes/RecipeDetailPanel';
import { ToastContainer, showToast } from '@/components/ui/Toast';

export default function CalendarPage() {
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [activeDay, setActiveDay] = useState<Date>(new Date());
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [savePlanTarget, setSavePlanTarget] = useState<{ recipe?: Recipe; date?: string; slot?: MealSlot } | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [longPressMenu, setLongPressMenu] = useState<{ mealPlan: MealPlan; x: number; y: number } | null>(null);

  useEffect(() => {
    const dates = getWeekDates(referenceDate);
    setWeekDates(dates);
  }, [referenceDate]);

  const fetchMealPlans = useCallback(async () => {
    if (weekDates.length === 0) return;
    setLoading(true);
    const start = formatDate(weekDates[0]);
    const end = formatDate(weekDates[6]);
    const res = await fetch(`/api/meal-plans?start=${start}&end=${end}`);
    const data = await res.json();
    setMealPlans(data.meal_plans ?? []);
    setLoading(false);
  }, [weekDates]);

  useEffect(() => { fetchMealPlans(); }, [fetchMealPlans]);

  useEffect(() => {
    fetch('/api/bookmarks/list').then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setBookmarks(new Set(data.recipe_ids ?? []));
      }
    });
  }, []);

  function getMealPlan(date: Date, slot: MealSlot): MealPlan | undefined {
    return mealPlans.find(
      (mp) => mp.plan_date === formatDate(date) && mp.meal_slot === slot
    );
  }

  async function handleRemoveMeal(mealPlan: MealPlan) {
    // Optimistic remove
    setMealPlans((prev) => prev.filter((mp) => mp.id !== mealPlan.id));
    setLongPressMenu(null);

    const res = await fetch('/api/meal-plans', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mealPlan.id }),
    });

    showToast('Meal removed', {
      type: 'info',
      undoAction: async () => {
        await fetch('/api/meal-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipe_id: mealPlan.recipe_id,
            plan_date: mealPlan.plan_date,
            meal_slot: mealPlan.meal_slot,
          }),
        });
        fetchMealPlans();
      },
    });

    if (!res.ok) {
      showToast('Failed to remove meal.', { type: 'error' });
      setMealPlans((prev) => [...prev, mealPlan]);
    }
  }

  async function handleSaveToPlan(recipeId: string, date: string, slot: MealSlot) {
    const res = await fetch('/api/meal-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId, plan_date: date, meal_slot: slot }),
    });
    if (!res.ok) {
      showToast('Failed to save meal.', { type: 'error' });
    } else {
      const data = await res.json();
      setMealPlans((prev) => {
        const filtered = prev.filter(
          (mp) => !(mp.plan_date === date && mp.meal_slot === slot)
        );
        return [...filtered, data.meal_plan];
      });
      showToast('Meal saved!', { type: 'success' });
    }
  }

  async function handleToggleBookmark(recipeId: string) {
    const wasBookmarked = bookmarks.has(recipeId);
    setBookmarks((prev) => {
      const next = new Set(prev);
      wasBookmarked ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });
    await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId }),
    });
  }

  const today = new Date();

  // Long press handling
  let longPressTimer: NodeJS.Timeout;
  function handleTouchStart(mealPlan: MealPlan, e: React.TouchEvent) {
    longPressTimer = setTimeout(() => {
      const touch = e.touches[0];
      setLongPressMenu({ mealPlan, x: touch.clientX, y: touch.clientY });
    }, 500);
  }
  function handleTouchEnd() {
    clearTimeout(longPressTimer);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setReferenceDate((d) => addDays(d, -7))}
          className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900 text-sm">
            {weekDates.length > 0
              ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : ''}
          </span>
          <button
            onClick={() => { setReferenceDate(new Date()); setActiveDay(new Date()); }}
            className="text-xs font-medium text-brand-600 border border-brand-200 rounded-lg px-2.5 py-1 hover:bg-brand-50 transition"
          >
            Today
          </button>
        </div>

        <button
          onClick={() => setReferenceDate((d) => addDays(d, 7))}
          className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobile: date strip + single day */}
      <div className="md:hidden">
        {/* Date strip */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-2 mb-4">
          {weekDates.map((date, i) => {
            const isToday = isSameDay(date, today);
            const isActive = isSameDay(date, activeDay);
            return (
              <button
                key={i}
                onClick={() => setActiveDay(date)}
                className={`shrink-0 flex flex-col items-center w-11 h-14 rounded-2xl transition ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : isToday
                    ? 'bg-brand-50 text-brand-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-[10px] font-medium mt-1.5">{DAY_LABELS[i]}</span>
                <span className={`text-base font-bold leading-none mt-0.5 ${isActive ? 'text-white' : isToday ? 'text-brand-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </span>
                {/* Dot indicator if has meal */}
                <div className="flex gap-0.5 mt-1">
                  {MEAL_SLOTS.some((s) => getMealPlan(date, s)) && (
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : 'bg-brand-400'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active day meals */}
        <div className="space-y-3">
          {MEAL_SLOTS.map((slot) => {
            const plan = getMealPlan(activeDay, slot);
            return (
              <MealSlotCell
                key={slot}
                slot={slot}
                plan={plan}
                loading={loading}
                onAdd={() => setSavePlanTarget({ date: formatDate(activeDay), slot })}
                onView={(r) => setSelectedRecipe(r)}
                onLongPress={(p, e) => handleTouchStart(p, e)}
                onLongPressEnd={handleTouchEnd}
                onContextMenu={(p, e) => {
                  e.preventDefault();
                  setLongPressMenu({ mealPlan: p, x: e.clientX, y: e.clientY });
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Desktop: full 7-column grid */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="w-24 py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Meal</th>
              {weekDates.map((date, i) => {
                const isToday = isSameDay(date, today);
                return (
                  <th
                    key={i}
                    className={`py-2 px-3 text-center text-xs font-semibold tracking-wide ${isToday ? 'text-brand-600' : 'text-gray-500'}`}
                  >
                    <span className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl ${isToday ? 'bg-brand-500 text-white' : ''}`}>
                      <span className="uppercase">{DAY_LABELS[i]}</span>
                      <span className="text-sm font-bold">{date.getDate()}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {MEAL_SLOTS.map((slot) => (
              <tr key={slot} className="border-t border-gray-100">
                <td className="py-3 px-3 text-xs font-semibold text-gray-500 uppercase align-top">
                  {MEAL_SLOT_LABELS[slot]}
                </td>
                {weekDates.map((date, i) => {
                  const plan = getMealPlan(date, slot);
                  return (
                    <td key={i} className="py-2 px-2 align-top">
                      {plan ? (
                        <div
                          className="bg-white rounded-xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition group"
                          onClick={() => plan.recipe && setSelectedRecipe(plan.recipe)}
                          onContextMenu={(e) => { e.preventDefault(); setLongPressMenu({ mealPlan: plan, x: e.clientX, y: e.clientY }); }}
                        >
                          {plan.recipe?.thumbnail_url && (
                            <div className="relative h-16">
                              <Image src={plan.recipe.thumbnail_url} alt={plan.recipe.name} fill className="object-cover" sizes="100px" />
                            </div>
                          )}
                          <div className="p-1.5">
                            <p className="text-[11px] font-semibold text-gray-900 line-clamp-2 leading-tight">
                              {plan.recipe?.name}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSavePlanTarget({ date: formatDate(date), slot })}
                          className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition flex flex-col items-center justify-center gap-1"
                        >
                          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-[10px] text-gray-400">Add meal</span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context menu (right-click / long-press) */}
      {longPressMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setLongPressMenu(null)} />
          <div
            className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 min-w-[160px]"
            style={{
              top: Math.min(longPressMenu.y, window.innerHeight - 100),
              left: Math.min(longPressMenu.x, window.innerWidth - 180),
            }}
          >
            <button
              onClick={() => handleRemoveMeal(longPressMenu.mealPlan)}
              className="w-full px-4 py-3 text-sm text-red-600 font-medium text-left hover:bg-red-50 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove meal
            </button>
          </div>
        </>
      )}

      <RecipeDetailPanel
        recipe={selectedRecipe}
        isBookmarked={selectedRecipe ? bookmarks.has(selectedRecipe.id) : false}
        onClose={() => setSelectedRecipe(null)}
        onToggleBookmark={handleToggleBookmark}
        onSaveToPlan={(r) => { setSelectedRecipe(null); setSavePlanTarget({ recipe: r }); }}
      />

      <SaveToPlanModal
        recipe={savePlanTarget?.recipe ?? null}
        onClose={() => setSavePlanTarget(null)}
        onSave={handleSaveToPlan}
      />

      <ToastContainer />
    </div>
  );
}

interface MealSlotCellProps {
  slot: MealSlot;
  plan?: MealPlan;
  loading: boolean;
  onAdd: () => void;
  onView: (recipe: Recipe) => void;
  onLongPress: (plan: MealPlan, e: React.TouchEvent) => void;
  onLongPressEnd: () => void;
  onContextMenu: (plan: MealPlan, e: React.MouseEvent) => void;
}

function MealSlotCell({ slot, plan, loading, onAdd, onView, onLongPress, onLongPressEnd, onContextMenu }: MealSlotCellProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-3 animate-pulse">
        <div className="h-3 w-16 bg-gray-100 rounded mb-2" />
        <div className="h-14 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{MEAL_SLOT_LABELS[slot]}</span>
      </div>
      {plan ? (
        <div
          className="flex items-center gap-3 p-3 active:bg-gray-50 cursor-pointer"
          onClick={() => plan.recipe && onView(plan.recipe)}
          onTouchStart={(e) => onLongPress(plan, e)}
          onTouchEnd={onLongPressEnd}
          onContextMenu={(e) => onContextMenu(plan, e)}
        >
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
            {plan.recipe?.thumbnail_url ? (
              <Image src={plan.recipe.thumbnail_url} alt={plan.recipe.name ?? ''} fill className="object-cover" sizes="56px" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xl">🍽️</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{plan.recipe?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{plan.recipe?.cuisine}</p>
          </div>
          <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 active:bg-gray-100 transition"
        >
          <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-sm text-gray-400">Add meal</span>
        </button>
      )}
    </div>
  );
}
