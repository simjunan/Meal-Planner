'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MealPlan, MealSlot } from '@/types';
import { getWeekDates, formatDate, isSameDay, addDays, DAY_LABELS, MEAL_SLOT_LABELS, MEAL_SLOTS } from '@/lib/utils';

export default function CalendarPage() {
  const router = useRouter();
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [activeDay, setActiveDay] = useState<Date>(new Date());
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWeekDates(getWeekDates(referenceDate));
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

  function getMealPlans(date: Date, slot: MealSlot): MealPlan[] {
    return mealPlans.filter(
      (mp) => mp.plan_date === formatDate(date) && mp.meal_slot === slot
    );
  }

  function navigateToSlot(date: Date, slot: MealSlot) {
    router.push(`/calendar/${formatDate(date)}/${slot}`);
  }

  const today = new Date();

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
            const hasAnyMeal = MEAL_SLOTS.some((s) => getMealPlans(date, s).length > 0);
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
                <div className="mt-1">
                  {hasAnyMeal && (
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : 'bg-brand-400'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active day meal slots */}
        <div className="space-y-3">
          {MEAL_SLOTS.map((slot) => (
            <MealSlotCell
              key={slot}
              slot={slot}
              plans={getMealPlans(activeDay, slot)}
              loading={loading}
              onNavigate={() => navigateToSlot(activeDay, slot)}
            />
          ))}
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
                  const plans = getMealPlans(date, slot);
                  return (
                    <td key={i} className="py-2 px-2 align-top">
                      <button
                        onClick={() => navigateToSlot(date, slot)}
                        className="w-full text-left focus:outline-none"
                      >
                        {plans.length > 0 ? (
                          <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition group">
                            {/* Thumbnail mosaic: 1 col for single, 2-col grid for multiple */}
                            <div className={`grid gap-px ${plans.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                              {plans.slice(0, 4).map((plan, idx) => (
                                <div key={plan.id} className="relative h-10 bg-gray-100">
                                  {plan.recipe?.thumbnail_url ? (
                                    <Image
                                      src={plan.recipe.thumbnail_url}
                                      alt={plan.recipe.name ?? ''}
                                      fill
                                      className="object-cover"
                                      sizes="60px"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-sm">🍽️</div>
                                  )}
                                  {idx === 3 && plans.length > 4 && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                      <span className="text-white text-[10px] font-bold">+{plans.length - 4}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="p-1.5">
                              <p className="text-[11px] font-semibold text-gray-900 line-clamp-1 leading-tight">
                                {plans[0]?.recipe?.name}
                              </p>
                              {plans.length > 1 && (
                                <p className="text-[10px] text-brand-500 font-medium">+{plans.length - 1} more</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition flex flex-col items-center justify-center gap-1">
                            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-[10px] text-gray-400">Add meal</span>
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface MealSlotCellProps {
  slot: MealSlot;
  plans: MealPlan[];
  loading: boolean;
  onNavigate: () => void;
}

function MealSlotCell({ slot, plans, loading, onNavigate }: MealSlotCellProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-3 animate-pulse">
        <div className="h-3 w-16 bg-gray-100 rounded mb-2" />
        <div className="h-14 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <button
      onClick={onNavigate}
      className="w-full bg-white rounded-2xl overflow-hidden shadow-sm text-left active:bg-gray-50 transition"
    >
      <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {MEAL_SLOT_LABELS[slot]}
        </span>
        {plans.length > 0 && (
          <span className="text-xs text-brand-500 font-medium">
            {plans.length} dish{plans.length > 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {plans.length > 0 ? (
        <div className="p-3 space-y-2">
          {plans.slice(0, 2).map((plan) => (
            <div key={plan.id} className="flex items-center gap-2.5">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                {plan.recipe?.thumbnail_url ? (
                  <Image
                    src={plan.recipe.thumbnail_url}
                    alt={plan.recipe.name ?? ''}
                    fill
                    className="object-cover"
                    sizes="40px"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm">🍽️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{plan.recipe?.name}</p>
                <p className="text-xs text-gray-400 truncate">{plan.recipe?.cuisine}</p>
              </div>
            </div>
          ))}
          {plans.length > 2 && (
            <p className="text-xs text-gray-400 pl-0.5">
              +{plans.length - 2} more dish{plans.length - 2 > 1 ? 'es' : ''}
            </p>
          )}
          <div className="flex justify-end">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-sm text-gray-400">Add meal</span>
        </div>
      )}
    </button>
  );
}
