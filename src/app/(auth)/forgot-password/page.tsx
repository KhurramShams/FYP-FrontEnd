'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { extractErrorMessage } from '@/lib/authService';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/auth/password_resetl', { email });
      setSuccess('If an account exists for this email, we have sent password reset instructions.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send password reset email.'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    color: '#fff', borderRadius: '8px', fontSize: '14px',
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box', opacity: loading ? 0.6 : 1,
  };

  return (
    <Card style={{ padding: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Reset password</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Enter your email to receive recovery instructions.</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '13px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '13px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: '8px' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px', fontWeight: 500 }}>Email Address</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com" disabled={loading} style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,109,240,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', padding: '13px', marginTop: '4px' }} disabled={loading}>
          {loading ? 'Sending instruction email…' : 'Send Instructions'}
        </Button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
        Remember your password?{' '}
        <Link href="/login" style={{ color: '#fff', fontWeight: 500 }}>Sign in</Link>
      </p>
    </Card>
  );
}
