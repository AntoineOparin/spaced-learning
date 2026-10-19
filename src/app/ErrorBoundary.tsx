import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last-resort error screen. Data lives in IndexedDB, so reloading is always safe. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          Your data is stored safely on this device. Reloading usually fixes this.
        </p>
        <pre className="mt-4 overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-muted">
          {this.state.error.message}
        </pre>
        <button
          type="button"
          className="mt-6 h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
