import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { speechLanguage } from "@/lib/capabilities";
import type { Language } from "@/types/api";

export interface SpeakOptions {
  /** Called only when every chunk finishes naturally. */
  onEnd?: () => void;
  /** Called for a real synthesis failure, not a user cancel. */
  onError?: (error: string) => void;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface SpeechSynthesisState {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  voices: SpeechSynthesisVoice[];
  speak: (text: string, language: Language, options?: SpeakOptions) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Split long replies into sentence-sized utterances.
 *
 * Chrome silently truncates very long utterances, so the assistant and page
 * readers speak in short chunks while keeping one completion callback.
 */
function splitSpeech(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const sentences = cleaned.match(/[^.!?।]+[.!?।]?/g) ?? [cleaned];
  const chunks: string[] = [];
  let current = "";

  const pushLong = () => {
    while (current.length > 220) {
      let cut = current.lastIndexOf(",", 200);
      if (cut < 80) cut = current.lastIndexOf(" ", 200);
      if (cut < 80) cut = 200;
      chunks.push(current.slice(0, cut + 1).trim());
      current = current.slice(cut + 1).trim();
    }
  };

  for (const sentence of sentences) {
    const next = sentence.trim();
    if (!next) continue;
    if (current && `${current} ${next}`.length > 180) {
      chunks.push(current);
      current = next;
    } else {
      current = `${current} ${next}`.trim();
    }
    pushLong();
  }
  if (current) chunks.push(current);
  return chunks;
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  language: Language,
  languageTag: string,
): SpeechSynthesisVoice | null {
  const tag = languageTag.toLowerCase();
  const exact = voices.find((voice) => voice.lang.toLowerCase() === tag);
  if (exact) return exact;
  const languagePrefix = `${language.toLowerCase()}-`;
  const regional = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith(languagePrefix),
  );
  if (regional) return regional;
  const base = voices.find(
    (voice) => voice.lang.toLowerCase().split("-")[0] === language.toLowerCase(),
  );
  if (base) return base;
  return voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ?? null;
}

/**
 * Read text aloud with the Web Speech API.
 *
 * The hook loads installed voices defensively (Chrome populates them
 * asynchronously), picks the best regional voice, chunks long replies and
 * exposes a single completion callback for hands-free conversation loops.
 */
export function useSpeechSynthesis(): SpeechSynthesisState {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const languageRef = useRef<Language>("en");
  const optionsRef = useRef<SpeakOptions>({});
  const generationRef = useRef(0);
  const speakingRef = useRef(false);
  const speakNextRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!supported) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", update);
    };
  }, [supported]);

  const voicesRef = useRef(voices);
  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  const finish = useCallback((generation: number, success: boolean, error?: string) => {
    if (generation !== generationRef.current) return;
    speakingRef.current = false;
    setSpeaking(false);
    setPaused(false);
    queueRef.current = [];
    indexRef.current = 0;
    const options = optionsRef.current;
    optionsRef.current = {};
    if (success) options.onEnd?.();
    else if (error) options.onError?.(error);
  }, []);

  const speakNext = useCallback(
    (generation: number) => {
      if (generation !== generationRef.current) return;
      const text = queueRef.current[indexRef.current];
      if (!text) {
        finish(generation, true);
        return;
      }
      indexRef.current += 1;
      const utterance = new SpeechSynthesisUtterance(text);
      const language = languageRef.current;
      const languageTag = speechLanguage[language];
      utterance.lang = languageTag;
      utterance.rate = Math.min(1.6, Math.max(0.6, optionsRef.current.rate ?? 0.98));
      utterance.pitch = Math.min(1.6, Math.max(0.4, optionsRef.current.pitch ?? 1));
      utterance.volume = Math.min(1, Math.max(0, optionsRef.current.volume ?? 1));
      const voice = pickVoice(voicesRef.current, language, languageTag);
      if (voice) utterance.voice = voice;
      utterance.onend = () => speakNextRef.current();
      utterance.onerror = (event) => {
        if (generation !== generationRef.current) return;
        if (event.error === "canceled" || event.error === "interrupted") {
          finish(generation, false);
          return;
        }
        finish(generation, false, event.error || "synthesis_failed");
      };
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finish(generation, false, "synthesis_failed");
      }
    },
    [finish],
  );

  useEffect(() => {
    speakNextRef.current = () => speakNext(generationRef.current);
  }, [speakNext]);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    indexRef.current = 0;
    optionsRef.current = {};
    speakingRef.current = false;
    setSpeaking(false);
    setPaused(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    (text: string, language: Language, options: SpeakOptions = {}) => {
      if (!supported) return;
      const chunks = splitSpeech(text);
      if (!chunks.length) return;
      generationRef.current += 1;
      const generation = generationRef.current;
      queueRef.current = chunks;
      indexRef.current = 0;
      languageRef.current = language;
      optionsRef.current = options;
      speakingRef.current = true;
      setSpeaking(true);
      setPaused(false);
      window.speechSynthesis.cancel();
      // Chrome needs a tick after cancel() before the next utterance.
      window.setTimeout(() => {
        if (generation === generationRef.current) speakNext(generation);
      }, 40);
    },
    [speakNext, supported],
  );

  const pause = useCallback(() => {
    if (!supported || !speakingRef.current) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () => ({ supported, speaking, paused, voices, speak, cancel, pause, resume }),
    [supported, speaking, paused, voices, speak, cancel, pause, resume],
  );
}
