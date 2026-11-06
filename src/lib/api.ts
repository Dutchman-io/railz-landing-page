import { secureStorage } from "./secureStorage";
import { isRetriableNetworkError, withBackoff } from "./backoff";
import { getDeviceLabel } from "./deviceIdentity";

/**
 * Ported from zemfi-mobile's src/lib/api.ts so the libs shared with it work
 * unchanged. Differences: the base URL comes from NEXT_PUBLIC_ZEMFI_API_URL,
 * and file parts are browser File/Blob objects.
 */
/** A file chosen in the browser, as the shared libs pass it to filePart(). */
export interface FilePart {
  uri?: string;
  name: string;
  type: string;
  file: Blob;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_ZEMFI_API_URL || "https://app.zemfi.ng/api/v1";

export const getApiBaseUrl = (): string => BASE_URL;

export interface ApiError extends Error {
  status: number;
  data?: unknown;
}

const makeApiError = (
  status: number,
  message: string,
  data?: unknown,
): ApiError => {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.data = data;
  return err;
};

/**
 * How long a request may take before we give up on it.
 *
 * Without a limit a request on a dead connection can hang for minutes with a
 * spinner and no way out. Multipart uploads carry photos over cellular, so
 * they get longer.
 */
const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

const TIMEOUT_MESSAGE =
  "This is taking longer than it should. Check your connection and try again.";

/**
 * Thrown when a request is abandoned for taking too long. A plain Error (not
 * a TypeError) so friendlyErrorMessage shows its own, readable message;
 * `timedOut` lets backoff.ts recognise it without importing this module.
 */
export interface RequestTimeoutError extends Error {
  timedOut: true;
}

const makeTimeoutError = (): RequestTimeoutError => {
  const err = new Error(TIMEOUT_MESSAGE) as RequestTimeoutError;
  err.name = "RequestTimeoutError";
  err.timedOut = true;
  return err;
};

export const isTimeoutError = (err: unknown): err is RequestTimeoutError =>
  err instanceof Error && (err as Partial<RequestTimeoutError>).timedOut === true;

/** The `code` field of an API error's body, e.g. KYC_IN_REVIEW. */
export const apiErrorCode = (err: unknown): string | undefined => {
  if (typeof err !== "object" || err === null || !("data" in err)) {
    return undefined;
  }
  const data = (err as { data: unknown }).data;
  if (typeof data !== "object" || data === null) return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

/** The HTTP status of an API error, or undefined for a transport failure. */
export const apiErrorStatus = (err: unknown): number | undefined => {
  if (typeof err !== "object" || err === null || !("status" in err)) {
    return undefined;
  }
  const status = (err as { status: unknown }).status;
  return typeof status === "number" ? status : undefined;
};

/**
 * fetch() with a deadline. The response body is read inside the same window,
 * since a stalled body hangs exactly like a stalled connection. The timer is
 * cleared on every path -- success, HTTP error, transport failure, timeout.
 */
async function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = response.status === 204 ? "" : await response.text();
    return { response, text };
  } catch (err) {
    if (controller.signal.aborted) throw makeTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A message safe to show the user.
 *
 * An ApiError's message comes from our backend, and anything else our own
 * code deliberately throws (e.g. KycTier2Screen's upload-size diagnosis) is
 * written for a reader too. A bare fetch() throw (offline, DNS failure,
 * request timeout) is different: React Native surfaces it as a TypeError
 * whose message ("Network request failed") is not written for anyone, and is
 * the same regardless of cause -- so there is nothing more specific to say
 * than "check your connection" anyway. See isRetriableNetworkError in
 * backoff.ts for the same TypeError-as-network-failure signature.
 */
export const friendlyErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof TypeError) {
    return "Check your connection and try again.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
};

type OnUnauthorized = () => void;
let unauthorizedHandler: OnUnauthorized | null = null;

// Registered by the AuthProvider on mount so we don't need a route ref here.
export const setUnauthorizedHandler = (
  handler: OnUnauthorized | null,
): void => {
  unauthorizedHandler = handler;
};

// Fired on a 409 whose code is VERIFICATION_REQUIRED, or a 403 whose code is
// KYC_REQUIRED (money actions refused for an unverified user), so one sheet
// can explain it wherever it happens (state/verificationGate.tsx). The request still
// rejects afterwards; callers keep their own error handling.
let verificationRequiredHandler: (() => void) | null = null;
export const setVerificationRequiredHandler = (
  handler: (() => void) | null,
): void => {
  verificationRequiredHandler = handler;
};

// Silent access-token refresh. On a 401 we exchange the stored refresh token for
// a fresh pair before giving up — so an expired access token is renewed in the
// background instead of bouncing the user to sign-in. Concurrent 401s share one
// in-flight refresh (no stampede).
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) return false;
  try {
    // X-Device-Name matters here too: rotating the token rewrites the session
    // row, so without it the device would revert to the bare User-Agent.
    const deviceLabel = getDeviceLabel();
    const { response: res, text } = await fetchTextWithTimeout(
      `${BASE_URL}/authentication/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(deviceLabel ? { "X-Device-Name": deviceLabel } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    if (!res.ok) return false;
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const data = (json as { data?: unknown })?.data ?? json;
    const tokens = data as { accessToken?: string; refreshToken?: string };
    if (!tokens?.accessToken) return false;
    await secureStorage.setAccessToken(tokens.accessToken);
    if (tokens.refreshToken) {
      await secureStorage.setRefreshToken(tokens.refreshToken);
    }
    return true;
  } catch {
    return false;
  }
}

function ensureRefreshed(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Multipart bodies (KYC/KYB document uploads) are passed through untouched — the
// runtime sets `Content-Type` with the correct boundary, which we must not override.
const isFormData = (body: unknown): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

/**
 * Build the FormData part for a local file.
 *
 * The old bridge accepted a bare { uri, name, type } object and streamed the
 * file off disk. Bridgeless networking (new architecture, RN 0.86) does not:
 * it rejects anything that is not a string or a real Blob with "Unsupported
 * form data part", and the upload never leaves the device — which surfaces as
 * a transport failure with no HTTP status, indistinguishable from being
 * offline.
 *
 * expo-file-system's File implements Blob over the file on disk, so it streams
 * rather than loading the whole image into memory.
 */
export const filePart = (part: FilePart): Blob => part.file;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /**
   * Sent as X-Idempotency-Key. Pass the SAME value the call carries as its
   * `reference` (see useActionReference): the key belongs to the user's
   * action, not to the request, so a retry after an error or a timeout must
   * repeat it. Never mint one here per request -- that defeats the point.
   */
  idempotencyKey?: string;
  // Allow callers to opt-out of retries (e.g. user-driven submits).
  retry?: boolean;
  // Override max retries when retry is enabled.
  maxRetries?: number;
  // Appended to the URL as a query string. Entries with an undefined value are
  // dropped, so callers can pass optional filters without branching.
  params?: Record<string, string | number | boolean | undefined>;
  /**
   * Set on a request that a timer made rather than a person.
   *
   * A 409 VERIFICATION_REQUIRED opens a sheet explaining what to do next,
   * which is right when someone just tried to send money and wrong when a
   * 15-second rate poll came back. Background queries set this so an
   * unverified user is told once, by something they did, instead of every
   * time a refetch fires.
   */
  background?: boolean;
  /**
   * Give up after this many milliseconds. Defaults to 30s, or 120s for a
   * multipart upload.
   */
  timeoutMs?: number;
}

const buildQuery = (params: RequestOptions["params"]): string => {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.append(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
};

async function rawRequest<T>(
  endpoint: string,
  options: RequestOptions,
  isRetry = false,
): Promise<T> {
  const token = await secureStorage.getAccessToken();

  const multipart = isFormData(options.body);

  const isPublicEndpoint =
    endpoint === "/user/create" ||
    endpoint.startsWith("/authentication/login") ||
    endpoint.startsWith("/authentication/refresh") ||
    endpoint.startsWith("/authentication/forgot-password") ||
    endpoint.startsWith("/authentication/reset-password");

  const headers: Record<string, string> = { Accept: "application/json" };
  // Names this phone in the user's signed-in devices list. Sent on login and
  // refresh too, since that is when the session row is written.
  const deviceLabel = getDeviceLabel();
  if (deviceLabel) headers["X-Device-Name"] = deviceLabel;
  if (!multipart) headers["Content-Type"] = "application/json";
  if (token && !isPublicEndpoint) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey)
    headers["X-Idempotency-Key"] = options.idempotencyKey;

  let body: FormData | string | undefined;
  if (isFormData(options.body)) {
    body = options.body;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  }

  const { response, text } = await fetchTextWithTimeout(
    `${BASE_URL}${endpoint}${buildQuery(options.params)}`,
    {
      method: options.method ?? "GET",
      headers,
      body,
    },
    options.timeoutMs ?? (multipart ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
  );

  // 204 No Content shortcut.
  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (response.status === 401) {
    // Public endpoints (e.g. signup/login) shouldn't trigger "Session expired"
    if (!isPublicEndpoint) {
      // Try a silent refresh once (but never for the refresh call itself, and not
      // on an already-retried request). Success → replay the original request.
      if (!isRetry && endpoint !== "/authentication/refresh") {
        const refreshed = await ensureRefreshed();
        if (refreshed) return rawRequest<T>(endpoint, options, true);
      }
      await secureStorage.clear();
      unauthorizedHandler?.();
      throw makeApiError(
        401,
        "Session expired. Please sign in again.",
        payload,
      );
    }
  }

  // Both mean "verify first": the older 409 from the KYC-gated routes, and the
  // 403 the money routes (buy, sell, funding, sends, withdrawals) now answer.
  const code =
    typeof payload === "object" && payload !== null
      ? (payload as { code?: unknown }).code
      : undefined;
  if (
    !options.background &&
    ((response.status === 409 && code === "VERIFICATION_REQUIRED") ||
      (response.status === 403 && code === "KYC_REQUIRED"))
  ) {
    verificationRequiredHandler?.();
  }

  if (!response.ok) {
    const message =
      (typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `Request failed (${response.status})`;
    throw makeApiError(response.status, message, payload);
  }

  return payload as T;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const wantsRetry = options.retry ?? options.method !== "POST"; // POSTs default to no retry
  if (!wantsRetry) return rawRequest<T>(endpoint, options);
  return withBackoff(() => rawRequest<T>(endpoint, options), {
    maxRetries: options.maxRetries ?? 3,
    shouldRetry: isRetriableNetworkError,
  });
}

export const api = {
  get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">) {
    return request<T>(endpoint, { ...options, method: "GET" });
  },
  post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return request<T>(endpoint, { ...options, method: "POST", body });
  },
  // Multipart POST. Build the FormData with `filePart()` so the file part carries
  // the uri/name/type triple React Native's fetch expects.
  upload<T>(
    endpoint: string,
    form: FormData,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return request<T>(endpoint, { ...options, method: "POST", body: form });
  },
  patch<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return request<T>(endpoint, { ...options, method: "PATCH", body });
  },
  delete<T>(
    endpoint: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },
};
