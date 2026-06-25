'use client';

import { useState } from 'react';

// 재미(juice) 유틸 — 라이브러리 없이 가벼운 CSS/Web Animations 기반.
// confetti/별 팡은 globals.css 의 @keyframes 와 짝을 이룬다. prefers-reduced-motion 존중.

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** prefers-reduced-motion 을 lazy 로 한 번 읽는 훅(effect 내 setState 회피). */
export function useReducedMotion(): boolean {
  const [reduced] = useState<boolean>(() => prefersReducedMotion());
  return reduced;
}

const CONFETTI_COLORS = ['#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb7185'];

export interface ConfettiPiece {
  id: number;
  left: number; // %
  dx: number; // px drift
  delay: number; // ms
  color: string;
}

export function makeConfetti(count = 18, seed = 1): ConfettiPiece[] {
  let state = seed >>> 0 || 1;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.round(rand() * 100),
    dx: Math.round((rand() - 0.5) * 120),
    delay: Math.round(rand() * 220),
    color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
  }));
}

export interface StarPiece {
  id: number;
  dx: number;
  dy: number;
  delay: number;
  glyph: string;
}

const STAR_GLYPHS = ['⭐', '🌟', '✨', '💫'];

export function makeStars(count = 8, seed = 7): StarPiece[] {
  let state = seed >>> 0 || 1;
  const rand = () => {
    state = (state + 0x9e3779b1) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 13), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 9), value | 41);
    return ((value ^ (value >>> 12)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, (_, id) => {
    const angle = (id / count) * Math.PI * 2;
    const radius = 50 + rand() * 60;
    return {
      id,
      dx: Math.round(Math.cos(angle) * radius),
      dy: Math.round(Math.sin(angle) * radius),
      delay: Math.round(rand() * 120),
      glyph: STAR_GLYPHS[Math.floor(rand() * STAR_GLYPHS.length)],
    };
  });
}
