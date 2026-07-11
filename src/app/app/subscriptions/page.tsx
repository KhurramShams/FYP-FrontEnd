'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  fetchAllPlans, activatePlan, upgradePlan, fetchSubscriptionDetails, checkSubscriptionStatus,
  SubscriptionPackage, UserSubscription,
} from '@/lib/subscriptionService';
import { extractErrorMessage } from '@/lib/authService';
import { initPaddle, openPaddleCheckout } from '@/lib/paddleSetup';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

// ── Shared Styling Utilities ──────────────────────────────────────────────────
const THEME = {
  primary: '#7c6df0',
  primaryHover: '#6a5ccd',
  bgCard: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  textMuted: 'rgba(255,255,255,0.45)',
  success: '#22c55e',
  error: '#f87171',
};

// ── Checkout State Types ──────────────────────────────────────────────────────
type CheckoutState =
  | 'idle'
  | 'initiating'   // calling /subscription/activate
  | 'paddle_open'  // Paddle overlay is open, waiting for user
  | 'activating'   // checkout.completed fired, polling webhook status
  | 'activated'    // status confirmed active — redirecting
  | 'error';

// ── Feature Row ───────────────────────────────────────────────────────────────
function Feature({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: highlight ? '#a89ff5' : '#fff' }}>{value}</span>
    </div>
  );
}

