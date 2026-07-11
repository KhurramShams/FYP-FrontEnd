'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { deleteUserAccount } from '@/lib/userService';
import { clearSession, extractErrorMessage, verifyOTP, resendOTP } from '@/lib/authService';
import api from '@/lib/api';
import { Shield, LayoutGrid, CreditCard, Bell, Lock, Key, Smartphone, HardDrive, Download, AlertTriangle, Mail, Loader2 } from 'lucide-react';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { fetchConversations, fetchConversationMessages } from '@/lib/messageService';

const THEME = {
  primary: '#7c6df0',
  danger: '#ef4444',
  bgCard: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  textMuted: 'rgba(255,255,255,0.45)',
  inputBg: 'rgba(255,255,255,0.04)',
};

// ── Shared Utilities ────────────────────────────────────────────────────────
function Banner({ type, children, onDismiss }: { type: 'success' | 'error'; children: React.ReactNode; onDismiss?: () => void }) {
  if (type === 'error') {
    return <ErrorBanner error={typeof children === 'string' ? children : String(children)} onDismiss={onDismiss} style={{ marginBottom: '24px' }} />;
  }
  return (
    <div style={{
      padding: '12px 16px', marginBottom: '24px', fontSize: '13px', borderRadius: '10px',
      background: 'rgba(34,197,94,0.1)',
      border: '1px solid rgba(34,197,94,0.3)',
      color: '#22c55e',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>{children}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}>×</button>}
    </div>
  );
}

