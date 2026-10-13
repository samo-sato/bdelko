/**
 * main.tsx
 *
 * React root: QueryClientProvider (global React Query defaults) >
 * SettingsProvider (theme + display prefs) > AuthProvider (token, global 401)
 * > ToastProvider > hash Router.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { AppRouter } from './router';
import { SettingsProvider } from './settings/SettingsContext';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry by default, but never retry 401/404 (they won't heal).
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
      staleTime: 5_000,
      placeholderData: keepPreviousData,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
