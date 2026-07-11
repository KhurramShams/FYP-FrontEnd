import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBannerProps {
  error: string;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export function ErrorBanner({ error, onDismiss, style }: ErrorBannerProps) {
  if (!error) return null;

  // Map raw backend errors to attractive, readable descriptions
  let title = 'Request Interrupted';
  let message = error;

  const errStr = error.toLowerCase();
  if (errStr.includes('404 not found') || errStr.includes('404: not found')) {
    title = 'Resource Not Found';
    message = 'The requested database record, folder, or endpoint could not be found. Please check your workspace configuration.';
  } else if (errStr.includes('403') || errStr.includes('suspended') || errStr.includes('access denied')) {
    title = 'Access Restricted / Suspended';
    message = 'Access to this workspace or resource has been suspended. Please check your active subscription plan.';
  } else if (errStr.includes('401') || errStr.includes('unauthorized') || errStr.includes('credentials')) {
    title = 'Session Expired';
    message = 'Your session has expired or is invalid. Please log in again to continue.';
  } else if (errStr.includes('422') || errStr.includes('validation error')) {
    title = 'Data Validation Failed';
    message = 'The fields provided to the server failed verification. Please double-check format restrictions.';
  } else if (errStr.includes('500') || errStr.includes('internal server error') || errStr.includes('503') || errStr.includes('network error')) {
    title = 'Server Error';
    message = 'The server encountered an error processing this request. If this persists, please contact support.';
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.03) 100%)',
      border: '1px solid rgba(239, 68, 68, 0.35)',
      boxShadow: '0 4px 16px rgba(239, 68, 68, 0.05)',
      borderRadius: '12px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '14px',
      marginBottom: '24px',
      color: '#fff',
      position: 'relative',
      ...style
    }}>
      <div style={{ color: '#ef4444', marginTop: '2px', display: 'flex', alignItems: 'center' }}>
        <AlertCircle size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#f87171' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
      {onDismiss && (
        <button 
          onClick={onDismiss} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'rgba(255,255,255,0.4)', 
            cursor: 'pointer', 
            fontSize: '18px',
            padding: '2px 6px',
            lineHeight: 1,
            alignSelf: 'center',
            transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          ×
        </button>
      )}
    </div>
  );
}
