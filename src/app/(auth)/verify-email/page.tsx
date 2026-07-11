'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { verifyEmail, resendVerificationOTP, extractErrorMessage } from '@/lib/authService';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    const tempEmail = sessionStorage.getItem('temp_verify_email');
    if (!tempEmail) {
      router.replace('/login');
    } else {
      setEmail(tempEmail);
    }
  }, [router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await verifyEmail(email, otp);

      if (response.status === 'success') {
        setSuccess('Email verified successfully! Redirecting to login...');
        sessionStorage.removeItem('temp_verify_email');
        setTimeout(() => {
          router.replace('/login');
        }, 1800);
      } else {
        setError(response.message || 'Verification failed. Try again.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Invalid code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendTimer > 0) return;
    setError('');
    setSuccess('');
    try {
      await resendVerificationOTP(email);
      setSuccess('Verification code resent successfully.');
      setResendTimer(30);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to resend code.'));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    color: '#fff', borderRadius: '8px', fontSize: '24px',
    letterSpacing: '8px', textAlign: 'center',
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box', opacity: loading ? 0.6 : 1,
  };

  if (!email) return null; // Wait for initial check

  return (
    <Card style={{ padding: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Email Verification</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
          Enter the 4-digit code sent to <strong style={{ color: '#fff' }}>{email}</strong>.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '13px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '13px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: '8px' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px', fontWeight: 500 }}>Verification Code</label>
          <input type="text" maxLength={4} required value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0000" disabled={loading} style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,109,240,0.5)')}
            onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', padding: '13px', marginTop: '4px' }} disabled={loading}>
          {loading ? 'Verifying…' : 'Verify Code'}
        </Button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
         <Button
            variant="ghost"
            onClick={handleResend}
            disabled={resendTimer > 0 || loading}
            style={{ fontSize: '13px', color: resendTimer > 0 ? 'rgba(255,255,255,0.3)' : '#7c6df0' }}
         >
           {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}
         </Button>

         <Button 
            variant="ghost" 
            onClick={() => router.push('/login')} 
            disabled={loading}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}
          >
            Return to Login
         </Button>
      </div>
    </Card>
  );
}
