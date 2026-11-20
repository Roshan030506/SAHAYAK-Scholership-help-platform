import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Info,
  Mic,
  MicOff,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { VoicePulse } from "@/components/voice/VoicePulse";
import type { VoicePulseState } from "@/components/voice/VoicePulse";
import { useMicAmplitude } from "@/hooks/useMicAmplitude";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import i18n from "@/i18n";
import { buildReply } from "@/lib/assistantReplies";
import { cn } from "@/lib/utils";
import {
  assistantPageFromPath,
  detectIntent,
  schemeIdFromPath,
} from "@/lib/voiceAssistant";
import { useAppStore } from "@/store/app";
import type { Language } from "@/types/api";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
  language: Language;
}

let messageId = 0;

function nextMessageId(): number {
  messageId += 1;
  return messageId;
}

/**
 * Global voice assistant.
 *
 * It answers from the same saved profile, eligibility result and scheme JSON
 * that the pages display. When the installed voice provider is unavailable it
 * keeps the full conversation usable through the typed fallback.
 */
export function VoiceAssistant() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const open = useAppStore((state) => state.assistantOpen);
  const request = useAppStore((state) => state.assistantRequest);
  const closeAssistant = useAppStore((state) => state.closeAssistant);
  const openAssistant = useAppStore((state) => state.openAssistant);
  const language = useAppStore((state) => state.language);
  const profile = useAppStore((state) => state.profile);
  const match = useAppStore((state) => state.match);
  const autoListen = useAppStore((state) => state.assistantAutoListen);
  const speakReplies = useAppStore((state) => state.assistantSpeakReplies);
  const rate = useAppStore((state) => state.assistantRate);
  const setAutoListen = useAppStore((state) => state.setAssistantAutoListen);
  const setSpeakReplies = useAppStore((state) => state.setAssistantSpeakReplies);
  const setRate = useAppStore((state) => state.setAssistantRate);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [arming, setArming] = useState(false);
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const synth = useSpeechSynthesis();
  const recognition = useSpeechRecognition({
    language,
    autoRestart: true,
    onFinalTranscript: (segment) => {
      if (ignoreFinalsRef.current || processingRef.current) return;
      pendingRef.current = `${pendingRef.current} ${segment}`.trim();
      setInterim("");
      setMicNotice(null);
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = window.setTimeout(() => {
        silenceTimerRef.current = null;
        submitVoiceRef.current?.();
      }, 1500);
    },
    onInterimTranscript: (text) => {
      if (!ignoreFinalsRef.current) setInterim(text);
    },
    onStart: () => {
      setArming(false);
      setMicError(null);
      setVoiceStarted(true);
      hasUserStartedRef.current = true;
    },
    onError: (error) => {
      setArming(false);
      setInterim("");
      if (error === "aborted") return;
      if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture") {
        setMicError(t("assistant.errors.micDenied"));
        return;
      }
      if (error === "no-speech") {
        setMicNotice(t("assistant.errors.noSpeech"));
        return;
      }
      if (error === "unsupported" || error === "start_failed") {
        setMicError(t("assistant.errors.voiceUnsupported"));
        return;
      }
      setMicError(t("assistant.errors.voiceError"));
    },
  });

  const level = useMicAmplitude(open && (recognition.listening || arming));

  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);
  const openRef = useRef(open);
  const autoListenRef = useRef(autoListen);
  const speakRepliesRef = useRef(speakReplies);
  const rateRef = useRef(rate);
  const processingRef = useRef(false);
  const pendingRef = useRef("");
  const ignoreFinalsRef = useRef(false);
  const hasUserStartedRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const greetingTimerRef = useRef<number | null>(null);
  const armTimerRef = useRef<number | null>(null);
  const handledRequestRef = useRef<number | null>(null);
  const previousOpenRef = useRef(false);
  const processRef = useRef<(text: string, options?: { schemeId?: string }) => void>(
    () => undefined,
  );
  const startListeningRef = useRef<(source: "user" | "auto") => void>(() => undefined);
  const submitVoiceRef = useRef<() => void>(() => undefined);
  const speakReplyRef = useRef<(text: string, language: Language, silent?: boolean) => void>(
    () => undefined,
  );

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);
  useEffect(() => {
    speakRepliesRef.current = speakReplies;
  }, [speakReplies]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
      if (thinkingTimerRef.current !== null) window.clearTimeout(thinkingTimerRef.current);
      if (greetingTimerRef.current !== null) window.clearTimeout(greetingTimerRef.current);
      if (armTimerRef.current !== null) window.clearTimeout(armTimerRef.current);
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const addMessage = useCallback((role: ChatMessage["role"], text: string, messageLanguage: Language) => {
    setMessages((current) => [
      ...current.slice(-29),
      { id: nextMessageId(), role, text, language: messageLanguage },
    ]);
  }, []);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (thinkingTimerRef.current !== null) {
      window.clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    if (greetingTimerRef.current !== null) {
      window.clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = null;
    }
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(
    (source: "user" | "auto") => {
      if (!openRef.current || processingRef.current) return;
      if (source === "auto" && !hasUserStartedRef.current) return;
      if (!recognition.supported) {
        if (source === "user") setMicError(t("assistant.errors.voiceUnsupported"));
        return;
      }
      if (source === "user") {
        hasUserStartedRef.current = true;
      }
      synth.cancel();
      ignoreFinalsRef.current = false;
      pendingRef.current = "";
      setInterim("");
      setMicNotice(null);
      setMicError(null);
      setArming(true);
      recognition.start();
      if (armTimerRef.current !== null) window.clearTimeout(armTimerRef.current);
      armTimerRef.current = window.setTimeout(() => {
        armTimerRef.current = null;
        setArming(false);
      }, 8000);
    },
    [recognition, synth, t],
  );

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const submitVoice = useCallback(() => {
    const text = pendingRef.current.trim();
    if (!text) return;
    ignoreFinalsRef.current = true;
    pendingRef.current = "";
    setInterim("");
    recognition.stop();
    processRef.current(text);
  }, [recognition]);

  useEffect(() => {
    submitVoiceRef.current = submitVoice;
  }, [submitVoice]);

  const speakReply = useCallback(
    (text: string, replyLanguage: Language, silent = false) => {
      if (silent) return;
      const thenListen = () => {
        if (!mountedRef.current) return;
        if (!openRef.current || !autoListenRef.current || processingRef.current) return;
        window.setTimeout(() => {
          if (openRef.current && autoListenRef.current && !processingRef.current) {
            startListeningRef.current("auto");
          }
        }, 260);
      };

      if (!speakRepliesRef.current || !synth.supported) {
        window.setTimeout(thenListen, 220);
        return;
      }
      synth.speak(text, replyLanguage, {
        rate: rateRef.current,
        onEnd: thenListen,
        onError: () => {
          setMicError(t("assistant.errors.voiceError"));
          thenListen();
        },
      });
    },
    [synth, t],
  );

  useEffect(() => {
    speakReplyRef.current = speakReply;
  }, [speakReply]);

  const processUserText = useCallback(
    (rawText: string, options?: { schemeId?: string }) => {
      const text = rawText.trim();
      if (!text || processingRef.current) return;
      processingRef.current = true;
      synth.cancel();
      recognition.stop();
      clearTimers();
      setInterim("");
      setMicError(null);
      setMicNotice(null);
      setThinking(true);
      setInput("");
      addMessage("user", text, language);

      const state = useAppStore.getState();
      const page = assistantPageFromPath(window.location.pathname);
      const contextSchemeId = options?.schemeId ?? schemeIdFromPath(window.location.pathname);
      const intent = detectIntent(text, {
        page,
        schemeId: contextSchemeId,
        schemes: state.schemes,
      });

      if (intent.kind === "stop") {
        setThinking(false);
        processingRef.current = false;
        addMessage("assistant", t("assistant.replies.stop"), state.language);
        return;
      }

      let replyT = t;
      let replyLanguage = state.language;
      if (intent.kind === "language") {
        state.setLanguage(intent.language);
        replyT = i18n.getFixedT(intent.language);
        replyLanguage = intent.language;
      }

      let reply;
      try {
        reply = buildReply(intent, {
          t: replyT,
          language: replyLanguage,
          page,
          schemeId: contextSchemeId,
          schemes: state.schemes,
          profile: state.profile,
          match: state.match,
          lastAssistantText: [...messagesRef.current]
            .reverse()
            .find((message) => message.role === "assistant")?.text,
        });
      } catch {
        setThinking(false);
        processingRef.current = false;
        addMessage("assistant", t("assistant.errors.replyFailed"), state.language);
        return;
      }

      thinkingTimerRef.current = window.setTimeout(() => {
        thinkingTimerRef.current = null;
        if (!mountedRef.current) return;
        setThinking(false);
        addMessage("assistant", reply.text, reply.speakLanguage ?? replyLanguage);
        if (reply.action?.type === "navigate") {
          navigate(reply.action.to);
        }
        processingRef.current = false;
        if (reply.closeAfterSpeak) {
          const finishClose = () => {
            if (mountedRef.current) closeAssistant();
          };
          if (!reply.silent && speakRepliesRef.current && synth.supported) {
            synth.speak(reply.text, reply.speakLanguage ?? replyLanguage, {
              rate: rateRef.current,
              onEnd: finishClose,
              onError: finishClose,
            });
          } else {
            window.setTimeout(finishClose, 1100);
          }
          return;
        }
        if (reply.silent) return;
        speakReplyRef.current(
          reply.text,
          reply.speakLanguage ?? replyLanguage,
          false,
        );
      }, 420);
    },
    [addMessage, clearTimers, closeAssistant, language, navigate, recognition, synth, t],
  );

  useEffect(() => {
    processRef.current = processUserText;
  }, [processUserText]);

  // Greet on first open, cancel speech on close, and restore focus to the trigger.
  useEffect(() => {
    if (open && !previousOpenRef.current) {
      previousOpenRef.current = true;
      synth.cancel();
      if (!messages.length && !request) {
        const greeting = t("assistant.replies.greeting");
        addMessage("assistant", greeting, language);
        greetingTimerRef.current = window.setTimeout(() => {
          greetingTimerRef.current = null;
          if (!openRef.current || !speakRepliesRef.current || !synth.supported) return;
          synth.speak(greeting, language, { rate: rateRef.current });
        }, 180);
      }
      window.setTimeout(() => panelRef.current?.focus(), 60);
    }

    if (!open && previousOpenRef.current) {
      previousOpenRef.current = false;
      synth.cancel();
      recognition.stop();
      clearTimers();
      processingRef.current = false;
      pendingRef.current = "";
      ignoreFinalsRef.current = false;
      setArming(false);
      setThinking(false);
      setInterim("");
      triggerRef.current?.focus();
    }
  }, [
    addMessage,
    clearTimers,
    language,
    messages.length,
    open,
    recognition,
    request,
    synth,
    t,
  ]);

  // Process a request sent by a page button such as "Ask about this scheme".
  useEffect(() => {
    if (!open || !request) return;
    if (handledRequestRef.current === request.id) return;
    handledRequestRef.current = request.id;
    processRef.current(request.text, { schemeId: request.schemeId });
  }, [open, request]);

  useEffect(() => {
    if (!open) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, interim, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAssistant();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeAssistant, open]);

  const state: VoicePulseState = thinking
    ? "thinking"
    : recognition.listening || arming
      ? "listening"
      : synth.speaking
        ? "speaking"
        : "idle";
  const statusText = t(`assistant.status.${state}`);

  function handleMicClick() {
    if (thinking) return;
    if (recognition.listening || arming) {
      if (pendingRef.current.trim()) {
        submitVoiceRef.current();
      } else {
        recognition.stop();
        setArming(false);
      }
      return;
    }
    startListeningRef.current("user");
  }

  function submitTyped(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    processRef.current(text);
  }

  function handleInputChange(value: string) {
    if (recognition.listening) recognition.stop();
    if (synth.speaking) synth.cancel();
    setInput(value.slice(0, 500));
  }

  function handleSuggestion(text: string) {
    processRef.current(text);
  }

  function replay(message: ChatMessage) {
    if (!synth.supported) return;
    synth.cancel();
    synth.speak(message.text, message.language, { rate: rateRef.current });
  }

  function toggleAutoListen() {
    const next = !autoListen;
    setAutoListen(next);
    autoListenRef.current = next;
    if (!next) {
      recognition.stop();
      setArming(false);
    }
  }

  function toggleSpeakReplies() {
    const next = !speakReplies;
    setSpeakReplies(next);
    speakRepliesRef.current = next;
    if (!next) synth.cancel();
  }

  const page = assistantPageFromPath(location.pathname);
  const suggestions = useMemo(() => {
    if (page === "scheme") {
      return [
        t("assistant.suggestions.schemeDocuments"),
        t("assistant.suggestions.schemeDeadline"),
        t("assistant.suggestions.schemeWhy"),
        t("assistant.suggestions.schemeRead"),
      ];
    }
    if (match) {
      return [
        t("assistant.suggestions.eligibility"),
        t("assistant.suggestions.documents"),
        t("assistant.suggestions.readResults"),
        t("assistant.suggestions.missingProfile"),
      ];
    }
    if (profile) {
      return [
        t("assistant.suggestions.eligibility"),
        t("assistant.suggestions.missingProfile"),
        t("assistant.suggestions.profile"),
        t("assistant.suggestions.help"),
      ];
    }
    return [
      t("assistant.suggestions.help"),
      t("assistant.suggestions.profile"),
      t("assistant.suggestions.howToStart"),
    ];
  }, [match, page, profile, t]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeAssistant() : openAssistant())}
        aria-expanded={open}
        aria-controls="sahayak-assistant"
        aria-label={open ? t("assistant.close") : t("assistant.open")}
        className={cn(
          "fixed z-40 inline-flex min-h-[3.4rem] items-center gap-2.5 rounded-full px-4 py-3 font-heading text-sm font-bold text-white shadow-[0_18px_44px_rgba(11,27,58,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(11,27,58,0.38)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/50 sm:px-5",
          location.pathname === "/results"
            ? "bottom-20 right-3 sm:bottom-24 sm:right-6"
            : "bottom-5 right-4 sm:bottom-6 sm:right-6",
          open
            ? "bg-navy"
            : "bg-gradient-to-br from-saffron via-amber-500 to-teal-dark",
        )}
      >
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          {open ? (
            <X className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Mic className="h-4 w-4" aria-hidden="true" />
          )}
          {!open ? (
            <span
              className="absolute inset-0 animate-pulse-ring rounded-full border border-white/60"
              aria-hidden="true"
            />
          ) : null}
        </span>
        <span className="hidden sm:inline">
          {open ? t("assistant.closeShort") : t("assistant.open")}
        </span>
      </button>

      {open ? (
        <section
          id="sahayak-assistant"
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={t("assistant.title")}
          aria-describedby="sahayak-assistant-subtitle"
          tabIndex={-1}
          className="fixed bottom-24 right-3 z-50 flex h-[min(40rem,calc(100dvh-7.5rem))] w-[min(25rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.7rem] border border-white/80 bg-white/95 shadow-[0_30px_90px_rgba(11,27,58,0.28)] outline-none backdrop-blur-xl sm:bottom-28 sm:right-6"
        >
          <header className="relative shrink-0 overflow-hidden bg-navy px-4 pb-3 pt-4 text-white">
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-saffron/25 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-12 h-44 w-44 rounded-full bg-teal/35 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative flex items-start gap-3">
              <VoicePulse state={state} level={level} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[0.65rem] font-bold uppercase tracking-[0.18em] text-saffron-light">
                  {t("assistant.eyebrow")}
                </p>
                <h2 className="mt-0.5 font-heading text-lg font-bold leading-tight">
                  {t("assistant.title")}
                </h2>
                <p
                  id="sahayak-assistant-subtitle"
                  className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] font-medium text-white/70"
                  aria-live="polite"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      state === "listening"
                        ? "animate-pulse bg-saffron"
                        : state === "speaking"
                          ? "animate-pulse bg-teal-light"
                          : state === "thinking"
                            ? "animate-pulse bg-white/80"
                            : "bg-white/40",
                    )}
                    aria-hidden="true"
                  />
                  {statusText}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSpeakReplies}
                  aria-pressed={speakReplies}
                  aria-label={
                    speakReplies ? t("assistant.muteReplies") : t("assistant.unmuteReplies")
                  }
                  title={
                    speakReplies ? t("assistant.muteReplies") : t("assistant.unmuteReplies")
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/85 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
                >
                  {speakReplies ? (
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen((value) => !value)}
                  aria-expanded={settingsOpen}
                  aria-controls="sahayak-assistant-settings"
                  aria-label={t("assistant.settings")}
                  title={t("assistant.settings")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/85 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
                >
                  <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={closeAssistant}
                  aria-label={t("assistant.close")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/85 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>

          {settingsOpen ? (
            <div
              id="sahayak-assistant-settings"
              className="shrink-0 border-b border-navy/[0.06] bg-cream/80 px-4 py-3"
            >
              <div className="space-y-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoListen}
                  onClick={toggleAutoListen}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left text-xs font-semibold text-navy-soft transition hover:bg-navy/[0.03]"
                >
                  <span>
                    {t("assistant.handsFree")}
                    <span className="mt-0.5 block text-[0.62rem] font-medium text-navy-soft/75">
                      {t("assistant.handsFreeHint")}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                      autoListen ? "bg-teal" : "bg-navy/15",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform",
                        autoListen && "translate-x-4",
                      )}
                    >
                      {autoListen ? (
                        <Check className="h-2.5 w-2.5 text-teal" aria-hidden="true" />
                      ) : null}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={speakReplies}
                  onClick={toggleSpeakReplies}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left text-xs font-semibold text-navy-soft transition hover:bg-navy/[0.03]"
                >
                  <span>{t("assistant.speakReplies")}</span>
                  <span
                    className={cn(
                      "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                      speakReplies ? "bg-teal" : "bg-navy/15",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform",
                        speakReplies && "translate-x-4",
                      )}
                    >
                      {speakReplies ? (
                        <Check className="h-2.5 w-2.5 text-teal" aria-hidden="true" />
                      ) : null}
                    </span>
                  </span>
                </button>
                <label className="flex items-center justify-between gap-3 px-1 py-1 text-xs font-semibold text-navy-soft">
                  <span>{t("assistant.speed")}</span>
                  <select
                    value={String(rate)}
                    onChange={(event) => setRate(Number(event.target.value))}
                    className="rounded-lg border border-navy/10 bg-white px-2 py-1 text-xs font-medium text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                  >
                    <option value="0.85">{t("assistant.speedSlow")}</option>
                    <option value="0.98">{t("assistant.speedNormal")}</option>
                    <option value="1.12">{t("assistant.speedFast")}</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label={t("assistant.conversation")}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4"
          >
            {messages.map((message) =>
              message.role === "assistant" ? (
                <div key={message.id} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-saffron to-teal-dark text-white">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-navy-soft/75">
                      {t("assistant.sahayak")}
                    </p>
                    <div className="mt-1 rounded-2xl rounded-tl-md border border-navy/[0.07] bg-white px-3 py-2.5 text-[0.8rem] leading-relaxed text-navy shadow-sm">
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-navy/[0.05] pt-1.5">
                        <span className="text-[0.6rem] font-medium text-navy-soft/75">
                          {t("assistant.groundedNote")}
                        </span>
                        <button
                          type="button"
                          onClick={() => replay(message)}
                          disabled={!synth.supported}
                          aria-label={t("assistant.replay")}
                          title={t("assistant.replay")}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-navy-soft transition hover:bg-teal-50 hover:text-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 disabled:opacity-40"
                        >
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[88%]">
                    <p className="text-right text-[0.6rem] font-bold uppercase tracking-[0.12em] text-navy-soft/75">
                      {t("assistant.you")}
                    </p>
                    <div className="mt-1 rounded-2xl rounded-tr-md bg-navy px-3 py-2.5 text-[0.8rem] leading-relaxed text-white shadow-sm">
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  </div>
                </div>
              ),
            )}

            {thinking ? (
              <div className="flex items-center gap-2 text-xs font-medium text-navy-soft" aria-live="polite">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal">
                  <Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />
                </span>
                {t("assistant.status.thinking")}
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1 w-1 animate-bounce rounded-full bg-teal"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            ) : null}

            {interim ? (
              <div className="flex justify-end" aria-live="polite">
                <p className="max-w-[88%] rounded-2xl rounded-tr-md border border-dashed border-saffron/50 bg-amber-50/80 px-3 py-2 text-[0.8rem] italic leading-relaxed text-navy">
                  {interim}…
                </p>
              </div>
            ) : null}

            {micError ? (
              <p
                role="alert"
                className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[0.7rem] font-medium leading-relaxed text-red-900"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {micError}
              </p>
            ) : null}

            {micNotice && !micError ? (
              <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[0.7rem] font-medium leading-relaxed text-amber-950">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {micNotice}
              </p>
            ) : null}
          </div>

          {suggestions.length && !thinking ? (
            <div className="shrink-0 border-t border-navy/[0.05] px-3 pb-2 pt-2">
              <p className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-navy-soft/75">
                {t("assistant.tryAsking")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestion(suggestion)}
                    className="rounded-full border border-teal/15 bg-teal-50/60 px-2.5 py-1.5 text-left text-[0.68rem] font-semibold leading-snug text-teal-dark transition hover:border-teal/35 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-navy/[0.07] bg-white/95 p-3">
            <form onSubmit={submitTyped} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="sahayak-assistant-input" className="sr-only">
                  {t("assistant.inputLabel")}
                </label>
                <textarea
                  id="sahayak-assistant-input"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => handleInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitTyped();
                    }
                  }}
                  rows={1}
                  placeholder={
                    recognition.listening || arming
                      ? t("assistant.listeningPlaceholder")
                      : t("assistant.inputPlaceholder")
                  }
                  className="max-h-24 min-h-[2.7rem] w-full resize-none rounded-2xl border border-navy/10 bg-cream/70 px-3 py-2.5 text-[0.8rem] font-medium leading-relaxed text-navy outline-none transition placeholder:text-navy-soft/75 focus:border-teal/40 focus:bg-white focus:ring-2 focus:ring-teal/10"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || thinking}
                aria-label={t("assistant.send")}
                title={t("assistant.send")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleMicClick}
                disabled={!recognition.supported || thinking}
                aria-pressed={recognition.listening || arming}
                aria-label={
                  recognition.listening || arming
                    ? t("assistant.micStop")
                    : t("assistant.micStart")
                }
                title={
                  recognition.supported
                    ? recognition.listening || arming
                      ? t("assistant.micStop")
                      : t("assistant.micStart")
                    : t("assistant.errors.voiceUnsupported")
                }
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/40 disabled:cursor-not-allowed disabled:opacity-40",
                  recognition.listening || arming
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gradient-to-br from-saffron to-amber-600 hover:from-saffron-light hover:to-saffron",
                )}
              >
                {recognition.listening || arming ? (
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                {recognition.listening || arming ? (
                  <span
                    className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-saffron/60"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </form>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 px-0.5">
              <p className="text-[0.6rem] leading-relaxed text-navy-soft/75">
                {recognition.supported
                  ? autoListen && voiceStarted
                    ? t("assistant.handsFreeOn")
                    : t("assistant.micHint")
                  : t("assistant.errors.voiceUnsupported")}
              </p>
              {!synth.supported ? (
                <p className="text-[0.6rem] font-medium text-amber-800">
                  {t("assistant.errors.ttsUnsupported")}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
