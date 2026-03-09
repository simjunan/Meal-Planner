'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Recipe } from '@/types';
import StarRating from '@/components/ui/StarRating';
import { formatCookTime } from '@/lib/utils';

interface RecipeDetailPanelProps {
  recipe: Recipe | null;
  isBookmarked: boolean;
  onClose: () => void;
  onToggleBookmark: (recipeId: string) => void;
  onSaveToPlan: (recipe: Recipe) => void;
}

export default function RecipeDetailPanel({
  recipe,
  isBookmarked,
  onClose,
  onToggleBookmark,
  onSaveToPlan,
}: RecipeDetailPanelProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (recipe) {
      requestAnimationFrame(() => setShow(true));
    } else {
      setShow(false);
    }
  }, [recipe]);

  if (!recipe) return null;

  function handleClose() {
    setShow(false);
    setTimeout(onClose, 300);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Panel — bottom sheet on mobile, side panel on desktop */}
      <div
        className={`fixed z-50 bg-white overflow-y-auto transition-transform duration-300
          bottom-0 left-0 right-0 max-h-[90vh] rounded-t-3xl
          md:top-0 md:right-0 md:left-auto md:bottom-0 md:w-[420px] md:max-h-none md:rounded-none
          ${show
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full'
          }`}
      >
        {/* Pull handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition z-10"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image */}
        <div className="relative h-56 bg-gray-100">
          {recipe.thumbnail_url ? (
            <Image
              src={recipe.thumbnail_url}
              alt={recipe.name}
              fill
              className="object-cover"
              sizes="420px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl">🍽️</span>
            </div>
          )}

          {/* Bookmark */}
          <button
            onClick={() => onToggleBookmark(recipe.id)}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow"
          >
            <svg
              className={`w-5 h-5 transition ${isBookmarked ? 'text-red-500 fill-current' : 'text-gray-500'}`}
              fill={isBookmarked ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{recipe.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {recipe.cuisine && (
                <span className="text-xs bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full font-medium">
                  {recipe.cuisine}
                </span>
              )}
              {recipe.dietary_tags?.map((tag) => (
                <span key={tag} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <StarRating rating={recipe.avg_rating} count={recipe.rating_count} />

          <div className="flex gap-4 text-sm text-gray-600">
            {recipe.cook_time_mins && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatCookTime(recipe.cook_time_mins)}
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Serves {recipe.servings}
              </div>
            )}
          </div>

          {/* Ingredients */}
          {recipe.ingredients_summary && recipe.ingredients_summary.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Ingredients</h3>
              <ul className="space-y-1">
                {recipe.ingredients_summary.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-3 pt-2">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 border-2 border-brand-500 text-brand-500 hover:bg-brand-50 font-semibold rounded-xl flex items-center justify-center gap-2 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Full Recipe
            </a>
            <button
              onClick={() => onSaveToPlan(recipe)}
              className="w-full h-12 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Save to Plan
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
