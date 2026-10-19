import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from './app/AppShell';
import { ErrorBoundary } from './app/ErrorBoundary';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { requestPersistence } from './lib/platform';
import { syncManager } from './sync/manager';
import { ToastProvider } from './ui/Toast';

const StudyPage = lazy(() => import('./features/study/StudyPage'));
const LibraryPage = lazy(() => import('./features/library/LibraryPage'));
const ItemEditorPage = lazy(() => import('./features/editor/ItemEditorPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));

function Loading() {
  return <div className="p-8 text-center text-sm text-muted">Loading…</div>;
}

export function App() {
  useEffect(() => {
    syncManager.start();
    void requestPersistence();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/study" element={<StudyPage />} />
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/items/new" element={<ItemEditorPage />} />
                <Route path="/items/:id" element={<ItemEditorPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
