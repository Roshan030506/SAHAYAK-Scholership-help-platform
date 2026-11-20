import { create } from "zustand";
import { persist } from "zustand/middleware";

import i18n from "@/i18n";
import { api, ensureSession, resetSessionCache } from "@/lib/api";
import type {
  EligibilityResult,
  Language,
  MatchResponse,
  ProfileFields,
  ProfileResponse,
  Scheme,
} from "@/types/api";

interface PreferencesState {
  language: Language;
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  assistantAutoListen: boolean;
  assistantSpeakReplies: boolean;
  assistantRate: number;
}

export interface AssistantRequest {
  id: number;
  text: string;
  schemeId?: string;
}

interface AppState extends PreferencesState {
  sessionReady: boolean;
  bootstrapping: boolean;
  bootError: boolean;
  profile: ProfileResponse | null;
  schemes: Scheme[];
  match: MatchResponse | null;
  assistantOpen: boolean;
  assistantRequest: AssistantRequest | null;
  openAssistant: (request?: { text: string; schemeId?: string }) => void;
  closeAssistant: () => void;
  setAssistantAutoListen: (enabled: boolean) => void;
  setAssistantSpeakReplies: (enabled: boolean) => void;
  setAssistantRate: (rate: number) => void;
  setLanguage: (language: Language) => void;
  setHighContrast: (enabled: boolean) => void;
  setLargeText: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
  bootstrap: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loadSchemes: () => Promise<void>;
  saveProfile: (fields: ProfileFields, language?: Language) => Promise<ProfileResponse>;
  runMatch: (language?: Language) => Promise<MatchResponse | null>;
  setLocalProfile: (profile: ProfileResponse) => void;
  setMatch: (match: MatchResponse) => void;
  findResult: (schemeId: string) => EligibilityResult | undefined;
  deleteMyData: () => Promise<Record<string, number>>;
}

function applyPreferences(state: PreferencesState): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.contrast = state.highContrast ? "high" : "normal";
  root.dataset.largeText = state.largeText ? "true" : "false";
  root.dataset.reduceMotion = state.reduceMotion ? "true" : "false";
  root.style.fontSize = state.largeText ? "18px" : "16px";
  root.lang = state.language;
  void i18n.changeLanguage(state.language);
}

let bootstrapPromise: Promise<void> | null = null;
let assistantRequestId = 0;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      language: "en",
      highContrast: false,
      largeText: false,
      reduceMotion: false,
      assistantAutoListen: true,
      assistantSpeakReplies: true,
      assistantRate: 0.98,
      sessionReady: false,
      bootstrapping: false,
      bootError: false,
      profile: null,
      schemes: [],
      match: null,
      assistantOpen: false,
      assistantRequest: null,

      openAssistant: (request) => {
        assistantRequestId += 1;
        set({
          assistantOpen: true,
          assistantRequest: request
            ? { id: assistantRequestId, text: request.text, schemeId: request.schemeId }
            : null,
        });
      },

      closeAssistant: () => set({ assistantOpen: false, assistantRequest: null }),

      setAssistantAutoListen: (assistantAutoListen) => set({ assistantAutoListen }),

      setAssistantSpeakReplies: (assistantSpeakReplies) => set({ assistantSpeakReplies }),

      setAssistantRate: (assistantRate) => set({ assistantRate }),

      setLanguage: (language) => {
        set({ language });
        applyPreferences({ ...get(), language });
        if (get().sessionReady) {
          void api.updateProfile({}, language).then((profile) => set({ profile })).catch(() => {
            // Language is a preference; a transient save failure must not block the UI.
          });
        }
      },

      setHighContrast: (highContrast) => {
        set({ highContrast });
        applyPreferences({ ...get(), highContrast });
      },

      setLargeText: (largeText) => {
        set({ largeText });
        applyPreferences({ ...get(), largeText });
      },

      setReduceMotion: (reduceMotion) => {
        set({ reduceMotion });
        applyPreferences({ ...get(), reduceMotion });
      },

      bootstrap: async () => {
        if (bootstrapPromise) return bootstrapPromise;
        bootstrapPromise = (async () => {
          set({ bootstrapping: true, bootError: false });
          try {
            await ensureSession(get().language);
            set({ sessionReady: true });
            const [profileResult, schemesResult] = await Promise.allSettled([
              api.getProfile(),
              api.listSchemes(),
            ]);
            const next: Partial<AppState> = { bootstrapping: false };
            if (profileResult.status === "fulfilled") {
              next.profile = profileResult.value;
            } else {
              next.bootError = true;
            }
            if (schemesResult.status === "fulfilled") {
              next.schemes = schemesResult.value.schemes;
            } else {
              next.bootError = true;
            }
            set(next);
          } catch {
            set({ bootError: true, bootstrapping: false, sessionReady: false });
          } finally {
            bootstrapPromise = null;
          }
        })();
        return bootstrapPromise;
      },

      refreshProfile: async () => {
        const profile = await api.getProfile();
        set({ profile });
      },

      loadSchemes: async () => {
        const response = await api.listSchemes();
        set({ schemes: response.schemes });
      },

      saveProfile: async (fields, language) => {
        const profile = await api.updateProfile(fields, language ?? get().language);
        set({ profile, match: null });
        return profile;
      },

      runMatch: async (language) => {
        const match = await api.match(language ?? get().language);
        set({ match });
        return match;
      },

      setLocalProfile: (profile) => set({ profile }),

      setMatch: (match) => set({ match }),

      findResult: (schemeId) => get().match?.results.find((result) => result.scheme_id === schemeId),

      deleteMyData: async () => {
        const response = await api.deleteMe();
        resetSessionCache();
        set({ profile: null, match: null, sessionReady: false });
        return response.deleted;
      },
    }),
    {
      name: "sahayak.preferences.v1",
      partialize: (state) => ({
        language: state.language,
        highContrast: state.highContrast,
        largeText: state.largeText,
        reduceMotion: state.reduceMotion,
        assistantAutoListen: state.assistantAutoListen,
        assistantSpeakReplies: state.assistantSpeakReplies,
        assistantRate: state.assistantRate,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyPreferences(state);
      },
    },
  ),
);

export function useProfileCompleteness(): number {
  return useAppStore((state) => state.profile?.completeness ?? 0);
}
