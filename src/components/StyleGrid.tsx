'use client';

import { STYLE_OPTIONS } from '@/types';

interface StyleGridProps {
  selected: string[];
  onToggle: (styleId: string) => void;
}

export default function StyleGrid({ selected, onToggle }: StyleGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {STYLE_OPTIONS.map((style) => {
        const isSelected = selected.includes(style.id);
        const icon = style.id === 'water_lab'
          ? '물'
          : style.id === 'pattern_hill'
            ? '무늬'
            : style.id === 'star_workshop'
              ? '별'
              : '숲';

        return (
          <button
            key={style.id}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${style.label}, ${style.description}`}
            onClick={() => onToggle(style.id)}
            className={`
              min-h-[148px] rounded-2xl border-2 p-4 flex flex-col items-center justify-center
              transition-all duration-200
              ${isSelected
                ? 'border-sage bg-sagebg text-saged scale-[1.02] shadow-md shadow-sagebg'
                : 'border-line bg-white text-ink2 hover:border-sages hover:bg-mist'
              }
            `}
          >
            <div aria-hidden="true" className={`h-14 w-14 rounded-full flex items-center justify-center mb-3 text-sm font-extrabold ${
              isSelected ? 'bg-white text-saged' : 'bg-mist text-sage'
            }`}>
              {icon}
            </div>
            <span className="text-center text-base font-extrabold">{style.label}</span>
            <span className={`mt-1 text-center text-xs leading-relaxed ${isSelected ? 'text-saged' : 'text-ink3'}`}>
              {style.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
