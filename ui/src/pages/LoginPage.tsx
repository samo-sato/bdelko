/**
 * LoginPage.tsx
 *
 * Token entry screen. Validates the token against /api/auth/check before
 * storing it: 401 -> "Invalid token", network failure -> "Cannot reach the
 * server". "Remember on this device" switches storage from sessionStorage to
 * localStorage. On success the user lands on the page they originally wanted.
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError, NetworkError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/Banner';
import { Footer } from '../components/Footer';
import { EyeIcon, EyeOffIcon, LogoIcon } from '../components/icons';
import { ThemeButton } from '../components/ThemeButton';

export function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(value.trim(), remember);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('Invalid token');
      else if (err instanceof NetworkError) setError('Cannot reach the server. Is bdelko running?');
      else if (err instanceof ApiError) setError(err.message);
      else setError('Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight">
              <LogoIcon className="h-7 w-7" />
              bdelko
            </h1>
            <ThemeButton />
          </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="api-token" className="mb-1 block text-sm font-medium">
              API token
            </label>
            <div className="relative">
              <input
                id="api-token"
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                placeholder="BDELKO_API_TOKEN"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-10 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide token' : 'Show token'}
                aria-pressed={show}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Remember on this device
          </label>
          {error && <Banner variant="error">{error}</Banner>}
          <button
            type="submit"
            disabled={busy || value.trim() === ''}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Checking...' : 'Log in'}
          </button>
        </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
