import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SolanaWalletProvider } from './providers/SolanaWalletProvider';
import { WalletProvider } from './contexts/WalletContext';
import { WatchlistProvider } from './contexts/WatchlistContext';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries to reduce noise
    },
  },
});



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <SolanaWalletProvider>
            <WalletProvider>
              <WatchlistProvider>
                <App />
              </WatchlistProvider>
            </WalletProvider>
          </SolanaWalletProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
