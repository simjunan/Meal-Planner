'use client';

import { useEffect, useState } from 'react';
import { Recipe, MealSlot } from '@/types';
import { formatDate, MEAL_SLOT_LABELS, MEAL_SLOTS, addDays } from '@/lib/utils';

interface SaveToPlanModalProps {
  recipe: Recipe | null;
  onClose: () => void;
  onSave: (recipeId: string, date: string, slot: MealSlot) => Promise<void>;
  existingPlan?: { date: string; slot: MealSlot; recipeName: string } | null;
  initialSlot?: MealSlot;
  initialDate?: string;
}

export default function SaveToPlanModal({ recipe, onClose, onSave, existingPlan, initialSlot, initialDate }: SaveToPlanModalProps) {
  const [show, setShow] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>('lunch');
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<{ recipeName: string } | null>(null);

  useEffect(() => {
    if (recipe) {
      const defaultDate = initialDate || formatDate(addDays(new Date(), 1));
      setSelectedDate(defaultDate);
      setSelectedSlot(initialSlot ?? 'lunch');
      requestAnimationFrame(() => setShow(true));
    } else {
      setShow(false);
      setConfirmReplace(null);
    }
  }, [recipe, initialSlot, initialDate]);

  if (!recipe) return null;

  function handleClose() {
    setShow(false);
    setTimeout(onClose, 300);
  }

  async function handleSave() {
    if (!recipe) return;
    if (existingPlan && existingPlan.date === selectedDate && existingPlan.slot === selectedSlot) {
      setConfirmReplace({ recipeName: existingPlan.recipeName });
      return;
    }
    await doSave();
  }

  async function doSave() {
    if (!recipe) return;
    setLoading(true);
    await onSave(recipe.id, selectedDate, selectedSlot);
    setLoading(false);
    handleClose();
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div
        className={`fixed z-50 bg-white rounded-t-3xl bottom-0 left-0 right-0
          md:bottom-auto md:right-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
          md:w-[400px] md:rounded-2xl transition-transform duration-300
          ${show ? 'translate-y-0' : 'translate-y-full md:translate-y-8'}`}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-bold text-lg text-gray-900">Save to Plan</h3>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{recipe.name}</p>
            </div>
            <button onClick={handleClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {confirmReplace ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                This slot already has <strong>{confirmReplace.recipeName}</strong>. Replace it?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmReplace(null)}
                  className="flex-1 h-11 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={doSave}
                  disabled={loading}
                  className="flex-1 h-11 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition disabled:opacity-50"
                >
                  Replace
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={formatDate(new Date())}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-500 outline-none transition text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Meal</label>
                <div className="grid grid-cols-3 gap-2">
                  {MEAL_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`h-11 rounded-xl text-sm font-medium transition border-2 ${
                        selectedSlot === slot
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {MEAL_SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={loading || !selectedDate}
                className="w-full h-12 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-xl transition"
              >
                {loading ? 'Saving…' : 'Save to Plan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
