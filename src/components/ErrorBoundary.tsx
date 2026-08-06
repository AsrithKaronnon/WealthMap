import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logErrorToSupabase } from '../lib/logger';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
    logErrorToSupabase(error, {
      componentStack: errorInfo.componentStack || '',
      notes: 'Global Error Boundary Catch'
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full border border-destructive/20 bg-destructive/5 rounded-2xl p-6 text-center space-y-4 shadow-xl backdrop-blur-md">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-base font-bold text-foreground">Something went wrong</h1>
              <p className="text-xs text-muted-foreground">
                The application encountered an unexpected crash. The issue has been automatically logged.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-background/80 border border-border/80 rounded-xl p-3 text-[10px] text-left font-mono text-destructive max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <Button onClick={this.handleReload} size="sm" className="w-full flex items-center justify-center gap-1.5 cursor-pointer">
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
