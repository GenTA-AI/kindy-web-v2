'use client';

import type { ReactNode } from 'react';
import type { LibraryVideo } from '@/types/library';

type LibraryAge = LibraryVideo['age_band'];

interface Props {
  currentAge: LibraryAge | null;
  onAgeChange: (age: LibraryAge | null) => void;
}

const AGES: LibraryAge[] = [3, 4, 5, 6, 7, 8];

// 통합 미래역량 프로그램이라 과목(주제) 필터는 제거. 연령 필터만 유지.
export default function LibraryFilters({ currentAge, onAgeChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[.14em] text-sage">연령</p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={currentAge === null} onClick={() => onAgeChange(null)}>
            전체
          </FilterChip>
          {AGES.map((age) => (
            <FilterChip key={age} active={currentAge === age} onClick={() => onAgeChange(age)}>
              {age}세
            </FilterChip>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full px-3 py-2 text-xs font-semibold transition ${
        active ? 'bg-saged text-white' : 'bg-sagebg text-saged hover:bg-mist'
      }`}
    >
      {children}
    </button>
  );
}
