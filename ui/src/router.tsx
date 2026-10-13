/**
 * router.tsx
 *
 * Hash router (createHashRouter): the page path never leaves index.html, so
 * no SPA fallback is needed on any server or proxy. Everything except
 * #/login requires a token (RequireAuth); unauthenticated users are bounced
 * to #/login and returned afterwards via location state.
 */
import { createHashRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WatchdogDetailPage } from './pages/WatchdogDetailPage';
import { WatchdogFormPage } from './pages/WatchdogFormPage';

function RequireAuth() {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    // Remember the intended destination (path + filter query) for post-login.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/watchdogs/new', element: <WatchdogFormPage mode="create" /> },
          { path: '/watchdogs/:id', element: <WatchdogDetailPage /> },
          { path: '/watchdogs/:id/edit', element: <WatchdogFormPage mode="edit" /> },
          { path: '/logs', element: <LogsPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/about', element: <AboutPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
