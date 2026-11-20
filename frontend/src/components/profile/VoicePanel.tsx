import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  HelpCircle,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";

import { OrbFallback } from "@/components/three/GardenFallback";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Badge";
import { useMicAmplitude } from "@/hooks/useMicAmplitude";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { useToastStore } from "@/store/toast";
import type { FromTextResponse, Language, ProfileFields } from "@/types/api";

const VoiceOrbScene = lazy(() =>
  import("@/components/three/VoiceOrbScene").then((module) => ({ default: module.VoiceOrbScene })),
);

const fieldOrder: Array<keyof ProfileFields> = [
  "name",
  "age",
  "gender",
  "state",
  "district",
  "category",
  "annual_family_income",
  "education_level",
  "last_exam_percentage",
  "course",
  "institution_type",
  "disability_status",
  "bank_account_present",
];

interface VoicePanelProps {
  language: Language;
  text: string;
  onTextChange: (text: string) => void;
  onExtracted: (fields: ProfileFields) => void;
  onUseSample: () => void;
}

/**
 * Voice-first profile input with editable transcript, extraction transparency,
 * and optional read-aloud status.
 */
export function VoicePanel({
  language,
  text,
  onTextChange,
  onExtracted,
  onUseSample,
}: VoicePanelProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const speakReplies = useAppStore((state) => state.assistantSpeakReplies);
  const autoListen = useAppStore((state) => state.assistantAutoListen);
  const readRate = useAppStore((state) => state.assistantRate);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<FromTextResponse | null>(null);
  const [voiceSession, setVoiceSession] = useState(false);
  const { supported: speechSupported, speaking, speak, cancel } = useSpeechSynthesis();
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const speech = useSpeechRecognition({
    language,
    autoRestart: true,
    onFinalTranscript: (segment) => {
      const next = textRef.current ? `${textRef.current} ${segment}` : segment;
      textRef.current = next;
      onTextChange(next);
    },
    onError: (error) => {
      if (error === "aborted") return;
      if (error === "no-speech") {
        pushToast(t("toasts.noSpeech"), "info");
        return;
      }
      if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture") {
        pushToast(t("toasts.micDenied"), "error");
        return;
      }
      pushToast(t("toasts.voiceError"), "error");
    },
  });
  const level = useMicAmplitude(speech.listening);

  async function extract() {
    if (!text.trim() || extracting) return;
    speech.stop();
    setExtracting(true);
    try {
      const response = await api.extractProfile(text.trim(), language);
      setResult(response);
      onExtracted(response.fields);
      const foundCount = Object.keys(response.updates).length;
      if (!foundCount) {
        pushToast(t("toasts.extractionFailed"), "info");
      }
      const followUp = response.follow_up_questions[0] ?? "";
      if (speakReplies && speechSupported) {
        speak(`${response.message} ${followUp}`.trim(), language, {
          rate: readRate,
          onEnd: () => {
            if (autoListen && voiceSession && speech.supported) speech.start();
          },
        });
      }
    } catch {
      pushToast(t("toasts.extractionFailed"), "error");
    } finally {
      setExtracting(false);
    }
  }

  function toggleListening() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    setVoiceSession(true);
    speech.start();
  }

  function guide() {
    if (!speechSupported) return;
    if (speaking) {
      cancel();
      return;
    }
    setVoiceSession(true);
    speak(t("profile.voice.guidePrompt"), language, {
      rate: readRate,
      onEnd: () => {
        if (speech.supported) speech.start();
      },
    });
  }

  const status = speech.listening
    ? t("profile.voice.listening")
    : extracting
      ? t("profile.voice.thinking")
      : speaking
        ? t("profile.voice.speaking")
        : t("profile.voice.idle");

  const foundFields = result
    ? fieldOrder.filter((field) => result.updates[field] !== undefined)
    : [];

  function readStatus() {
    if (!result) return;
    if (speaking) {
      cancel();
      return;
    }
    const followUp = result.follow_up_questions[0] ?? "";
    speak(`${result.message} ${followUp}`, language, { rate: readRate });
  }

  return (
    <div className="space-y-5">
      <Card tone="dark" padding="none" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-saffron/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-teal/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Pill tone="white">
                <Mic className="h-3 w-3" aria-hidden="true" />
                {t("landing.eyebrow")}
              </Pill>
              <h2 className="mt-3 font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
                {t("profile.voice.title")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onUseSample}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-heading text-xs font-semibold text-white/90 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/40"
            >
              <Sparkles className="h-3.5 w-3.5 text-saffron-light" aria-hidden="true" />
              {t("actions.useSample")}
            </button>
          </div>

          <div className="relative mx-auto mt-1 h-48 w-full max-w-sm sm:h-56">
            <Suspense
              fallback={
                <OrbFallback
                  listening={speech.listening}
                  speaking={speaking || extracting}
                  level={level}
                  className="absolute inset-0"
                />
              }
            >
              <VoiceOrbScene
                listening={speech.listening}
                speaking={speaking || extracting}
                level={level}
                className="absolute inset-0"
              />
            </Suspense>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <p
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80"
              aria-live="polite"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  speech.listening ? "animate-pulse bg-saffron" : extracting ? "animate-pulse bg-teal-light" : "bg-white/40",
                )}
                aria-hidden="true"
              />
              {status}
            </p>
            <button
              type="button"
              onClick={toggleListening}
              disabled={!speech.supported}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? t("profile.voice.stop") : t("profile.voice.start")}
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_16px_36px_rgba(245,158,11,0.28)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/40",
                speech.listening
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gradient-to-br from-saffron to-amber-600 hover:from-saffron-light hover:to-saffron",
                !speech.supported && "cursor-not-allowed opacity-50",
              )}
            >
              {speech.listening ? (
                <MicOff className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Mic className="h-6 w-6" aria-hidden="true" />
              )}
              {speech.listening ? (
                <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-saffron/60" aria-hidden="true" />
              ) : null}
            </button>
            {!speech.supported ? (
              <p className="max-w-xs text-[0.72rem] leading-relaxed text-white/60">
                {t("profile.voice.unsupported")}
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <label htmlFor="voice-transcript" className="sr-only">
              {t("profile.voice.transcriptPlaceholder")}
            </label>
            <textarea
              id="voice-transcript"
              value={text}
              onChange={(event) => onTextChange(event.target.value.slice(0, 5000))}
              rows={3}
              placeholder={t("profile.voice.transcriptPlaceholder")}
              className="w-full resize-y rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-sm font-medium leading-relaxed text-white outline-none transition placeholder:text-white/35 focus:border-saffron/50 focus:ring-4 focus:ring-saffron/10"
            />
            {speech.listening && speech.interimTranscript ? (
              <p className="mt-1.5 px-1 text-xs italic leading-relaxed text-saffron-light/80" aria-live="polite">
                {speech.interimTranscript}…
              </p>
            ) : (
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-[0.7rem] leading-relaxed text-white/45">
                  {t("profile.voice.hint")}
                </p>
                <button
                  type="button"
                  onClick={guide}
                  disabled={!speechSupported}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[0.68rem] font-semibold text-saffron-light transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {speaking ? t("actions.stop") : t("profile.voice.guide")}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void extract()}
              disabled={!text.trim() || extracting}
              loading={extracting}
              variant="saffron"
              className="flex-1"
              iconLeft={!extracting ? <WandSparkles className="h-4 w-4" aria-hidden="true" /> : undefined}
            >
              {extracting ? t("actions.extracting") : t("actions.extract")}
            </Button>
            {result ? (
              <Button
                type="button"
                variant="onDark"
                onClick={readStatus}
                disabled={!speechSupported}
                iconLeft={
                  speaking ? (
                    <VolumeX className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                  )
                }
              >
                {speaking ? t("actions.stop") : t("profile.voice.readAloud")}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {result ? (
        <Card tone="warm" padding="md" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-base font-bold text-navy">{t("profile.extractedTitle")}</h3>
              <p className="mt-1 text-xs leading-relaxed text-navy-soft">{t("profile.extractedHint")}</p>
            </div>
            <Pill tone="saffron" className="shrink-0">
              {result.provider}
            </Pill>
          </div>

          <p className="mt-3 rounded-xl border border-saffron/15 bg-white/70 px-3 py-2 text-sm font-medium leading-relaxed text-navy">
            {result.message}
          </p>

          {foundFields.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {foundFields.map((field) => {
                const confidence = result.confidence[field] ?? 0;
                const low = confidence < 0.85;
                return (
                  <li
                    key={field}
                    className={cn(
                      "inline-flex flex-col rounded-xl border px-2.5 py-1.5",
                      low
                        ? "border-amber-300 bg-amber-50 text-amber-950"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900",
                    )}
                  >
                    <span className="font-heading text-[0.72rem] font-semibold">
                      {t(`profile.fields.${field}`)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[0.65rem] font-medium opacity-80">
                      {low ? null : <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />}
                      {low ? t("profile.lowConfidence") : t("profile.confidence", { value: Math.round(confidence * 100) })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {result.follow_up_questions.length ? (
            <div className="mt-4 border-t border-saffron/15 pt-3">
              <p className="inline-flex items-center gap-1.5 font-heading text-[0.7rem] font-bold uppercase tracking-[0.12em] text-teal-dark">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {t("profile.followUps")}
              </p>
              <ul className="mt-2 space-y-1.5">
                {result.follow_up_questions.map((question) => (
                  <li key={question} className="text-xs leading-relaxed text-navy-soft">
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-[0.7rem] font-medium leading-relaxed text-navy-soft/80">
            {t("profile.extractedApplied")}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
