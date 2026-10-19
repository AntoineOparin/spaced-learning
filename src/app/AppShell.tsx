import { NavLink, Outlet } from 'react-router';
import { cn } from '../ui/cn';
import { Icon, type IconName } from '../ui/Icon';
import { InstallHint } from './InstallHint';
import { SyncIndicator } from './SyncIndicator';
import { UpdatePrompt } from './UpdatePrompt';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/library', label: 'Library', icon: 'library' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-6" />
            <span>Spaced</span>
          </NavLink>
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:text-fg',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <SyncIndicator />
          </div>
        </div>
      </header>

      <InstallHint />
      <UpdatePrompt />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:pb-12">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur sm:hidden"
      >
        <div className="mx-auto flex max-w-md justify-around pt-1.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-20 flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px]',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              <Icon name={n.icon} size={22} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
