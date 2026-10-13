/**
 * Layout.tsx - page shell for all authenticated routes.
 */
import { Outlet } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
