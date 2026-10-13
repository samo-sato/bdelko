/**
 * hooks.ts
 *
 * React Query hooks for every endpoint the UI uses, plus query-key
 * conventions. Page-level queries pick up the auto-refresh interval from
 * Settings (useRefreshInterval); /health always polls every 30 s.
 * Mutations invalidate the affected keys and show a toast; the watchdog form
 * suppresses the error toast (toastOnError: false) to map server validation
 * errors onto form fields instead.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, toQueryString } from './client';
import { useRefreshInterval } from '../settings/SettingsContext';
import { useToast } from '../components/Toast';
import type {
  CreateWatchdogInput,
  Health,
  ListParams,
  LogItem,
  NotificationItem,
  Page,
  Stats,
  StatusResponse,
  UpdateWatchdogInput,
  Watchdog,
} from './types';

export const qk = {
  health: ['health'] as const,
  status: ['status'] as const,
  watchdogs: ['watchdogs'] as const,
  watchdog: (id: string) => ['watchdog', id] as const,
  stats: (id: string) => ['stats', id] as const,
  logs: (params: ListParams) => ['logs', params] as const,
  notifications: (params: ListParams) => ['notifications', params] as const,
};

// --- Queries ---------------------------------------------------------------

export function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => apiFetch<Health>('/health', { skipAuth: true }),
    refetchInterval: 30_000,
  });
}

export function useStatus() {
  const refresh = useRefreshInterval();
  return useQuery({
    queryKey: qk.status,
    queryFn: () => apiFetch<StatusResponse>('/status'),
    refetchInterval: refresh,
  });
}

export function useWatchdogs() {
  const refresh = useRefreshInterval();
  return useQuery({
    queryKey: qk.watchdogs,
    queryFn: () => apiFetch<Watchdog[]>('/watchdogs'),
    refetchInterval: refresh,
  });
}

export function useWatchdog(id: string | undefined) {
  const refresh = useRefreshInterval();
  return useQuery({
    queryKey: qk.watchdog(id ?? ''),
    queryFn: () => apiFetch<Watchdog>(`/watchdogs/${id}`),
    refetchInterval: refresh,
    enabled: id !== undefined,
  });
}

export function useStats(id: string) {
  const refresh = useRefreshInterval();
  return useQuery({
    queryKey: qk.stats(id),
    queryFn: () => apiFetch<Stats>(`/watchdogs/${id}/stats`),
    refetchInterval: refresh,
  });
}

export function useLogs(params: ListParams) {
  const refresh = useRefreshInterval();
  return useQuery({
    queryKey: qk.logs(params),
    queryFn: () => apiFetch<Page<LogItem>>(`/logs${toQueryString({ ...params })}`),
    refetchInterval: refresh,
    placeholderData: keepPreviousData, // smooth pagination
  });
}

/** Logs of one watchdog (timeline + detail page). */
export function useWatchdogLogs(id: string, params: ListParams) {
  const refresh = useRefreshInterval();
  return useQuery({
    queryKey: qk.logs({ ...params, watchdog: id }),
    queryFn: () => apiFetch<Page<LogItem>>(`/watchdogs/${id}/logs${toQueryString({ ...params })}`),
    refetchInterval: refresh,
    placeholderData: keepPreviousData,
  });
}

export function useNotifications(params: ListParams) {
  const refresh = useRefreshInterval();
  return useQuery({
    queryKey: qk.notifications(params),
    queryFn: () => apiFetch<Page<NotificationItem>>(`/notifications${toQueryString({ ...params })}`),
    refetchInterval: refresh,
    placeholderData: keepPreviousData,
  });
}

// --- Mutations ---------------------------------------------------------------

function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof Error) return err.message;
  return 'Something went wrong';
}

export function useCreateWatchdog(options?: { toastOnError?: boolean }) {
  const qc = useQueryClient();
  const { push } = useToast();
  return useMutation({
    mutationFn: (input: CreateWatchdogInput) =>
      apiFetch<Watchdog>('/watchdogs', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (wd) => {
      push('success', `Watchdog "${wd.name}" created`);
      void qc.invalidateQueries({ queryKey: qk.watchdogs });
      void qc.invalidateQueries({ queryKey: qk.status });
    },
    onError: (err) => {
      if (options?.toastOnError !== false) push('error', errorMessage(err));
    },
  });
}

export function useUpdateWatchdog(id: string, options?: { toastOnError?: boolean; successMessage?: string }) {
  const qc = useQueryClient();
  const { push } = useToast();
  return useMutation({
    mutationFn: (patch: UpdateWatchdogInput) =>
      apiFetch<Watchdog>(`/watchdogs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: (wd) => {
      push('success', options?.successMessage ?? `Watchdog "${wd.name}" saved`);
      void qc.invalidateQueries({ queryKey: qk.watchdogs });
      void qc.invalidateQueries({ queryKey: qk.watchdog(id) });
      void qc.invalidateQueries({ queryKey: qk.status });
      void qc.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: (err) => {
      if (options?.toastOnError !== false) push('error', errorMessage(err));
    },
  });
}

export function useDeleteWatchdog() {
  const qc = useQueryClient();
  const { push } = useToast();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/watchdogs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      push('success', 'Watchdog deleted');
      void qc.invalidateQueries({ queryKey: qk.watchdogs });
      void qc.invalidateQueries({ queryKey: qk.status });
      void qc.invalidateQueries({ queryKey: ['logs'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => push('error', errorMessage(err)),
  });
}

/**
 * POST /api/mail/test. No toast on purpose: the Settings button shows the
 * result inline (including the server's error message on failure).
 */
export function useSendTestMail() {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/mail/test', { method: 'POST' }),
  });
}

export function useRegenerateSecret(id: string) {
  const qc = useQueryClient();
  const { push } = useToast();
  return useMutation({
    mutationFn: () => apiFetch<Watchdog>(`/watchdogs/${id}/regenerate-secret`, { method: 'POST' }),
    onSuccess: () => {
      push('success', 'New heartbeat secret generated');
      void qc.invalidateQueries({ queryKey: qk.watchdog(id) });
      void qc.invalidateQueries({ queryKey: qk.watchdogs });
      void qc.invalidateQueries({ queryKey: qk.status });
    },
    onError: (err) => push('error', errorMessage(err)),
  });
}
