'use client';

import { useMemo, useState, useEffect } from 'react';
import EmojiReaction from './EmojiReaction';
import Quiz from './Quiz';
import type { Child } from '@/types';
import { CURRICULUM_MAP } from '@/types';
import { withJosa } from '@/lib/josa';

type Phase =
  | 'gate'
  | 'emoji'
  | 'current_quiz'
  | 'attention_loading'
  | 'attention_quiz'
  | 'review'
  | 'preview_quiz'
  | 'upsell'
  | 'done';

interface QuizResult {
  question: string;
  options: string[];
  correctAnswer: number;
  selectedAnswer: number;
  isCorrect: boolean;
}

interface AttentionQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  focus: 'appearance' | 'action' | 'detail' | 'count';
}

interface PostVideoFlowProps {
  child: Child;
  videoId: string;                // attention quiz Claude 호출용
  episodeIndex: number;
  onReact: (reaction: 'happy' | 'neutral' | 'sad') => void;
  onQuizComplete: (scope: 'current' | 'attention' | 'preview', results: QuizResult[]) => void;
  onUpsellAccept: () => void;
  onUpsellDismiss: () => void;
  onRewatch?: () => void;         // 한 번 더 보기 — 부모가 누르면 영상 처음부터 재생
}

const FOCUS_LABEL: Record<AttentionQuestion['focus'], string> = {
  appearance: '외형',
  action: '행동',
  detail: '디테일',
  count: '개수',
};

