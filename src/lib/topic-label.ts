export function topicLabel(topic?: string | null): string {
  const value = topic?.trim();
  if (!value) return '생각 놀이';

  const normalized = value.toLocaleLowerCase('ko-KR');
  if (normalized === 'animal-village' || normalized.includes('animal')) return '동물 마을';
  if (normalized === 'future_skills') return '생각 놀이';
  if (normalized.includes('science')) return '과학';
  if (normalized.includes('english')) return '영어';
  if (normalized.includes('hangul') || normalized.includes('korean')) return '한글';
  if (normalized.includes('emotion') || normalized.includes('feeling')) return '마음 표현';
  if (normalized.includes('creativity') || normalized.includes('creative')) return '만들기 놀이';

  return value;
}
