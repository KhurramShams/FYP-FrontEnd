'use client';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { fetchUserProfile } from '@/lib/userService';
import { fetchSubscriptionDetails } from '@/lib/subscriptionService';
import { fetchAllWorkspaces } from '@/lib/workspaceService';
import { clearSession } from '@/lib/authService';

/**
 * Invisible component that loads user profile, subscription, and workspace data
 * once on mount. Place inside the /app layout so all child pages share the data.
 *
 * 401 on workspace fetch = session expired → sign out and redirect to login.
 * Other errors (404, 500, network) = safe fallback; don't disrupt the session.
 */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const { setProfile, setSubscription, setLoaded, loaded } = useUserStore();
  const { setWorkspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (!ready || !user?.user_id || loaded) return;

    (async () => {
      try {
        // ── Fetch workspaces first so we can detect session expiry ───────────
        // A 401 here means the stored JWT is expired/invalid — clear the
        // session and send the user back to login so they can re-authenticate.
        let workspaces: Awaited<ReturnType<typeof fetchAllWorkspaces>> = [];
        try {
          workspaces = await fetchAllWorkspaces(user.user_id);
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 401) {
            // Expired session — sign out cleanly and redirect to login
            clearSession();
            window.location.replace('/login');
            return;
          }
          // Non-401 (network error, 500, no workspaces yet) — log and continue
          console.warn('[AppDataProvider] Could not load workspaces:', err?.message ?? err);
        }

        // ── Profile and subscription — silently optional ──────────────────────
        const [profile, sub] = await Promise.all([
          fetchUserProfile(user.user_id).catch(() => null),
          fetchSubscriptionDetails(user.user_id).catch(() => null),
        ]);

        if (profile) setProfile(profile);
        if (sub) setSubscription(sub);

        if (workspaces && workspaces.length) {
          const mapped = workspaces.map((w) => ({
            id: w.workspace_name,
            name: w.workspace_name,
            docs_count: w.file_count ?? 0,
          }));
          setWorkspaces(mapped);

          // Auto-select first workspace if none active
          if (!activeWorkspace) {
            setActiveWorkspace(mapped[0]);
          }
        }
      } catch (e) {
        console.error('[AppDataProvider] Unexpected load failure:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [ready, user?.user_id, loaded]);

  return <>{children}</>;
}
