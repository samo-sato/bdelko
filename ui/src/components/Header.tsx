/**
 * Header.tsx - app header: brand, primary nav, health chip, theme button and
 * the "New watchdog" primary action. Nav wraps on narrow screens.
 */
import { Link, NavLink } from 'react-router';
import { HealthChip } from './HealthChip';
import { ThemeButton } from './ThemeButton';
import { LogoIcon, PlusIcon } from './icons';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/logs', label: 'Logs', end: false },
  { to: '/notifications', label: 'Notifications', end: false },
  { to: '/settings', label: 'Settings', end: false },
  { to: '/about', label: 'About', end: false },
];

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50"
        >
          <LogoIcon className="h-6 w-6" />
          bdelko
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 text-sm font-medium ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <HealthChip />
          <ThemeButton />
          <Link
            to="/watchdogs/new"
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <PlusIcon className="h-4 w-4" />
            New watchdog
          </Link>
        </div>
      </div>
    </header>
  );
}