function SectionCard({ title, desc, children, danger }: { title: string, desc: string, children: React.ReactNode, danger?: boolean }) {
  return (
    <div style={{ background: danger ? 'rgba(239,68,68,0.02)' : THEME.bgCard, border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : THEME.border}`, borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: danger ? THEME.danger : '#fff', marginBottom: '6px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: THEME.textMuted, marginBottom: '24px', lineHeight: 1.5 }}>{desc}</p>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <div 
      onClick={onChange}
      style={{
        width: '44px', height: '24px', borderRadius: '12px', background: checked ? THEME.primary : 'rgba(255,255,255,0.1)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
      }}
    >
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '3px', left: checked ? '23px' : '3px',
        transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }} />
    </div>
  );
}

// ── Tab Modules ─────────────────────────────────────────────────────────────

function SecurityTab({ userId }: { userId: string }) {
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── 2FA state ───────────────────────────────────────────────────────────────
  const [twoFactor, setTwoFactor]       = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(true);   // loading initial status
  const [showPwModal, setShowPwModal]   = useState(false);
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null);
  const [pw, setPw]                     = useState('');
  const [toggling, setToggling]         = useState(false);

  // ── Change Password state ───────────────────────────────────────────────────
  const [showChangePwModal, setShowChangePwModal] = useState(false);
  const [oldPassword, setOldPassword]             = useState('');
  const [newPassword, setNewPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]     = useState('');
  const [changingPw, setChangingPw]               = useState(false);
  const [pwError, setPwError]                     = useState('');

  // Fetch real 2FA status on mount
  useEffect(() => {
    api.get(`/auth/2fa/status/${userId}`, { skipAuthRedirect: true })
      .then(res => setTwoFactor(res.data.two_fa_enabled ?? false))
      .catch(() => setTwoFactor(false))
      .finally(() => setTwoFaLoading(false));
  }, [userId]);

  const handleToggleClick = () => {
    const action = twoFactor ? 'disable' : 'enable';
    setPendingAction(action);
    setPw('');
    setShowPwModal(true);
    setMsg(null);
  };

  const handleConfirm = async () => {
    if (!pendingAction || !pw) return;
    setToggling(true); setMsg(null);
    try {
      await api.post(`/auth/2fa/${pendingAction}`, {
        user_id: userId,
        password: pw,
      });
      setTwoFactor(pendingAction === 'enable');
      setMsg({
        type: 'success',
        text: pendingAction === 'enable'
          ? '2FA enabled — a confirmation code was sent to your email.'
          : '2FA has been disabled for your account.',
      });
    } catch (err: any) {
      // Revert — toggle stays at previous value since we only set it on success
      setMsg({ type: 'error', text: extractErrorMessage(err, `Failed to ${pendingAction} 2FA.`) });
    } finally {
      setToggling(false);
      setShowPwModal(false);
      setPendingAction(null);
      setPw('');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation password do not match.');
      return;
    }
    setChangingPw(true);
    try {
      await api.post('/auth/update_password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setMsg({ type: 'success', text: 'Password has been successfully updated.' });
      setShowChangePwModal(false);
    } catch (err: any) {
      setPwError(extractErrorMessage(err, 'Failed to update password.'));
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div>
      {msg && <Banner type={msg.type} onDismiss={() => setMsg(null)}>{msg.text}</Banner>}
      
      <SectionCard title="Authentication Flow" desc="Rotate your security credentials manually to update security configurations.">
        <button 
          onClick={() => { setShowChangePwModal(true); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPwError(''); setMsg(null); }} 
          style={{ padding: '12px 24px', background: THEME.bgCard, border: `1px solid ${THEME.border}`, borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <Key size={16} color={THEME.primary} />
          Change Password
        </button>
      </SectionCard>

      <SectionCard title="Two-Factor Authentication (2FA)" desc="Add an additional layer of security to your account. When enabled, you'll receive a one-time code via email each time you log in.">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: `1px solid ${THEME.border}` }}>
          <div>
            <div style={{ fontSize: '14px', color: '#fff', fontWeight: 500 }}>Email OTP Verification</div>
            <div style={{ fontSize: '12px', color: THEME.textMuted, marginTop: '4px' }}>
              {twoFaLoading ? 'Loading status…' : twoFactor ? 'Currently active — a code will be sent on every login.' : 'Currently off — enable to require a verification code at login.'}
            </div>
          </div>
          {twoFaLoading ? (
            <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)' }} />
          ) : (
            <Toggle checked={twoFactor} onChange={handleToggleClick} />
          )}
        </div>
      </SectionCard>

      {/* Password confirmation modal for 2FA toggle */}
      {showPwModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '400px', background: '#13131a', border: `1px solid ${THEME.border}`, borderRadius: '20px', padding: '32px', animation: 'modalSlideUp 0.3s ease-out forwards' }}>
            <h2 style={{ fontSize: '20px', color: '#fff', fontWeight: 700, marginBottom: '8px' }}>
              {pendingAction === 'enable' ? 'Enable' : 'Disable'} Two-Factor Authentication
            </h2>
            <p style={{ fontSize: '14px', color: THEME.textMuted, marginBottom: '24px', lineHeight: 1.5 }}>
              Enter your password to confirm this change.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Password</label>
                <input
                  type="password" required autoFocus
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  disabled={toggling}
                  placeholder="Enter your password"
                  style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', opacity: toggling ? 0.6 : 1 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => { setShowPwModal(false); setPendingAction(null); setPw(''); }} disabled={toggling} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${THEME.border}`, borderRadius: '8px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={!pw || toggling} style={{ padding: '10px 24px', background: pendingAction === 'disable' ? THEME.danger : THEME.primary, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: pw && !toggling ? 'pointer' : 'not-allowed', opacity: pw && !toggling ? 1 : 0.5 }}>
                  {toggling ? 'Confirming…' : pendingAction === 'enable' ? 'Enable 2FA' : 'Disable 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePwModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '400px', background: '#13131a', border: `1px solid ${THEME.border}`, borderRadius: '20px', padding: '32px', animation: 'modalSlideUp 0.3s ease-out forwards' }}>
            <h2 style={{ fontSize: '20px', color: '#fff', fontWeight: 700, marginBottom: '8px' }}>
              Change Password
            </h2>
            <p style={{ fontSize: '14px', color: THEME.textMuted, marginBottom: '24px', lineHeight: 1.5 }}>
              Manually update your security credentials.
            </p>
            {pwError && (
              <div style={{ padding: '10px 14px', marginBottom: '16px', background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '13px', color: THEME.danger }}>
                {pwError}
              </div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Current Password</label>
                <input
                  type="password" required autoFocus
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  disabled={changingPw}
                  placeholder="Current password"
                  style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', opacity: changingPw ? 0.6 : 1 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>New Password</label>
                <input
                  type="password" required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={changingPw}
                  placeholder="New password (min 8 chars)"
                  style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', opacity: changingPw ? 0.6 : 1 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Confirm New Password</label>
                <input
                  type="password" required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={changingPw}
                  placeholder="Confirm new password"
                  style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', opacity: changingPw ? 0.6 : 1 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => { setShowChangePwModal(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPwError(''); }} disabled={changingPw} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${THEME.border}`, borderRadius: '8px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={!oldPassword || !newPassword || !confirmPassword || changingPw} style={{ padding: '10px 24px', background: THEME.primary, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: oldPassword && newPassword && confirmPassword && !changingPw ? 'pointer' : 'not-allowed', opacity: oldPassword && newPassword && confirmPassword && !changingPw ? 1 : 0.5 }}>
                  {changingPw ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SectionCard title="Active Sessions" desc="Devices currently holding an authorized session token for your underlying account parameters.">
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(124,109,240,0.05)', borderRadius: '10px', border: `1px solid rgba(124,109,240,0.2)` }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
               <Smartphone size={24} color={THEME.textMuted} />
               <div>
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 500 }}>Current Browser Window</div>
                  <div style={{ fontSize: '12px', color: THEME.textMuted, marginTop: '2px' }}>IP: Local Network · Origin Active</div>
               </div>
            </div>
            <span style={{ fontSize: '12px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>Active Now</span>
         </div>
         <div style={{ marginTop: '24px' }}>
           <button style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
             Sign out of all other sessions
           </button>
         </div>
      </SectionCard>
    </div>
  );
}

function WorkspaceTab() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore();

  return (
    <div>
      <SectionCard title="Global Namespace Targets" desc="Define which vector workspace your dashboard organically binds to upon initial load execution.">
        {workspaces.length === 0 ? (
           <p style={{ color: THEME.textMuted, fontSize: '14px' }}>No standard workspaces exist yet inside this cluster.</p>
        ) : (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             {workspaces.map(ws => (
               <div 
                 key={ws.id} 
                 onClick={() => setActiveWorkspace(ws)}
                 style={{ 
                   display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
                   background: activeWorkspace?.id === ws.id ? 'rgba(124,109,240,0.08)' : THEME.bgCard,
                   border: `1px solid ${activeWorkspace?.id === ws.id ? THEME.primary : THEME.border}`,
                   borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s'
                 }}
               >
                  <div>
                    <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}>{ws.name}</div>
                    <div style={{ fontSize: '13px', color: THEME.textMuted, marginTop: '4px' }}>{ws.docs_count} Documents Synced</div>
                  </div>
                  {activeWorkspace?.id === ws.id && (
                     <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: THEME.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }}/>
                     </div>
                  )}
               </div>
             ))}
           </div>
        )}
      </SectionCard>
    </div>
  );
}

import {
  getPaymentMethods, addPaymentMethod, deletePaymentMethod, getPaymentHistory,
  PaymentMethod, PaymentTransaction, PaymentMethodCreatePayload
} from '@/lib/paymentService';
import { Plus, Trash2, CheckCircle2, History } from 'lucide-react';
import { cancelSubscription } from '@/lib/subscriptionService';

function SubscriptionTab({ userId }: { userId: string }) {
  const { subscription } = useUserStore();
  const plan = subscription?.subscription_package_code || 'FREE-TIER';
  
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMethod, setNewMethod] = useState<Partial<PaymentMethodCreatePayload>>({
     payment_method_type: 'Card', currency_code: 'USD', Is_default_method: false
  });
  const [adding, setAdding] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPlanInput, setCancelPlanInput] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const handleCancelSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscription) return;
    if (cancelPlanInput !== subscription.subscription_package_code) {
      setCancelError('Plan code does not match.');
      return;
    }
    setCancelling(true);
    setCancelError('');
    try {
      await cancelSubscription(subscription.subscription_id);
      setShowCancelModal(false);
      setCancelPlanInput('');
      useUserStore.getState().setSubscription(null);
      await loadData();
    } catch (err: any) {
      setCancelError(extractErrorMessage(err, 'Failed to cancel subscription.'));
    } finally {
      setCancelling(false);
    }
  };

  const loadData = React.useCallback(async () => {
     setLoading(true);
     try {
       const [methRes, txRes] = await Promise.all([
         getPaymentMethods(userId),
         getPaymentHistory(userId)
       ]);
       setMethods(methRes);
       setTransactions(txRes);
     } catch (e) { console.error(e); }
     setLoading(false);
  }, [userId]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await addPaymentMethod({ ...newMethod, user_id: userId } as PaymentMethodCreatePayload);
      setShowAddModal(false);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to connect method.');
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm('Delete this payment method permanently?')) return;
    try {
      await deletePaymentMethod(id);
      await loadData();
    } catch (e) { console.error(); }
  };

  const handleDownloadCSV = () => {
     const headers = ['Transaction ID', 'Date', 'Package Bound', 'Amount', 'Currency', 'Status'];
     const rows = transactions.map(tx => [
       tx.payment_reference_number,
       tx.transaction_date,
       tx.subscription_package_code,
       tx.amount.toString(),
       tx.currency,
       tx.status
     ]);
     const csvContent = "data:text/csv;charset=utf-8," 
         + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
     
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `payment_history_${userId}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };
  
  return (
    <div>
      <SectionCard title="Current Plan Constraints" desc="Your account operates linearly within these generative thresholds.">
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', background: 'linear-gradient(135deg, rgba(124,109,240,0.1), transparent)', borderRadius: '12px', border: `1px solid rgba(124,109,240,0.3)`, marginBottom: '24px' }}>
            <div>
              <span style={{ fontSize: '12px', color: THEME.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Plan</span>
              <div style={{ fontSize: '28px', color: '#fff', fontWeight: 700, marginTop: '6px' }}>{plan}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {subscription && subscription.status === 'active' && (
                <button onClick={() => setShowCancelModal(true)} style={{ padding: '10px 24px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: THEME.danger, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                   Cancel Subscription
                </button>
              )}
              <button onClick={() => window.location.href='/app/subscriptions'} style={{ padding: '10px 24px', background: THEME.primary, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                 Upgrade Infrastructure
              </button>
            </div>
         </div>
      </SectionCard>
      
      <SectionCard title="Payment Methods" desc="Saved gateways natively bridged for recurring integrations.">
         <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {loading ? <div style={{ color: THEME.textMuted, fontSize: '14px' }}>Querying stored routing models...</div> : 
               methods.length === 0 ? <div style={{ color: THEME.textMuted, fontSize: '14px' }}>No payment bounds defined.</div> :
               methods.map(m => (
                 <div key={m.payment_details_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: THEME.bgCard, border: `1px solid ${THEME.border}`, borderRadius: '12px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                       <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: THEME.primary }}>
                         <CreditCard size={20} />
                       </div>
                       <div>
                         <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {m.payment_method_type === 'Card' ? m.card_brand : m.bank_name} {m.payment_method_type === 'Card' && 'Card'}
                            {m.Is_default_method && <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '11px', fontWeight: 700 }}>DEFAULT</span>}
                         </div>
                         <div style={{ fontSize: '12px', color: THEME.textMuted, marginTop: '4px' }}>Registered to {m.account_holder_name}</div>
                       </div>
                    </div>
                    <button onClick={() => handleDelete(m.payment_details_id)} style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: THEME.danger, cursor: 'pointer' }}>
                       <Trash2 size={16} />
                    </button>
                 </div>
               ))
            }
         </div>
         <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'transparent', border: `1px dashed ${THEME.border}`, borderRadius: '8px', color: THEME.primary, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} /> Mount New Method
         </button>
      </SectionCard>

      <SectionCard title="Billing & Transactions" desc="Historical receipts generated across payment gateways.">
         <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={handleDownloadCSV} disabled={transactions.length===0} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: THEME.bgCard, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: transactions.length ? 'pointer' : 'not-allowed', opacity: transactions.length ? 1 : 0.5 }}>
               <Download size={14} /> Export CSV Ledger
            </button>
         </div>
         <div style={{ background: 'rgba(255,255,255,0.01)', border: `1px solid ${THEME.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', fontSize: '12px', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Reference Vector</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Package</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Value</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: THEME.textMuted, fontSize: '13px' }}>No transactional vectors detected in this matrix.</td></tr>
                ) : transactions.map(tx => (
                   <tr key={tx.id} style={{ borderTop: `1px solid ${THEME.border}`, fontSize: '13px', color: '#fff' }}>
                     <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{tx.payment_reference_number}</td>
                     <td style={{ padding: '16px 20px', fontWeight: 500 }}>{tx.subscription_package_code}</td>
                     <td style={{ padding: '16px 20px' }}>{tx.amount} {tx.currency}</td>
                     <td style={{ padding: '16px 20px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: tx.status.toUpperCase()==='SUCCESS'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', color: tx.status.toUpperCase()==='SUCCESS'?'#22c55e':'#f87171' }}>
                          {tx.status.toUpperCase()}
                        </span>
                     </td>
                     <td style={{ padding: '16px 20px', color: THEME.textMuted }}>{tx.transaction_date}</td>
                   </tr>
                ))}
              </tbody>
            </table>
         </div>
      </SectionCard>

      {/* Internal Add Modal Layout */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
           <div style={{ width: '100%', maxWidth: '450px', background: '#13131a', border: `1px solid ${THEME.border}`, borderRadius: '20px', padding: '32px', animation: 'modalSlideUp 0.3s ease-out forwards' }}>
              <h2 style={{ fontSize: '20px', color: '#fff', fontWeight: 700, marginBottom: '24px' }}>Bind New Target</h2>
              <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Routing Protocol</label>
                    <select required value={newMethod.payment_method_type} onChange={e => setNewMethod({...newMethod, payment_method_type: e.target.value})} style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }}>
                      <option value="Card">Credit / Debit Array</option>
                      <option value="Bank">Direct Matrix Setup (Bank)</option>
                    </select>
                 </div>
                 
                 <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                       {newMethod.payment_method_type === 'Card' ? 'Card Brand (e.g. Visa, Amex)' : 'Regional Bank Name'}
                    </label>
                    <input required value={newMethod.payment_method_type === 'Card' ? newMethod.card_brand||'' : newMethod.bank_name||''} onChange={e => newMethod.payment_method_type==='Card' ? setNewMethod({...newMethod, card_brand: e.target.value}) : setNewMethod({...newMethod, bank_name: e.target.value})} style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                 </div>

                 <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Holding Title (Name)</label>
                    <input required value={newMethod.account_holder_name||''} onChange={e => setNewMethod({...newMethod, account_holder_name: e.target.value})} style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                 </div>

                 <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Target Exchange</label>
                      <input required value={newMethod.currency_code||'USD'} onChange={e => setNewMethod({...newMethod, currency_code: e.target.value})} style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                    </div>
                    {newMethod.payment_method_type === 'Card' && (
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Expiration (MM/YY)</label>
                        <input required value={newMethod.expiration_date||''} onChange={e => setNewMethod({...newMethod, expiration_date: e.target.value})} placeholder="12/26" style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                      </div>
                    )}
                 </div>
                 
                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                    <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${THEME.border}`, borderRadius: '8px', color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
                    <button type="submit" disabled={adding} style={{ padding: '10px 24px', background: THEME.primary, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600 }}>{adding ? 'Synchronizing...' : 'Save Configuration'}</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && subscription && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
           <div style={{ width: '100%', maxWidth: '450px', background: '#13131a', border: `1px solid ${THEME.border}`, borderRadius: '20px', padding: '32px', animation: 'modalSlideUp 0.3s ease-out forwards' }}>
              <h2 style={{ fontSize: '20px', color: '#fff', fontWeight: 700, marginBottom: '8px' }}>Cancel Subscription</h2>
              <p style={{ fontSize: '14px', color: THEME.textMuted, marginBottom: '24px', lineHeight: 1.5 }}>
                 To confirm cancellation, please type your active plan code: <strong style={{ color: '#fff' }}>{subscription.subscription_package_code}</strong>.
              </p>
              
              {cancelError && (
                <div style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '13px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
                   {cancelError}
                </div>
              )}

              <form onSubmit={handleCancelSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Plan Code</label>
                    <input
                       required
                       autoFocus
                       value={cancelPlanInput}
                       onChange={e => setCancelPlanInput(e.target.value)}
                       disabled={cancelling}
                       placeholder={`Type ${subscription.subscription_package_code}`}
                       style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                 </div>
                 
                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                    <button type="button" onClick={() => { setShowCancelModal(false); setCancelPlanInput(''); setCancelError(''); }} disabled={cancelling} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${THEME.border}`, borderRadius: '8px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={cancelPlanInput !== subscription.subscription_package_code || cancelling} style={{ padding: '10px 24px', background: THEME.danger, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: cancelPlanInput === subscription.subscription_package_code && !cancelling ? 'pointer' : 'not-allowed', opacity: cancelPlanInput === subscription.subscription_package_code && !cancelling ? 1 : 0.5 }}>
                       {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

function NotificationsTab({ userId, email }: { userId: string; email: string }) {
  const [sendingUsage, setSendingUsage] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSendUsageReport = async () => {
    if (!email) return;
    setSendingUsage(true);
    setMsg(null);
    try {
      await api.post(`/send_usage_email/send_usage_email_to_user?email=${encodeURIComponent(email)}`);
      setMsg({ type: 'success', text: 'Usage report has been successfully dispatched to your email!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: extractErrorMessage(err, 'Failed to send usage report.') });
    } finally {
      setSendingUsage(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {msg && <Banner type={msg.type} onDismiss={() => setMsg(null)}>{msg.text}</Banner>}

      <SectionCard title="Resource Usage Digest" desc="Request a real-time summary detailing active vector counts, token consumption levels, and workspace utilization sent straight to your email.">
         <button 
           onClick={handleSendUsageReport} 
           disabled={sendingUsage} 
           style={{ 
             padding: '12px 24px', 
             background: 'linear-gradient(135deg, #7c6df0, #a89ff5)', 
             border: 'none', 
             borderRadius: '10px', 
             color: '#fff', 
             fontSize: '14px', 
             fontWeight: 600, 
             cursor: sendingUsage ? 'wait' : 'pointer', 
             display: 'flex', 
             alignItems: 'center', 
             gap: '10px',
             boxShadow: '0 4px 14px rgba(124,109,240,0.25)',
             transition: 'transform 0.2s, opacity 0.2s'
           }}
           onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
           onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
         >
           {sendingUsage ? (
             <>
               <div style={{width:'16px',height:'16px',borderRadius:'50%',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',animation:'spin 1s linear infinite'}}/>
               Dispatching...
             </>
           ) : (
             <>
               <Mail size={16} />
               Email My Usage Report
             </>
           )}
         </button>
      </SectionCard>
    </div>
  );
}

function PrivacyTab({ userId, email }: { userId: string, email: string }) {
  const router = useRouter();
  const { workspaces } = useWorkspaceStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const handleExportConversations = async () => {
    if (workspaces.length === 0) {
      alert("No active workspaces found to generate archives from.");
      return;
    }
    setExporting(true);
    try {
      const csvRows = [
        ['Workspace', 'Conversation ID', 'Source Type', 'Created At', 'Role', 'Content', 'Prompt Tokens', 'Completion Tokens', 'Latency (ms)']
      ];

      for (const ws of workspaces) {
        const convos = await fetchConversations(ws.name);
        for (const convo of convos) {
          const msgs = await fetchConversationMessages(convo.conversation_id);
          for (const msg of msgs) {
            // Clean content to escape double quotes and linebreaks
            const cleanContent = `"${msg.content.replace(/"/g, '""')}"`;
            csvRows.push([
              ws.name,
              convo.conversation_id,
              convo.source_type,
              new Date(convo.created_at).toLocaleString(),
              msg.role,
              cleanContent,
              (msg.prompt_tokens ?? 0).toString(),
              (msg.completion_tokens ?? 0).toString(),
              (msg.latency_ms ?? 0).toString()
            ]);
          }
        }
      }

      if (csvRows.length === 1) {
        alert("No conversation records found to export.");
        return;
      }

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + csvRows.map(row => row.join(',')).join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `conversation_archive_${userId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(err);
      alert("An error occurred during archive compilation: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // 2FA deletion authorization states
  const [twoFaEnabled, setTwoFaEnabled]   = useState(false);
  const [twoFaChecking, setTwoFaChecking] = useState(true);
  const [showOtpModal, setShowOtpModal]   = useState(false);
  const [otpInput, setOtpInput]           = useState('');
  const [verifyingOtp, setVerifyingOtp]   = useState(false);
  const [otpError, setOtpError]           = useState('');
  const [resendTimer, setResendTimer]     = useState(0);

  useEffect(() => {
    api.get(`/auth/2fa/status/${userId}`, { skipAuthRedirect: true })
      .then(res => setTwoFaEnabled(res.data.two_fa_enabled ?? false))
      .catch(() => setTwoFaEnabled(false))
      .finally(() => setTwoFaChecking(false));
  }, [userId]);

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const initiateDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setError('');
    
    if (twoFaEnabled) {
      setDeleting(true);
      try {
        await resendOTP(userId, email);
        setShowOtpModal(true);
        setResendTimer(30);
      } catch (err: any) {
        setError(extractErrorMessage(err, 'Failed to send verification code.'));
      } finally {
        setDeleting(false);
      }
    } else {
      executeDeletion();
    }
  };

  const handleOtpConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.length !== 4) return;
    setVerifyingOtp(true); setOtpError('');
    try {
      // Step 1: Verify OTP to authorize the current high-security session in Redis
      await verifyOTP(userId, otpInput);
      // Step 2: Execute actual deletion
      await executeDeletion();
    } catch (err: any) {
      setOtpError(extractErrorMessage(err, 'Verification failed. Invalid code.'));
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setOtpError('');
    try {
      await resendOTP(userId, email);
      setResendTimer(30);
    } catch (err: any) {
      setOtpError(extractErrorMessage(err, 'Failed to resend code.'));
    }
  };

  const executeDeletion = async () => {
    setDeleting(true); setError('');
    try {
      await deleteUserAccount(userId);
      clearSession();
      useUserStore.getState().clear();
      router.push('/');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to destruct account.'));
      setDeleting(false);
      setShowOtpModal(false);
    }
  };

  return (
    <div>
      <SectionCard title="Data Sovereignty" desc="Extract your conversational history arrays out of the database servers into generic CSV mappings.">
         <button 
           onClick={handleExportConversations} 
           disabled={exporting}
           style={{ 
             padding: '12px 24px', 
             background: THEME.bgCard, 
             border: `1px solid ${THEME.border}`, 
             borderRadius: '10px', 
             color: '#fff', 
             fontSize: '14px', 
             display: 'flex', 
             gap: '10px', 
             alignItems: 'center', 
             cursor: exporting ? 'wait' : 'pointer',
             opacity: exporting ? 0.7 : 1
           }}
         >
            {exporting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
            {exporting ? 'Compiling Archive...' : 'Request Archive Generation'}
         </button>
      </SectionCard>

      <SectionCard danger title="Terminate Account Protocols" desc="This operation permanently obliterates your underlying ID, namespaces, files, tokens, and API records. Unrecoverable.">
        {error && <Banner type="error" onDismiss={() => setError('')}>{error}</Banner>}
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} disabled={twoFaChecking} style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: THEME.danger, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Initiate Deletion Sequence
          </button>
        ) : (
          <div style={{ padding: '20px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px' }}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '16px' }}>Type <strong style={{ color: THEME.danger }}>DELETE</strong> to confirm termination of <strong style={{ color: '#fff' }}>{email}</strong>.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())} placeholder="DELETE" disabled={deleting} style={{ padding: '10px 14px', background: 'transparent', border: `1px solid ${THEME.danger}`, borderRadius: '8px', color: '#fff', width: '140px', outline: 'none' }} />
              <button onClick={initiateDelete} disabled={confirmText !== 'DELETE' || deleting} style={{ padding: '10px 24px', background: confirmText === 'DELETE' ? THEME.danger : 'rgba(239,68,68,0.2)', cursor: confirmText === 'DELETE' ? 'pointer' : 'not-allowed', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600 }}>{deleting ? 'Processing...' : 'Verify'}</button>
              <button onClick={() => setShowConfirm(false)} style={{ padding: '10px 24px', background: 'transparent', border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>Abort Action</button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 2FA confirmation modal for account deletion */}
      {showOtpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '400px', background: '#13131a', border: `1px solid ${THEME.border}`, borderRadius: '20px', padding: '32px', animation: 'modalSlideUp 0.3s ease-out forwards' }}>
            <h2 style={{ fontSize: '20px', color: '#fff', fontWeight: 700, marginBottom: '8px' }}>
              Confirm Deletion with 2FA
            </h2>
            <p style={{ fontSize: '14px', color: THEME.textMuted, marginBottom: '24px', lineHeight: 1.5 }}>
              Two-factor authentication is active on your account. Please enter the 4-digit code sent to your email to authorize account deletion.
            </p>
            {otpError && (
              <div style={{ padding: '10px 14px', marginBottom: '16px', background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '13px', color: THEME.danger }}>
                {otpError}
              </div>
            )}
            <form onSubmit={handleOtpConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Verification Code</label>
                <input
                  type="text" required autoFocus maxLength={4}
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={verifyingOtp}
                  placeholder="0000"
                  style={{ width: '100%', padding: '12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: '#fff', fontSize: '20px', letterSpacing: '8px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', opacity: verifyingOtp ? 0.6 : 1 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button type="button" onClick={handleResendOtp} disabled={resendTimer > 0 || verifyingOtp} style={{ background: 'transparent', border: 'none', color: resendTimer > 0 ? THEME.textMuted : THEME.primary, fontSize: '13px', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer' }}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => { setShowOtpModal(false); setOtpInput(''); setOtpError(''); }} disabled={verifyingOtp} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${THEME.border}`, borderRadius: '8px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={otpInput.length !== 4 || verifyingOtp} style={{ padding: '10px 24px', background: THEME.danger, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: otpInput.length === 4 && !verifyingOtp ? 'pointer' : 'not-allowed', opacity: otpInput.length === 4 && !verifyingOtp ? 1 : 0.5 }}>
                    {verifyingOtp ? 'Verifying…' : 'Delete Account'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Layout Assembly ──────────────────────────────────────────────────────

type TabKey = 'security' | 'workspaces' | 'billing' | 'notification' | 'privacy';

export default function SettingsPage() {
  const { user, ready } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('security');

  if (!ready || !user) {
    return <div style={{ padding: '40px', color: THEME.textMuted }}>Resolving session constraints...</div>;
  }

  const TABS = [
    { key: 'security', label: 'Security & Access', icon: Shield },
    { key: 'workspaces', label: 'Workspace Target', icon: LayoutGrid },
    { key: 'billing', label: 'Billing & Quota', icon: CreditCard },
    { key: 'notification', label: 'Events & Alerts', icon: Bell },
    { key: 'privacy', label: 'Data & Privacy', icon: Lock },
  ] as const;

  return (
    <div style={{ maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Control Center</h1>
        <p style={{ fontSize: '14px', color: THEME.textMuted }}>Manage architectural boundaries, authentication vectors, and environmental preferences.</p>
      </div>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
         {/* Vertical Sidebar Navigation */}
         <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
            {TABS.map(tab => {
               const active = activeTab === tab.key;
               const Icon = tab.icon;
               return (
                 <button
                   key={tab.key}
                   onClick={() => setActiveTab(tab.key)}
                   style={{
                     display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                     background: active ? 'rgba(124,109,240,0.1)' : 'transparent',
                     border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                     color: active ? THEME.primary : 'rgba(255,255,255,0.6)',
                     fontWeight: active ? 600 : 500, fontSize: '14px', transition: 'all 0.2s'
                   }}
                   onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                   onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                 >
                   <Icon size={16} />
                   {tab.label}
                 </button>
               );
            })}
         </div>

         {/* Content Renderer Array */}
         <div style={{ flex: 1, minWidth: 0 }}>
            {activeTab === 'security' && <SecurityTab userId={user.user_id} />}
            {activeTab === 'workspaces' && <WorkspaceTab />}
            {activeTab === 'billing' && <SubscriptionTab userId={user.user_id} />}
            {activeTab === 'notification' && <NotificationsTab userId={user.user_id} email={user.email || ''} />}
            {activeTab === 'privacy' && <PrivacyTab userId={user.user_id} email={user.email || 'User'} />}
         </div>
      </div>
      
    </div>
  );
}
