import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Card } from '../ui/components';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Passed as this component's `key` by callers that want it to auto-reset
  // when e.g. the route changes (see AppShell's <Outlet> wrapper below) —
  // React remounts (and re-mounts fresh state into) a class component
  // whenever its key changes, which is the standard way to recover an
  // error boundary without a full page reload.
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Error boundaries can only be class components — no hook equivalent exists
// (React docs). Catches render/lifecycle errors in whatever subtree it
// wraps and shows a fallback instead of leaving the whole app blank/crashed.
// Does NOT catch errors in event handlers, async code, or SSR — those still
// need their own try/catch (see e.g. liveApi.ts's request() wrapper).
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <Card>
          <Alert type="error" className="mb-4">
            Something went wrong. Your other sessions and data are safe.
          </Alert>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 break-words">{this.state.error.message}</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
