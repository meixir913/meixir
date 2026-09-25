"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------- Text to speech

/** Speaks text sentence by sentence as it streams in, so the avatar starts talking right away. */
export function useSpeaker(voiceName: string, enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const pending = useRef(0);
  const generation = useRef(0);
  const spokenUpTo = useRef(0);

  const speakChunk = useCallback(
    (text: string) => {
      const clean = text.replace(/\[END\]/g, "").trim();
      if (!enabled || !clean || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(clean);
      const voice = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
      if (voice) u.voice = voice;
      u.rate = 1;
      u.pitch = 1.05;
      pending.current += 1;
      setSpeaking(true);
      let finished = false;
      const gen = generation.current;
      const done = () => {
        if (finished || gen !== generation.current) return;
        finished = true;
        pending.current = Math.max(0, pending.current - 1);
        if (pending.current === 0) setSpeaking(false);
      };
      u.onend = done;
      u.onerror = done;
      // Some browsers never fire onend (no voices installed, tab in background); don't hang the interview.
      // The estimate is generous and counts from now, so it also covers time queued behind earlier sentences.
      setTimeout(done, 4000 + clean.split(/\s+/).length * 500 * pending.current);
      window.speechSynthesis.speak(u);
    },
    [enabled, voiceName],
  );

  /** Feed the full text so far; speaks any newly completed sentences. Pass final=true to flush the rest. */
  const feed = useCallback(
    (full: string, final = false) => {
      const rest = full.slice(spokenUpTo.current);
      if (final) {
        speakChunk(rest);
        spokenUpTo.current = full.length;
        return;
      }
      const match = rest.match(/^[\s\S]*[.!?](\s|$)/);
      if (match) {
        speakChunk(match[0]);
        spokenUpTo.current += match[0].length;
      }
    },
    [speakChunk],
  );

  const reset = useCallback(() => {
    spokenUpTo.current = 0;
  }, []);

  const stop = useCallback(() => {
    generation.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    pending.current = 0;
    setSpeaking(false);
  }, []);

  const say = useCallback(
    (text: string) => {
      stop();
      speakChunk(text);
    },
    [speakChunk, stop],
  );

  useEffect(() => stop, [stop]);

  return { speaking, feed, reset, stop, say };
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

// ---------------------------------------------------------------- Speech to text

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Browser speech recognition (Chrome, Edge, Safari). Falls back to typing where unsupported. */
export function useListener(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const wantListening = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => setSupported(getRecognitionCtor() !== null), []);

  const start = useCallback((initial = "") => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError("");
    finalText.current = initial ? `${initial.trim()} ` : "";
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-AU";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += res[0].transcript.trim() + " ";
        else interim += res[0].transcript;
      }
      onTextRef.current((finalText.current + interim).trimStart());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was blocked. You can type your answer instead.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Speech recognition error: ${e.error}`);
    };
    // Browsers end recognition after silence; restart while the candidate is still answering.
    r.onend = () => {
      if (wantListening.current) {
        try {
          r.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };
    rec.current = r;
    wantListening.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    wantListening.current = false;
    rec.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => stop, [stop]);

  return { supported, listening, error, start, stop };
}