// ── Activating Overlay (post-payment webhook polling) ─────────────────────────
function ActivatingOverlay({ status }: { status: 'activating' | 'activated' }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`
        @keyframes pulseRing {
          0%   { transform: scale(0.85); opacity: 0.5; box-shadow: 0 0 0 0 rgba(124,109,240,0.7); }
          70%  { transform: scale(1);    opacity: 1;   box-shadow: 0 0 0 24px rgba(124,109,240,0); }
          100% { transform: scale(0.85); opacity: 0.5; box-shadow: 0 0 0 0 rgba(124,109,240,0); }
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{
        background: '#13131a', border: `1px solid ${THEME.border}`,
        borderRadius: '24px', padding: '56px 48px', textAlign: 'center',
        maxWidth: '400px', width: '100%',
        animation: 'fadeIn 0.3s ease-out forwards',
        boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
      }}>
        {status === 'activating' ? (
          <>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(124,109,240,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px', animation: 'pulseRing 2s infinite',
            }}>
              <Loader2 size={36} color={THEME.primary} style={{ animation: 'spin 1.4s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '22px', color: '#fff', fontWeight: 700, marginBottom: '10px' }}>
              Processing your payment
            </h3>
            <p style={{ fontSize: '14px', color: THEME.textMuted, lineHeight: 1.7 }}>
              This may take a few seconds…<br />
              Activating your subscription.
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px',
            }}>
              <CheckCircle2 size={40} color={THEME.success} />
            </div>
            <h3 style={{ fontSize: '22px', color: '#fff', fontWeight: 700, marginBottom: '10px' }}>
              Subscription Active!
            </h3>
            <p style={{ fontSize: '14px', color: THEME.textMuted }}>
              Redirecting you to the dashboard…
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan, isPopular, isCurrentPlan, hasActiveSubscription, checkoutState, onSelect,
}: {
  plan: SubscriptionPackage;
  isPopular: boolean;
  isCurrentPlan: boolean;
  hasActiveSubscription: boolean;
  checkoutState: CheckoutState;
  onSelect: (plan: SubscriptionPackage) => void;
}) {
  const busy = checkoutState === 'initiating';
  const disabled = isCurrentPlan || busy;

  return (
    <div style={{
      background: THEME.bgCard,
      border: isPopular ? `1px solid rgba(124,109,240,0.4)` : `0.5px solid ${THEME.border}`,
      borderRadius: '20px', padding: '32px', display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden', transition: 'border-color 0.25s, transform 0.25s',
      transform: isPopular ? 'scale(1.03)' : 'none',
    }}
      onMouseEnter={e => { if (!isPopular) e.currentTarget.style.borderColor = 'rgba(124,109,240,0.25)'; }}
      onMouseLeave={e => { if (!isPopular) e.currentTarget.style.borderColor = THEME.border; }}
    >
      {isPopular && !isCurrentPlan && (
        <div style={{
          position: 'absolute', top: '16px', right: '16px', padding: '4px 14px',
          borderRadius: '20px', fontSize: '11px', fontWeight: 700,
          background: 'linear-gradient(135deg, #7c6df0, #a89ff5)', color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.8px',
        }}>Most Popular</div>
      )}
      {isCurrentPlan && (
        <div style={{
          position: 'absolute', top: '16px', right: '16px', padding: '4px 14px',
          borderRadius: '20px', fontSize: '11px', fontWeight: 700,
          background: 'rgba(34,197,94,0.15)', color: THEME.success,
          border: '0.5px solid rgba(34,197,94,0.3)',
        }}>Current Plan</div>
      )}

      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>{plan.package_name}</h3>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '24px', lineHeight: 1.5 }}>{plan.description}</p>

      <div style={{ marginBottom: '28px' }}>
        <span style={{ fontSize: '42px', fontWeight: 800, color: '#fff' }}>${plan.price}</span>
        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginLeft: '6px' }}>/{plan.renewal_period.toLowerCase()}</span>
      </div>

      <div style={{ flex: 1, marginBottom: '28px' }}>
        <Feature label="Workspaces" value={plan.workspaces} highlight />
        <Feature label="Document Uploads / WS" value={plan.document_upload_limit} />
        <Feature label="Queries / WS" value={plan.query_limit.toLocaleString()} />
        <Feature label="API Keys / WS" value={plan.api_keys_limit} />
        <Feature label="Max Tokens / WS" value={plan.max_tokens.toLocaleString()} />
        <Feature label="API Requests" value={plan.api_requests_limit.toLocaleString()} />
        <Feature label="Analytics" value={plan.analytics} />
        <Feature label="Support" value={plan.support} />
      </div>

      <button
        id={`select-plan-${plan.subscription_code}`}
        onClick={() => onSelect(plan)}
        disabled={disabled}
        style={{
          width: '100%', padding: '14px',
          background: isCurrentPlan
            ? 'rgba(34,197,94,0.15)'
            : isPopular
              ? THEME.primary
              : 'rgba(255,255,255,0.06)',
          border: isCurrentPlan
            ? '0.5px solid rgba(34,197,94,0.3)'
            : isPopular
              ? 'none'
              : `0.5px solid rgba(255,255,255,0.12)`,
          borderRadius: '12px', fontSize: '14px', fontWeight: 600,
          cursor: isCurrentPlan ? 'default' : (disabled ? 'not-allowed' : 'pointer'),
          color: isCurrentPlan ? THEME.success : '#fff',
          transition: 'all 0.2s',
          opacity: disabled && !isCurrentPlan && !busy ? 0.4 : (busy && !isCurrentPlan ? 0.6 : 1),
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {busy && !isCurrentPlan
          ? <><Loader2 size={15} style={{ animation: 'spin 1.4s linear infinite' }} /> Initiating…</>
          : isCurrentPlan
            ? '✓ Active Plan'
            : hasActiveSubscription
              ? 'Upgrade Plan'
              : 'Select Plan'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubscriptionsPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  const [plans, setPlans]           = useState<SubscriptionPackage[]>([]);
  const [currentSub, setCurrentSub] = useState<UserSubscription | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Paddle checkout state machine
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const [checkoutError, setCheckoutError] = useState('');

  // Keep a stable ref to the poll-abort controller so we can cancel on unmount
  const pollAbortRef = useRef(false);

  // ── Load plans + current subscription ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [allPlans, sub] = await Promise.all([
        fetchAllPlans(),
        user?.user_id ? fetchSubscriptionDetails(user.user_id) : Promise.resolve(null),
      ]);
      setPlans(allPlans.sort((a, b) => a.price - b.price));
      setCurrentSub(sub);
    } catch (e: any) {
      setError(extractErrorMessage(e, 'Failed to load subscription plans.'));
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  // ── Poll subscription status after checkout.completed ──────────────────────
  const pollActivation = useCallback(async () => {
    if (!user?.user_id) return;
    pollAbortRef.current = false;
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS  = 3000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (pollAbortRef.current) return; // component unmounted

      const status = await checkSubscriptionStatus(user.user_id);
      if (status === 'active') {
        setCheckoutState('activated');
        await load(); // refresh plan display
        setTimeout(() => {
          router.push('/app/dashboard');
        }, 2500);
        return;
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));
      }
    }

    // Timed out — show friendly message; webhook may still arrive shortly
    setCheckoutState('idle');
    setCheckoutError(
      'Your payment was received but subscription activation is taking longer than expected. ' +
      'Please refresh this page in a few seconds.'
    );
  }, [user?.user_id, load, router]);

  // ── Initialise Paddle (client-side only) ───────────────────────────────────
  useEffect(() => {
    initPaddle((event: any) => {
      const name: string = event?.name ?? '';

      if (name === 'checkout.completed') {
        // Payment done — begin webhook polling
        setCheckoutState('activating');
        pollActivation();
      }

      if (name === 'checkout.closed') {
        // User cancelled without paying — silently return to plan view
        setCheckoutState('idle');
        setCheckoutError('');
      }
    });

    return () => {
      // Abort any in-flight poll when the page unmounts
      pollAbortRef.current = true;
    };
  }, [pollActivation]);

  // ── Handle "Select Plan" click ─────────────────────────────────────────────
  const handleSelectPlan = useCallback(async (plan: SubscriptionPackage) => {
    if (!user?.user_id) {
      router.push('/login');
      return;
    }

    setCheckoutError('');
    setCheckoutState('initiating');

    try {
      const hasActiveSub = currentSub?.status === 'active';
      const response = hasActiveSub
        ? await upgradePlan(plan.subscription_code)
        : await activatePlan(plan.subscription_code);

      setCheckoutState('paddle_open');
      openPaddleCheckout(response.paddle_transaction_id);
    } catch (err: any) {
      setCheckoutError(extractErrorMessage(err, 'Could not initiate checkout. Please try again.'));
      setCheckoutState('error');
    }
  }, [user?.user_id, currentSub, router]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const showActivatingOverlay =
    checkoutState === 'activating' || checkoutState === 'activated';

  return (
    <div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin   { 100% { transform: rotate(360deg); } }
      `}</style>

      {/* Activation polling overlay */}
      {showActivatingOverlay && (
        <ActivatingOverlay
          status={checkoutState === 'activated' ? 'activated' : 'activating'}
        />
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
          Choose Your Scale
        </h1>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
          Unlock higher infrastructure ceilings with a plan that fits your team's needs.
          Payments are securely processed by Paddle.
        </p>
      </div>

      {/* Page-level error (plan load or checkout initiation failure) */}
      <ErrorBanner error={checkoutError || error} onDismiss={() => { setError(''); setCheckoutError(''); }} style={{ maxWidth: '660px', margin: '0 auto 28px' }} />

      {/* Pricing Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: THEME.bgCard, border: `0.5px solid ${THEME.border}`, borderRadius: '20px', padding: '32px', minHeight: '480px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="skeleton" style={{ width: '50%',  height: '22px' }} />
              <div className="skeleton" style={{ width: '75%',  height: '14px' }} />
              <div className="skeleton" style={{ width: '35%',  height: '44px', borderRadius: '8px' }} />
              {[1,0.9,1,0.85,1].map((w, j) => (
                <div key={j} className="skeleton" style={{ width: `${w * 100}%`, height: '10px' }} />
              ))}
              <div className="skeleton" style={{ width: '100%', height: '46px', borderRadius: '12px', marginTop: 'auto' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.subscription_code}
              plan={plan}
              isPopular={plan.subscription_code === 'PP-01'}
              isCurrentPlan={currentSub?.subscription_package_code === plan.subscription_code}
              hasActiveSubscription={currentSub?.status === 'active'}
              checkoutState={checkoutState}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>
      )}
    </div>
  );
}
