// Network interceptor to block WalletConnect external requests in development
export const setupNetworkInterceptor = () => {
  if (import.meta.env.DEV) {
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      
      // Block WalletConnect external API calls
      const blockedDomains = [
        'relay.walletconnect.com',
        'explorer-api.walletconnect.com',
        'registry.walletconnect.com',
        'verify.walletconnect.com'
      ];
      
      if (blockedDomains.some(domain => url.includes(domain))) {
        console.log(`🚫 Blocked WalletConnect request to: ${url}`);
        return new Response(JSON.stringify({ error: 'Blocked in development' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Ensure DEV requests use Vite proxy '/api' instead of hardcoded localhost:3001
      try {
        const parsed = new URL(url, window.location.origin);
        const isLocal3001 = (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.port === '3001';
        if (isLocal3001 && parsed.pathname.startsWith('/api')) {
          const rewritten = `/api${parsed.pathname.slice(4)}${parsed.search}`; // keep path after '/api'
          // console.debug(`🔁 Rewriting ${url} -> ${rewritten}`);
          return originalFetch(rewritten, init);
        }
      } catch {}

      return originalFetch(input, init);
    };

    // Intercept WebSocket connections
    const originalWebSocket = window.WebSocket;
    console.log('Intercepting WebSocket connections, original:', originalWebSocket.name);
    window.WebSocket = class extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const urlString = url.toString();
        
        // Block WalletConnect WebSocket connections
        if (urlString.includes('relay.walletconnect.com')) {
          console.log(`🚫 Blocked WalletConnect WebSocket to: ${urlString}`);
          super('ws://localhost:0'); // Invalid URL that will fail silently
          setTimeout(() => {
            this.dispatchEvent(new CloseEvent('close', { code: 1000, reason: 'Blocked in development' }));
          }, 0);
          return;
        }
        
        super(url, protocols);
      }
    };

    console.log('🛡️ Network interceptor enabled - WalletConnect requests blocked');
  }
};