export default function PostVideoFlow({
  child,
  videoId,
  episodeIndex,
  onReact,
  onQuizComplete,
  onUpsellAccept,
  onUpsellDismiss,
  onRewatch,
}: PostVideoFlowProps) {
  const [phase, setPhase] = useState<Phase>('gate');
  const [currentResults, setCurrentResults] = useState<QuizResult[]>([]);
  const [attentionResults, setAttentionResults] = useState<QuizResult[]>([]);
  const [previewResults, setPreviewResults] = useState<QuizResult[]>([]);
  const [attentionQuestions, setAttentionQuestions] = useState<AttentionQuestion[]>([]);
  const [attentionError, setAttentionError] = useState<string | null>(null);

  const topic = child.topics[0];
  const ageBand = CURRICULUM_MAP[topic]?.[child.age];
  const currentEpisode = ageBand?.episodes?.[episodeIndex];
  const nextEpisode = ageBand?.episodes?.[episodeIndex + 1];

  const currentQuiz = currentEpisode?.quiz ?? [];
  const previewQuiz = nextEpisode?.quiz ?? [];

  const currentCorrect = useMemo(
    () => currentResults.filter((r) => r.isCorrect).length,
    [currentResults]
  );
  const attentionCorrect = useMemo(
    () => attentionResults.filter((r) => r.isCorrect).length,
    [attentionResults]
  );

  // attention_loading 진입 시 Claude 호출
  useEffect(() => {
    if (phase !== 'attention_loading') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/attention-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId, child_age: child.age }),
        });
        if (!res.ok) {
          const err = await res.json();
          if (!cancelled) {
            setAttentionError(err.error ?? '생성 실패');
            // 실패해도 다음 단계로 넘어감
            setPhase('review');
          }
          return;
        }
        const data = await res.json() as { questions: AttentionQuestion[] };
        if (cancelled) return;
        if (!data.questions || data.questions.length === 0) {
          setPhase('review');
          return;
        }
        setAttentionQuestions(data.questions);
        setPhase('attention_quiz');
      } catch (e) {
        if (!cancelled) {
          setAttentionError(e instanceof Error ? e.message : '생성 실패');
          setPhase('review');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [phase, videoId, child.age]);

  const handleReact = (reaction: 'happy' | 'neutral' | 'sad') => {
    onReact(reaction);
    setTimeout(() => setPhase('current_quiz'), 800);
  };

  const handleCurrentDone = (results: QuizResult[]) => {
    setCurrentResults(results);
    onQuizComplete('current', results);
    setPhase('attention_loading');
  };

  const handleAttentionDone = (results: QuizResult[]) => {
    setAttentionResults(results);
    onQuizComplete('attention', results);
    setPhase('review');
  };

  const handlePreviewDone = (results: QuizResult[]) => {
    setPreviewResults(results);
    onQuizComplete('preview', results);
    const wrong = results.some((r) => !r.isCorrect);
    setPhase(wrong && nextEpisode ? 'upsell' : 'done');
  };

  if (phase === 'gate') {
    return (
      <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-300/40">
        <div className="text-3xl mb-2">🎬</div>
        <h3 className="text-xl font-extrabold leading-tight">영상 다 봤어요!</h3>
        <p className="text-sm text-violet-100 mt-1">
          {child.name}, 같이 퀴즈 풀러 갈까?
        </p>
        <button
          onClick={() => setPhase('emoji')}
          className="w-full mt-4 py-3.5 bg-white text-violet-600 font-extrabold rounded-xl active:scale-[0.98] transition"
        >
          퀴즈 풀러 갈래
        </button>
        {onRewatch && (
          <button
            onClick={onRewatch}
            className="w-full mt-2 py-2 text-violet-100 text-[13px] font-medium hover:text-white"
          >
            한 번 더 볼래
          </button>
        )}
      </div>
    );
  }

  if (phase === 'emoji') {
    return (
      <div className="bg-violet-50 rounded-2xl p-4">
        <EmojiReaction childName={child.name} onReact={handleReact} />
      </div>
    );
  }

  if (phase === 'current_quiz' && currentQuiz.length > 0) {
    return (
      <div className="bg-amber-50 rounded-2xl p-4">
        <div className="text-[10px] font-bold text-amber-600 tracking-wider uppercase mb-2">이번 주 퀴즈</div>
        <Quiz questions={currentQuiz} childName={child.name} onComplete={handleCurrentDone} />
      </div>
    );
  }

  if (phase === 'attention_loading') {
    return (
      <div className="bg-violet-50 rounded-2xl p-5">
        <div className="text-[10px] font-bold text-violet-500 tracking-wider uppercase mb-2">집중도 퀴즈 준비 중</div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin" />
          <p className="text-sm text-gray-600">영상을 얼마나 잘 봤는지 재미있는 질문을 만들고 있어요</p>
        </div>
      </div>
    );
  }

  if (phase === 'attention_quiz' && attentionQuestions.length > 0) {
    // Claude 퀴즈 → Quiz 컴포넌트가 먹을 수 있는 shape 으로 변환 (이미 동일)
    return (
      <div className="bg-violet-50 rounded-2xl p-4">
        <div className="text-[10px] font-bold text-violet-500 tracking-wider uppercase mb-1">집중도 퀴즈</div>
        <p className="text-xs text-gray-500 mb-3">얼마나 자세히 봤는지 체크</p>
        <Quiz
          questions={attentionQuestions.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
          }))}
          childName={child.name}
          onComplete={handleAttentionDone}
        />
      </div>
    );
  }

  if (phase === 'review') {
    // Focus 별 정답/오답 집계 → 강점/약점 카테고리 도출
    const focusStats: Record<AttentionQuestion['focus'], { correct: number; total: number }> = {
      appearance: { correct: 0, total: 0 },
      action: { correct: 0, total: 0 },
      detail: { correct: 0, total: 0 },
      count: { correct: 0, total: 0 },
    };
    attentionResults.forEach((r, i) => {
      const focus = attentionQuestions[i]?.focus ?? 'detail';
      focusStats[focus].total += 1;
      if (r.isCorrect) focusStats[focus].correct += 1;
    });

    const comprehensionVerdict = (() => {
      if (currentResults.length === 0) return { headline: '', hint: '' };
      if (currentCorrect === currentResults.length) {
        return { headline: '오늘 배운 내용을 정확히 이해했어요', hint: '이 주제는 충분해요' };
      }
      if (currentCorrect > 0) {
        return { headline: '절반쯤 이해했어요', hint: '한 번 더 보면 확실해질 거예요' };
      }
      return { headline: '내용이 조금 어려웠어요', hint: `부모님과 함께 "${currentEpisode?.concept ?? ''}"를 다시 이야기해보세요` };
    })();

    const attentionVerdict = (() => {
      if (attentionResults.length === 0) return null;
      const ratio = attentionCorrect / attentionResults.length;
      if (ratio === 1) return { headline: '영상 구석구석 잘 봤어요', hint: '집중력이 좋았어요' };
      if (ratio >= 0.66) return { headline: '대부분 집중해서 봤어요', hint: '놓친 작은 부분도 있어요' };
      if (ratio >= 0.33) return { headline: '몇 장면에서 다른 생각을 한 것 같아요', hint: '부모님과 함께 다시 보면 좋아요' };
      return { headline: '영상에 잘 몰입하지 못한 것 같아요', hint: '다시 보면서 함께 이야기해보세요' };
    })();

    // 강/약 카테고리
    const strongCategories: string[] = [];
    const weakCategories: string[] = [];
    (Object.keys(focusStats) as Array<AttentionQuestion['focus']>).forEach((k) => {
      const s = focusStats[k];
      if (s.total === 0) return;
      const r = s.correct / s.total;
      if (r === 1) strongCategories.push(FOCUS_LABEL[k]);
      else if (r === 0) weakCategories.push(FOCUS_LABEL[k]);
    });

    const hasAttention = attentionResults.length > 0;

    return (
      <div className="space-y-3">
        {/* 오늘의 학습 요약 */}
        <div className="bg-white rounded-2xl p-5 border border-violet-100">
          <div className="text-[10px] font-bold text-violet-500 tracking-wider uppercase mb-2">오늘 배운 것</div>
          <p className="text-base font-bold text-gray-900 leading-snug">{currentEpisode?.title}</p>
          <p className="text-sm text-gray-600 mt-1">{currentEpisode?.concept}</p>
        </div>

        {/* 이해도 판정 */}
        {currentResults.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-violet-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">
                {currentCorrect === currentResults.length ? '🎉' : currentCorrect > 0 ? '👍' : '💭'}
              </span>
              <span className="text-[10px] font-bold text-violet-500 tracking-wider uppercase">이해 정도</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{comprehensionVerdict.headline}</p>
            <p className="text-xs text-gray-500 mt-0.5">{comprehensionVerdict.hint}</p>
          </div>
        )}

        {/* 집중도 판정 */}
        {hasAttention && attentionVerdict && (
          <div className="bg-white rounded-2xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">
                {attentionCorrect === attentionResults.length ? '⭐' : attentionCorrect > 0 ? '👀' : '🌱'}
              </span>
              <span className="text-[10px] font-bold text-amber-600 tracking-wider uppercase">영상 관찰</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{attentionVerdict.headline}</p>
            <p className="text-xs text-gray-500 mt-0.5">{attentionVerdict.hint}</p>

            {(strongCategories.length > 0 || weakCategories.length > 0) && (
              <div className="mt-3 space-y-1">
                {strongCategories.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-500 font-bold">잘 봤어요</span>
                    <span className="text-gray-600">{strongCategories.join(', ')}</span>
                  </div>
                )}
                {weakCategories.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 font-bold">다시 보면 좋아요</span>
                    <span className="text-gray-600">{weakCategories.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* 틀린 문제만 공개 — 부모가 짚어주기 좋게 */}
            {attentionResults.some((r) => !r.isCorrect) && (
              <details className="mt-3">
                <summary className="text-[11px] text-violet-500 font-semibold cursor-pointer">놓친 질문 보기</summary>
                <div className="mt-2 space-y-1.5">
                  {attentionResults.map((r, i) => {
                    if (r.isCorrect) return null;
                    const q = attentionQuestions[i];
                    return (
                      <div key={i} className="text-xs bg-gray-50 rounded-xl p-2">
                        <div className="text-gray-700 font-medium">{r.question}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          정답: <span className="text-gray-800 font-semibold">{r.options[r.correctAnswer]}</span>
                          {q?.focus && <span className="ml-2 text-gray-400">· {FOCUS_LABEL[q.focus]}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}

        {attentionError && !hasAttention && (
          <p className="text-[11px] text-gray-400 text-center">
            집중도 퀴즈를 만드는 데 잠깐 문제가 있었어요
          </p>
        )}

        {/* 면책 — ADHD memory 규칙 반영 */}
        {hasAttention && (
          <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed">
            이 리포트는 가정 내 시청 관찰 참고용이에요. 지속적인 주의력 어려움이 의심되면 소아정신과 전문의 상담을 권해요.
          </p>
        )}

        <button
          onClick={() => setPhase(previewQuiz.length > 0 ? 'preview_quiz' : 'done')}
          className="w-full py-3.5 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-xl shadow-md shadow-violet-200/60 active:scale-[0.98] transition"
        >
          {previewQuiz.length > 0 ? '다음 주제 살펴보기' : '끝내기'}
        </button>
      </div>
    );
  }

  if (phase === 'preview_quiz' && previewQuiz.length > 0) {
    return (
      <div className="bg-amber-50 rounded-2xl p-4">
        <div className="text-[10px] font-bold text-amber-600 tracking-wider uppercase mb-1">다음 주제 미리보기</div>
        <p className="text-sm font-semibold text-gray-700 mb-3">{nextEpisode?.title}</p>
        <Quiz questions={previewQuiz} childName={child.name} onComplete={handlePreviewDone} />
      </div>
    );
  }

  if (phase === 'upsell' && nextEpisode) {
    const wrongCount = previewResults.filter((r) => !r.isCorrect).length;
    return (
      <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-300/40">
        <div className="text-[11px] font-bold text-violet-100 tracking-wider uppercase mb-2">
          {withJosa(child.name, '이/가')} 아직 헷갈리는 부분
        </div>
        <h3 className="text-xl font-extrabold leading-tight">{nextEpisode.title}</h3>
        <p className="text-sm text-violet-100 mt-2">
          {wrongCount === previewResults.length ? '전부 처음 보는 주제예요. ' : `${wrongCount}문제 놓쳤어요. `}
          이 주제를 영상으로 배우면 훨씬 쉬워져요.
        </p>

        <div className="mt-4 bg-white/15 backdrop-blur rounded-xl p-3">
          <div className="text-[11px] font-bold text-violet-100 tracking-wider uppercase mb-1">다음 영상</div>
          <p className="text-sm font-bold">{nextEpisode.concept}</p>
        </div>

        <button
          onClick={onUpsellAccept}
          className="w-full mt-4 py-3.5 bg-white text-violet-600 font-extrabold rounded-xl active:scale-[0.98] transition"
        >
          영상으로 배울래? (크레딧 1개)
        </button>
        <button
          onClick={() => {
            onUpsellDismiss();
            setPhase('done');
          }}
          className="w-full mt-2 py-2 text-violet-100 text-[13px] font-medium hover:text-white"
        >
          다음에 할래요
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="bg-white rounded-2xl p-5 text-center border border-violet-100">
        <div className="text-3xl mb-2">🌟</div>
        <p className="text-sm font-semibold text-gray-700">
          {child.name}, 오늘도 잘 배웠어요!
        </p>
      </div>
    );
  }

  return null;
}
