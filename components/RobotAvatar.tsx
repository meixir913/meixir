"use client";

import { useEffect, useRef, useState } from "react";

export type AvatarState = "idle" | "speaking" | "listening" | "thinking";

/**
 * Friendly animated interviewer. The mouth moves while speaking, the eyes blink,
 * glance up while thinking, and the antenna glows green while listening.
 */
export default function RobotAvatar({ state, size = 320 }: { state: AvatarState; size?: number }) {
  const [mouth, setMouth] = useState(0.1);
  const [blink, setBlink] = useState(false);
  const raf = useRef<number | null>(null);

  // Mouth animation: a mix of sines gives a natural, syllable-like rhythm.
  useEffect(() => {
    if (state !== "speaking") {
      setMouth(state === "listening" ? 0.05 : 0.12);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const v = Math.abs(Math.sin(t * 11) * 0.6 + Math.sin(t * 17.3) * 0.3 + Math.sin(t * 5.1) * 0.25);
      setMouth(Math.min(1, 0.15 + v));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [state]);

  // Blink every few seconds.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2200 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const eyeY = state === "thinking" ? -7 : 0;
  const eyeScale = blink ? 0.1 : state === "listening" ? 1.12 : 1;
  const mouthH = 6 + mouth * 26;
  const antenna = state === "listening" ? "#34d399" : state === "speaking" ? "#fb923c" : state === "thinking" ? "#60a5fa" : "#fdba74";

  return (
    <svg viewBox="0 0 320 340" width={size} height={size * (340 / 320)} className="float drop-shadow-xl" role="img" aria-label={`AI interviewer, ${state}`}>
      <defs>
        <linearGradient id="head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" style={{ stopColor: "var(--color-brand-100)" }} />
        </linearGradient>
        <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e2a4a" />
          <stop offset="1" stopColor="#101a33" />
        </linearGradient>
        <radialGradient id="eyeGlow">
          <stop offset="0" stopColor="#e0fbff" />
          <stop offset="0.5" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* shoulders */}
      <path d="M40 340 C 50 285, 100 262, 160 262 C 220 262, 270 285, 280 340 Z" style={{ fill: "var(--color-brand-500)" }} />
      <path d="M130 262 L160 296 L190 262 Z" style={{ fill: "var(--color-brand-50)" }} />
      <rect x="196" y="292" width="46" height="26" rx="6" fill="#fff" opacity="0.95" />
      <text x="219" y="309" textAnchor="middle" fontSize="11" fontWeight="800" style={{ fill: "var(--color-brand-700)", fontFamily: "var(--font-sans)" }}>
        ROBIN
      </text>

      {/* neck */}
      <rect x="138" y="232" width="44" height="34" rx="8" fill="#e2d6cf" />

      {/* antenna */}
      <line x1="160" y1="44" x2="160" y2="18" stroke="#cbb8ad" strokeWidth="5" strokeLinecap="round" />
      <circle cx="160" cy="14" r="10" fill={antenna} filter="url(#glow)">
        {state === "listening" && <animate attributeName="r" values="9;12;9" dur="1.2s" repeatCount="indefinite" />}
      </circle>

      {/* ears */}
      <rect x="22" y="112" width="26" height="62" rx="12" style={{ fill: "var(--color-brand-400)" }} />
      <rect x="272" y="112" width="26" height="62" rx="12" style={{ fill: "var(--color-brand-400)" }} />
      {state === "listening" && (
        <>
          <circle cx="35" cy="143" r="5" fill="#34d399" filter="url(#glow)" />
          <circle cx="285" cy="143" r="5" fill="#34d399" filter="url(#glow)" />
        </>
      )}

      {/* head */}
      <rect x="40" y="42" width="240" height="200" rx="64" fill="url(#head)" stroke="#f3d5c6" strokeWidth="3" />
      {/* face screen */}
      <rect x="66" y="72" width="188" height="142" rx="46" fill="url(#screen)" />

      {/* eyes */}
      <g transform={`translate(0 ${eyeY})`} style={{ transition: "transform 300ms ease" }}>
        {[118, 202].map((cx) => (
          <g key={cx} transform={`translate(${cx} 128) scale(1 ${eyeScale})`} style={{ transition: "transform 90ms linear" }}>
            <ellipse rx="19" ry="22" fill="url(#eyeGlow)" filter="url(#glow)" />
            <circle cx="6" cy="-8" r="5" fill="#fff" opacity="0.9" />
          </g>
        ))}
      </g>

      {/* cheeks */}
      <ellipse cx="94" cy="170" rx="13" ry="7" fill="#fb7185" opacity="0.45" />
      <ellipse cx="226" cy="170" rx="13" ry="7" fill="#fb7185" opacity="0.45" />

      {/* mouth */}
      <rect x={160 - 22} y={180 - mouthH / 2} width="44" height={mouthH} rx={Math.min(14, mouthH / 2)} fill="#67e8f9" filter="url(#glow)" />
      {state !== "speaking" && state !== "listening" && (
        <path d="M140 176 Q160 192 180 176" stroke="#101a33" strokeWidth="6" fill="none" strokeLinecap="round" />
      )}

      {/* thinking dots */}
      {state === "thinking" && (
        <g fill="#60a5fa">
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={250 + i * 16} cy={50} r="5">
              <animate attributeName="opacity" values="0.2;1;0.2" dur="1s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      )}
    </svg>
  );
}
