'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: '#0a0a0f',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background radial glow for rich premium aesthetics */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'rgba(124, 109, 240, 0.07)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'absolute', top: '24px', left: '32px', zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
          <img
            src="/PluginAi-Logo.png"
            alt="Plugin AI"
            style={{ height: '36px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: '440px', zIndex: 10 }}>
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              fontSize: '80px',
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.1,
              background: 'linear-gradient(135deg, #7c6df0 0%, #a89ff5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-2px',
            }}>
              404
            </h1>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff',
              marginTop: '16px',
              marginBottom: '8px',
            }}>
              This page doesn't exist
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.5)',
              lineHeight: 1.6,
              margin: 0,
            }}>
              The requested address could not be found. Use the controls below to return to the active zones.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link href="/" passHref style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ width: '100%', padding: '13px' }}>
                Go to Home
              </Button>
            </Link>
            <Link href="/login" passHref style={{ textDecoration: 'none' }}>
              <Button variant="ghost" style={{ width: '100%', padding: '13px' }}>
                Go to Login
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
