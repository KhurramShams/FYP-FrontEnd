/**
 * paddleSetup.ts
 *
 * Singleton helper that loads Paddle.js v2 from CDN (client-side only),
 * sets sandbox mode, and initialises the SDK with our client token.
 *
 * Usage in a 'use client' component:
 *   import { initPaddle } from '@/lib/paddleSetup';
 *   useEffect(() => { initPaddle((event) => { ... }); }, []);
 */

declare global {
  interface Window {
    Paddle?: any;
  }
}

let scriptInjected = false;
let initialised = false;

/**
 * Dynamically inject paddle.js CDN script if not already present,
 * then initialise in sandbox mode with our client token.
 *
 * @param onEvent - Paddle eventCallback handler
 */
export function initPaddle(onEvent: (data: any) => void): void {
  if (typeof window === 'undefined') return; // SSR guard

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token || token === 'your_paddle_client_side_token_here') {
    console.warn(
      '[Paddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set. ' +
        'Fill it in .env.local and restart the dev server.'
    );
  }

  if (initialised && window.Paddle) {
    // Already set up — just swap the eventCallback reference
    // Paddle v2 doesn't expose a direct callback swap, so we re-init as a no-op
    return;
  }

  const doInit = () => {
    if (!window.Paddle || initialised) return;
    window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({
      token: token ?? '',
      eventCallback: onEvent,
    });
    initialised = true;
  };

  if (window.Paddle) {
    // Script was already loaded externally
    doInit();
    return;
  }

  if (scriptInjected) {
    // Script tag already in DOM — wait for it to finish loading
    return;
  }

  scriptInjected = true;
  const script = document.createElement('script');
  script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
  script.async = true;
  script.onload = doInit;
  script.onerror = () => {
    console.error('[Paddle] Failed to load paddle.js from CDN.');
    scriptInjected = false; // allow retry
  };
  document.head.appendChild(script);
}

/** Open Paddle Checkout with a server-created transaction ID */
export function openPaddleCheckout(transactionId: string): void {
  if (!window.Paddle) {
    console.error('[Paddle] SDK not initialised. Call initPaddle() first.');
    return;
  }
  window.Paddle.Checkout.open({ transactionId });
}
