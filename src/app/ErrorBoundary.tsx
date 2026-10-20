import { Component, type ErrorInfo, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { buttonClass } from '../ui/Button';
import { surface } from '../ui/misc';

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
      <div className="mx-auto max-w-lg px-6 py-20">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-muted">
          Your data is stored safely on this device. Reloading usually fixes this.
        </p>
        <pre className={cn(surface, 'mt-6 overflow-auto p-4 font-mono text-xs text-muted')}>
          {this.state.error.message}
        </pre>
        <button
          type="button"
          className={buttonClass('primary', 'md', 'mt-8 px-6 text-base')}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
