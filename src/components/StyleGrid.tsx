'use client';

import { STYLE_OPTIONS } from '@/types';

interface StyleGridProps {
  selected: string[];
  onToggle: (styleId: string) => void;
}

export default function StyleGrid({ selected, onToggle }: StyleGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {STYLE_OPTIONS.map((style) => {
        const isSelected = selected.includes(style.id);

        return (
          <button
            key={style.id}
            onClick={() => onToggle(style.id)}
            className={`
              rounded-2xl border-2 p-6 flex flex-col items-center justify-center
              transition-all duration-200
              ${isSelected
                ? 'border-violet-500 bg-violet-50 text-violet-700 scale-[1.02] shadow-md'
                : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50/50'
              }
            `}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
              isSelected ? 'bg-violet-100' : 'bg-gray-100'
            }`}>
              {style.id === 'princess' ? (
                <svg className={`w-8 h-8 ${isSelected ? 'text-violet-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              ) : (
                <svg className={`w-8 h-8 ${isSelected ? 'text-violet-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                </svg>
              )}
            </div>
            <span className="font-semibold text-base">{style.label}</span>
            <span className={`text-xs mt-1 ${isSelected ? 'text-violet-500' : 'text-gray-400'}`}>
              {style.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
