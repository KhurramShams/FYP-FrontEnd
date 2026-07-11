'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { registerUser, extractErrorMessage } from '@/lib/authService';
import { PublicRouteGuard } from '@/components/auth/PublicRouteGuard';

// ── Reusable styled input ─────────────────────────────────────────────────────
function Field({ label, name, type = 'text', required, placeholder, value, onChange, disabled }: {
  label: string; name: string; type?: string; required?: boolean;
  placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; disabled: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px', fontWeight: 500 }}>
        {label}{required && <span style={{ color: '#f87171', marginLeft: '3px' }}>*</span>}
      </label>
      <input
        type={type} name={name} required={required} value={value}
        onChange={onChange} placeholder={placeholder} disabled={disabled}
        style={{
          width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px',
          fontSize: '14px', outline: 'none', transition: 'border-color 0.2s',
          opacity: disabled ? 0.6 : 1, boxSizing: 'border-box',
        }}
        onFocus={e  => (e.target.style.borderColor = 'rgba(124,109,240,0.5)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
    </div>
  );
}

const getPasswordStrength = (password: string): number => {
  let score = 0;
  if (!password) return score;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  return score;
};

const getStrengthLabel = (score: number): string => {
  if (score <= 1) return 'Too Weak';
  if (score === 2) return 'Medium';
  if (score === 3) return 'Almost Strong';
  return 'Strong Password';
};

const isStrongPassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain both uppercase and lowercase letters.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one digit.' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (e.g. !, @, #, $, %, etc.).' };
  }
  return { valid: true, message: '' };
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', phone_number: '', company_name: '' });
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    // Client-side validation mirroring exact backend rules
    if (form.phone_number.length < 10) {
      setError('Phone number must be at least 10 digits long.'); return;
    }
    
    // Strong password check
    const strengthResult = isStrongPassword(form.password);
    if (!strengthResult.valid) {
      setError(strengthResult.message); return;
    }

    setLoading(true);
    try {
      const res = await registerUser({ ...form, role: 'user' });
      if (res.status === 'verification_required') {
        sessionStorage.setItem('temp_verify_email', form.email);
        setSuccess('Account created! Redirecting to email verification...');
        setTimeout(() => router.push('/verify-email'), 1500);
      } else {
        setSuccess('Account created! Redirecting to login…');
        setTimeout(() => router.push('/login'), 1800);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Registration failed. Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PublicRouteGuard />
      <Card style={{ padding: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Create an account</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Start building intelligent AI assistants today.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '13px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '13px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: '8px' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <Field label="Full Name"      name="username"     required placeholder="Sarah Ahmed"      value={form.username}     onChange={handleChange} disabled={loading} />
        <Field label="Email Address"  name="email"        required type="email" placeholder="you@company.com" value={form.email}      onChange={handleChange} disabled={loading} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Phone Number"  name="phone_number" required placeholder="+92 300 0000000" value={form.phone_number} onChange={handleChange} disabled={loading} />
          <Field label="Company"       name="company_name"           placeholder="Optional"          value={form.company_name} onChange={handleChange} disabled={loading} />
        </div>

        <div>
          <Field label="Password" name="password" required type="password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} disabled={loading} />
          {form.password && (
            <div style={{ marginTop: '8px', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Password Strength:</span>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 600,
                  color: getPasswordStrength(form.password) <= 1 ? '#ef4444' : getPasswordStrength(form.password) === 2 ? '#f97316' : getPasswordStrength(form.password) === 3 ? '#eab308' : '#22c55e'
                }}>
                  {getStrengthLabel(getPasswordStrength(form.password))}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '5px', height: '4px', marginBottom: '10px' }}>
                {[1, 2, 3, 4].map(level => {
                  const score = getPasswordStrength(form.password);
                  let color = 'rgba(255,255,255,0.06)';
                  if (score >= level) {
                    if (score <= 1) color = '#ef4444';
                    else if (score === 2) color = '#f97316';
                    else if (score === 3) color = '#eab308';
                    else color = '#22c55e';
                  }
                  return (
                    <div key={level} style={{ flex: 1, background: color, borderRadius: '2px', transition: 'background-color 0.2s' }} />
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                {[
                  { label: '8+ characters', met: form.password.length >= 8 },
                  { label: 'Upper & lowercase', met: /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) },
                  { label: 'At least one number', met: /[0-9]/.test(form.password) },
                  { label: 'At least one special char', met: /[!@#$%^&*(),.?":{}|<>]/.test(form.password) },
                ].map((req, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: req.met ? '#22c55e' : 'rgba(255,255,255,0.35)', transition: 'color 0.2s' }}>
                    <span style={{ fontSize: '10px' }}>{req.met ? '✓' : '○'}</span>
                    <span>{req.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', padding: '13px', marginTop: '6px' }} disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: '#fff', fontWeight: 500 }}>Sign in</Link>
      </p>
    </Card>
    </>
  );
}
