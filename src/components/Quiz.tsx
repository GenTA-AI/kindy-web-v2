'use client';

import { useState } from 'react';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface QuizProps {
  questions: QuizQuestion[];
  childName: string;
  onComplete: (results: Array<{ question: string; options: string[]; correctAnswer: number; selectedAnswer: number; isCorrect: boolean }>) => void;
}

export default function Quiz({ questions, childName, onComplete }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Array<{ question: string; options: string[]; correctAnswer: number; selectedAnswer: number; isCorrect: boolean }>>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);

  const current = questions[currentIndex];
  if (!current) return null;

  const isFinished = results.length === questions.length;

  if (isFinished) {
    const correct = results.filter(r => r.isCorrect).length;
    return (
      <div className="text-center py-6">
        <div className="text-5xl mb-3">
          {correct === questions.length ? '🎉' : correct > 0 ? '👍' : '💪'}
        </div>
        <p className="text-lg font-semibold text-gray-800">
          {correct}/{questions.length} 맞았어요!
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {correct === questions.length
            ? `${childName} 정말 잘했어!`
            : `다음에 더 잘할 수 있어, ${childName}!`}
        </p>
      </div>
    );
  }

  const handleAnswer = (answerIndex: number) => {
    if (showFeedback) return;

    const isCorrect = answerIndex === current.correctAnswer;
    setLastCorrect(isCorrect);
    setShowFeedback(true);

    const result = {
      question: current.question,
      options: current.options,
      correctAnswer: current.correctAnswer,
      selectedAnswer: answerIndex,
      isCorrect,
    };

    const newResults = [...results, result];
    setResults(newResults);

    setTimeout(() => {
      setShowFeedback(false);
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete(newResults);
      }
    }, 1200);
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400">
          퀴즈 {currentIndex + 1}/{questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < results.length
                  ? results[i].isCorrect ? 'bg-green-400' : 'bg-rose-400'
                  : i === currentIndex ? 'bg-violet-400' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-base font-medium text-gray-800 mb-4">{current.question}</p>

      <div className="grid grid-cols-2 gap-3">
        {current.options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            disabled={showFeedback}
            className={`
              p-4 rounded-xl text-sm font-medium transition-all
              ${showFeedback
                ? i === current.correctAnswer
                  ? 'bg-green-100 border-2 border-green-400 text-green-700'
                  : 'bg-gray-50 border-2 border-gray-100 text-gray-400'
                : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50 active:scale-95'
              }
            `}
          >
            {option}
          </button>
        ))}
      </div>

      {showFeedback && (
        <div className="text-center mt-4">
          <span className="text-2xl">{lastCorrect ? '⭐' : '😊'}</span>
          <p className="text-sm text-gray-500 mt-1">
            {lastCorrect ? '정답!' : '아쉽지만 괜찮아!'}
          </p>
        </div>
      )}
    </div>
  );
}
