import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useUserStore } from '@/store/userStore';

// ── Extend Axios config to allow callers to opt out of auto-redirect on 401 ──
// Usage: api.get('/endpoint', { skipAuthRedirect: true })
// Use this on any background/silent fetch where the caller already handles
// failures with .catch() — prevents the global interceptor from wiping the
// session and redirecting to /login on transient or expected 401s.
declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

// ── Single source of truth for the backend address ───────────────────────────
// Every file in this frontend that needs to talk to the backend (or construct
// a backend URL for a redirect) should import API_BASE_URL from here rather
// than reading process.env directly, so there is exactly one place to change.
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

// ── Startup diagnostic — fail loudly if the env var is missing ───────────────
// NEXT_PUBLIC_ vars are baked in at build time; a missing value is invisible
// at runtime without this check. Runs once on module load (client-side only).
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.error(
    '%c⚠️  [API] NEXT_PUBLIC_API_URL is not set.\n' +
    'All API calls will fall back to https://overarch-shimmer-drainage.ngrok-free.dev.\n' +
    'Set it in frontend/.env.local and restart the dev server.',
    'color: #f87171; font-weight: bold; font-size: 13px;'
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── REQUEST: attach JWT token ─────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── RESPONSE: error handling ──────────────────────────────────────────────────
api.interceptors.response.use(
  (res: AxiosResponse) => res,
  (error: AxiosError) => {
    // ── Network-level failure (no response received) ───────────────────────
    // Fires when the backend is unreachable — bad URL, server down, CORS
    // preflight blocked, etc. Gives the developer an actionable diagnosis
    // instead of a generic "Network Error".
    if (!error.response && error.request) {
      console.error(
        `%c🔌 [API] Could not reach backend at ${api.defaults.baseURL}.\n` +
        'Check NEXT_PUBLIC_API_URL in your frontend/.env.local and restart the dev server.\n' +
        `Request: ${(error.config as any)?.method?.toUpperCase()} ${(error.config as any)?.url}`,
        'color: #fb923c; font-weight: bold; font-size: 12px;'
      );
    }

    // ── 401 Unauthorized: clear session and redirect to login ──────────────
    // Only redirects for foreground/critical requests. Background loaders
    // (AppDataProvider workspace/subscription fetches) set skipAuthRedirect: true
    // and handle the error themselves via .catch() — we must not loop them.
    const cfg = error.config as AxiosRequestConfig & { skipAuthRedirect?: boolean };
    if (error.response?.status === 401 && typeof window !== 'undefined' && !cfg?.skipAuthRedirect) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_email');
      localStorage.removeItem('plugin-ai-workspace-storage');
      // Reset in-memory user store so stale profile/subscription data is cleared
      // before the next user logs in on the same browser tab.
      useUserStore.getState().clear();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
