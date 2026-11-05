import { API_BASE_URL } from './config';
import { toQueryString, type QueryValue } from './query-string';
import type { AuthPayload, User } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: string[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

// ---- Session ---------------------------------------------------------------
// The login is kept in localStorage and sent as a bearer token; there are no cookies.

const STORAGE_KEY = 'carsales-session';

type SavedSession = AuthPayload & { expiresAt: number };
type SessionListener = (payload: AuthPayload | null) => void;
const listeners = new Set<SessionListener>();
const notify = () => listeners.forEach((l) => l(current));

function save() {
  try {
    if (current) localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage is blocked: the login still works until the page is closed */
  }
}

function parse(raw: string | null): SavedSession | null {
  try {
    const saved = raw ? (JSON.parse(raw) as SavedSession) : null;
    return saved?.accessToken && saved.user?.id ? saved : null;
  } catch {
    return null;
  }
}

function load(): SavedSession | null {
  try {
    return parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage is blocked: nothing saved
  }
}

// Read before anything renders, so a page's first requests already carry the token. React only
// hears about it from restore(), so the first render still matches the server's HTML.
let current: SavedSession | null = typeof window === 'undefined' ? null : load();

export const session = {
  get token() {
    return current?.accessToken ?? null;
  },
  get refreshToken() {
    return current?.refreshToken ?? null;
  },
  get expired() {
    return !!current && Date.now() > current.expiresAt - 10_000;
  },
  set(payload: AuthPayload | null) {
    // Becoming a dealer only returns a new access token, so keep the refresh token we have.
    current = payload && {
      ...payload,
      refreshToken: payload.refreshToken ?? current?.refreshToken,
      expiresAt: Date.now() + payload.accessTokenExpiresIn * 1000,
    };
    save();
    notify();
  },
  setUser(user: User) {
    if (!current) return;
    current = { ...current, user };
    save();
    notify();
  },
  /** Tells React about the saved login, if any. Runs after the first render. */
  restore() {
    current = load();
    notify();
    return current;
  },
  /** Keeps other tabs in step when one signs in, signs out or gets a new token. */
  watchOtherTabs() {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      current = parse(e.key === null ? null : e.newValue);
      notify();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },
  subscribe(listener: SessionListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

let refreshing: Promise<AuthPayload | null> | null = null;

/** Swaps the refresh token for new tokens. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthPayload | null> {
  const refreshToken = session.refreshToken;
  if (!refreshToken) return Promise.resolve(null);
  refreshing ??= (async () => {
    const attempt = () =>
      fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    try {
      let res = await attempt();
      // Transient failure (rate limit, server hiccup): retry once rather than signing the user out.
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500));
        res = await attempt();
      }
      // 401 = expired or revoked. Anything else leaves the login alone: it's still valid.
      if (res.status === 200) {
        const payload = (await res.json()) as AuthPayload;
        session.set(payload);
        return payload;
      }
      if (res.status === 401) session.set(null);
      return null;
    } catch {
      return null; // offline: keep current state, let the caller surface the failure
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// ---- Requests --------------------------------------------------------------

async function toError(res: Response): Promise<ApiError> {
  let body: { message?: string | string[]; requestId?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  const details = Array.isArray(body.message) ? body.message : [];
  const message =
    typeof body.message === 'string' ? body.message : details[0] ?? res.statusText ?? 'Request failed';
  return new ApiError(res.status, message, details, body.requestId);
}

/**
 * Typed fetch wrapper. On 401 with an (expired) access token it refreshes once and
 * retries, so callers never deal with token expiry.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  // Other auth routes answer 401 for a wrong password, which isn't an expired token.
  const canRefresh = !path.startsWith('/auth/') || path === '/auth/logout-all';
  // Public routes answer an expired token as if signed out instead of with a 401, so renew it first.
  if (canRefresh && session.expired) await refreshSession();

  const send = () => {
    const headers: Record<string, string> = {};
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    return fetch(`${API_BASE_URL}${path}${toQueryString(query)}`, {
      method,
      headers,
      body: payload,
      signal,
    });
  };

  let res = await send();
  if (res.status === 401 && session.token && canRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) res = await send();
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload with progress (fetch has no upload progress events). */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  const attempt = () =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}${path}`);
      if (session.token) xhr.setRequestHeader('Authorization', `Bearer ${session.token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'));
      xhr.send(form);
    });

  return (async () => {
    let res = await attempt();
    if (res.status === 401 && (await refreshSession())) res = await attempt();
    if (res.status < 200 || res.status >= 300) {
      throw await toError(new Response(res.body, { status: res.status }));
    }
    return JSON.parse(res.body) as T;
  })();
}

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Network error — check your connection and try again.';
    if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (err.status >= 500) return 'Something went wrong on our side. Please try again.';
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}
