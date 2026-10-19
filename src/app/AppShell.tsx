import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { cn } from '../ui/cn';
import { Icon, type IconName } from '../ui/Icon';
import { PageSkeleton } from '../ui/misc';
import { InstallHint } from './InstallHint';
import { SyncIndicator } from './SyncIndicator';
import { UpdatePrompt } from './UpdatePrompt';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/library', label: 'Library', icon: 'library' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-xl text-lg font-extrabold">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span className="tracking-[-0.02em]">Spaced</span>
    </Link>
  );
}

export function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-bg focus:px-4 focus:py-2 focus:font-semibold focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Nav rail (≥ 768px): Notion's sidebar, with the current page marked in green. */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-bg-alt md:block">
        <div className="sticky top-0 flex h-dvh flex-col px-3 py-5">
          <div className="px-3">
            <Brand />
          </div>
          <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'group flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors',
                    isActive
                      ? 'bg-surface text-fg'
                      : 'text-muted hover:bg-surface/60 hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      name={n.icon}
                      size={22}
                      className={cn(
                        isActive ? 'text-accent-text' : 'text-dim group-hover:text-muted',
                      )}
                    />
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto">
            <SyncIndicator variant="rail" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Brand />
            <SyncIndicator />
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[940px] flex-1 px-4 pt-6 pb-32 sm:px-6 md:px-10 md:pt-12 md:pb-16"
        >
          <div className="mb-6 space-y-3 empty:hidden">
            <InstallHint />
            <UpdatePrompt />
          </div>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Bottom tab bar (< 768px) */}
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg md:hidden"
      >
        <div className="mx-auto flex max-w-md justify-around pt-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-semibold transition-[color,transform] duration-150 active:scale-95',
                  isActive ? 'text-accent-text' : 'text-muted',
                )
              }
            >
              <Icon name={n.icon} size={24} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
