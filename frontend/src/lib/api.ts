import type {
  ApiErrorBody,
  DeleteMeResponse,
  FromTextResponse,
  Language,
  MatchResponse,
  PortalListResponse,
  ProfileFields,
  ProfileResponse,
  Scheme,
  SchemeDetailResponse,
  SchemeListResponse,
  SessionResponse,
} from "@/types/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let sessionPromise: Promise<SessionResponse> | null = null;
let sessionLanguage: Language | null = null;

function errorFromBody(body: unknown, status: number): ApiError {
  const parsed = body as ApiErrorBody | null;
  const detail = parsed?.detail;
  if (typeof detail === "string") return new ApiError(detail, status);
  if (detail && typeof detail === "object") {
    return new ApiError(detail.message || "Request failed", status, detail.code);
  }
  if (parsed?.error?.message) {
    return new ApiError(parsed.error.message, status, parsed.error.code);
  }
  return new ApiError("Request failed. Please try again.", status);
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function rawRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "The Sahayak API is not reachable. Make sure the backend is running on port 8000.",
      0,
      "network_error",
    );
  }
  const body = await parseBody(response);
  if (!response.ok) {
    throw errorFromBody(body, response.status);
  }
  return body as T;
}

export async function ensureSession(language?: Language): Promise<SessionResponse> {
  if (sessionPromise && (!language || language === sessionLanguage)) {
    return sessionPromise;
  }
  sessionLanguage = language ?? sessionLanguage;
  sessionPromise = rawRequest<SessionResponse>("/api/session", {
    method: "POST",
    body: JSON.stringify(language ? { language } : {}),
  }).catch((error: unknown) => {
    sessionPromise = null;
    throw error;
  });
  return sessionPromise;
}

export function resetSessionCache(): void {
  sessionPromise = null;
  sessionLanguage = null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      sessionPromise = null;
      await ensureSession();
      return rawRequest<T>(path, init);
    }
    throw error;
  }
}

export const api = {
  ensureSession,
  getProfile: () => request<ProfileResponse>("/api/profile"),
  updateProfile: (fields: ProfileFields, language?: Language) =>
    request<ProfileResponse>("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ fields, language }),
    }),
  extractProfile: (text: string, language: Language) =>
    request<FromTextResponse>("/api/profile/from-text", {
      method: "POST",
      body: JSON.stringify({ text, language }),
    }),
  match: (language: Language, fields?: ProfileFields) =>
    request<MatchResponse>("/api/match", {
      method: "POST",
      body: JSON.stringify({ language, fields }),
    }),
  listSchemes: () => request<SchemeListResponse>("/api/schemes"),
  listPortals: () => request<PortalListResponse>("/api/portals"),
  getScheme: (id: string) => request<SchemeDetailResponse>(`/api/schemes/${encodeURIComponent(id)}`),
  deleteMe: () => request<DeleteMeResponse>("/api/me", { method: "DELETE" }),
  health: () => request<{ status: string; schemes_loaded: number }>("/api/health"),
};

export function getSchemeName(scheme: Scheme, language: Language): string {
  return scheme.name[language] || scheme.name.en;
}

export function getSchemeShortName(scheme: Scheme, language: Language): string {
  return scheme.short_name[language] || scheme.short_name.en;
}

export function getSchemeDescription(scheme: Scheme, language: Language): string {
  return scheme.description[language] || scheme.description.en;
}

export function getSchemeAuthority(scheme: Scheme, language: Language): string {
  return scheme.authority[language] || scheme.authority.en;
}
