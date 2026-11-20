import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { speechLanguage } from "@/lib/capabilities";
import type { Language } from "@/types/api";

interface UseSpeechRecognitionOptions {
  language: Language;
  /** Keep the microphone alive after the browser ends a recognition session. */
  autoRestart?: boolean;
  continuous?: boolean;
  onFinalTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface SpeechRecognitionState {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Web Speech STT with optional auto-restart.
 *
 * Chrome ends a continuous session after a short silence. The assistant keeps
 * the conversation going by re-arming the recogniser while the user has not
 * explicitly stopped. Fatal permission errors are surfaced once and never
 * retried in a loop.
 */
export function useSpeechRecognition({
  language,
  autoRestart = false,
  continuous = true,
  onFinalTranscript,
  onInterimTranscript,
  onStart,
  onEnd,
  onError,
}: UseSpeechRecognitionOptions): SpeechRecognitionState {
  const [supported] = useState(() => Boolean(getRecognitionConstructor()));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const desiredRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const beginRef = useRef<() => void>(() => undefined);
  const finalRef = useRef(onFinalTranscript);
  const interimRef = useRef(onInterimTranscript);
  const startRef = useRef(onStart);
  const endRef = useRef(onEnd);
  const errorRef = useRef(onError);
  const languageRef = useRef(language);

  useEffect(() => {
    finalRef.current = onFinalTranscript;
    interimRef.current = onInterimTranscript;
    startRef.current = onStart;
    endRef.current = onEnd;
    errorRef.current = onError;
  }, [onFinalTranscript, onInterimTranscript, onStart, onEnd, onError]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) {
      onErrorSafe("unsupported");
      return;
    }

    const recognition = new Constructor();
    recognition.lang = speechLanguage[languageRef.current];
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setListening(true);
      startRef.current?.();
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        if (result.isFinal) {
          const finalText = alternative.transcript.trim();
          if (finalText) {
            setTranscript((current) => {
              const separator = current && !current.endsWith(" ") ? " " : "";
              return `${current}${separator}${finalText}`;
            });
            finalRef.current?.(finalText);
          }
        } else {
          interim += alternative.transcript;
        }
      }
      const nextInterim = interim.trim();
      setInterimTranscript(nextInterim);
      interimRef.current?.(nextInterim);
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "aborted") return;
      if (FATAL_ERRORS.has(event.error)) desiredRef.current = false;
      setListening(false);
      setInterimTranscript("");
      interimRef.current?.("");
      errorRef.current?.(event.error);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      setListening(false);
      setInterimTranscript("");
      interimRef.current?.("");
      endRef.current?.();
      if (desiredRef.current && autoRestart) {
        clearRestartTimer();
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (desiredRef.current) beginRef.current();
        }, 320);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      desiredRef.current = false;
      setListening(false);
      errorRef.current?.("start_failed");
    }
  }, [autoRestart, clearRestartTimer, continuous]);

  // Keep a stable function pointer for browser callbacks.
  useEffect(() => {
    beginRef.current = begin;
  }, [begin]);

  function onErrorSafe(error: string): void {
    errorRef.current?.(error);
  }

  const start = useCallback(() => {
    if (!getRecognitionConstructor()) {
      onErrorSafe("unsupported");
      return;
    }
    desiredRef.current = true;
    clearRestartTimer();
    const current = recognitionRef.current;
    recognitionRef.current = null;
    if (current) {
      try {
        current.abort();
      } catch {
        // The session may already be closed by the browser.
      }
    }
    beginRef.current();
  }, [clearRestartTimer]);

  const stop = useCallback(() => {
    desiredRef.current = false;
    clearRestartTimer();
    const current = recognitionRef.current;
    setListening(false);
    setInterimTranscript("");
    if (current) {
      try {
        current.stop();
      } catch {
        // Ignore a session that has already ended.
      }
    }
  }, [clearRestartTimer]);

  const reset = useCallback(() => {
    desiredRef.current = false;
    clearRestartTimer();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setTranscript("");
    setInterimTranscript("");
    setListening(false);
  }, [clearRestartTimer]);

  // Re-arm the recogniser with the new locale when the user switches language.
  useEffect(() => {
    if (languageRef.current === language) return;
    languageRef.current = language;
    if (!desiredRef.current) return;
    const current = recognitionRef.current;
    recognitionRef.current = null;
    if (current) {
      try {
        current.abort();
      } catch {
        // Ignore.
      }
    }
    beginRef.current();
  }, [language]);

  useEffect(() => {
    return () => {
      desiredRef.current = false;
      clearRestartTimer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [clearRestartTimer]);

  return useMemo(
    () => ({
      supported,
      listening,
      transcript,
      interimTranscript,
      start,
      stop,
      reset,
    }),
    [supported, listening, transcript, interimTranscript, start, stop, reset],
  );
}
