'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Recipe } from '@/types';
import StarRating from '@/components/ui/StarRating';
import { formatCookTime } from '@/lib/utils';

const CUISINE_EMOJI: Record<string, string> = {
  Cantonese: '🍜', Chinese: '🥟', Sichuan: '🌶️', Shanghainese: '🥢',
  Taiwanese: '🍱', Japanese: '🍣', Korean: '🍲', Thai: '🍛',
  Vietnamese: '🍜', Western: '🥗', Mediterranean: '🫒', French: '🥐',
  'Malaysian Chinese': '🍜',
};

function cuisineEmoji(cuisine: string | null | undefined): string {
  return (cuisine && CUISINE_EMOJI[cuisine]) ?? '🍽️';
}

interface RecipeCardProps {
  recipe: Recipe;
  isBookmarked: boolean;
  onToggleBookmark: (recipeId: string) => void;
  onSelect: (recipe: Recipe) => void;
}

export default function RecipeCard({
  recipe,
  isBookmarked,
  onToggleBookmark,
  onSelect,
}: RecipeCardProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!recipe.thumbnail_url && !imgError;

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer group"
      onClick={() => onSelect(recipe)}
    >
      {/* Thumbnail */}
      <div className="relative h-40 bg-gray-100">
        {showImage ? (
          <Image
            src={recipe.thumbnail_url!}
            alt={recipe.name}
            fill
            className="object-cover group-hover:scale-105 transition duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <span className="text-4xl mb-1 opacity-70">{cuisineEmoji(recipe.cuisine)}</span>
            <span className="text-xs text-brand-400 font-medium">{recipe.cuisine ?? 'Recipe'}</span>
          </div>
        )}

        {/* Bookmark button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(recipe.id);
          }}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition"
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark recipe'}
        >
          <svg
            className={`w-5 h-5 transition ${isBookmarked ? 'text-red-500 fill-current' : 'text-gray-400'}`}
            fill={isBookmarked ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>

        {/* Cook time badge */}
        {recipe.cook_time_mins && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {formatCookTime(recipe.cook_time_mins)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
          {recipe.name}
        </h3>
        {recipe.cuisine && (
          <span className="inline-block text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
            {recipe.cuisine}
          </span>
        )}
        <StarRating rating={recipe.avg_rating} count={recipe.rating_count} />
      </div>
    </div>
  );
}
