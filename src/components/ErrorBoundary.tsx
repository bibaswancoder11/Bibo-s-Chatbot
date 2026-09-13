import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Cpu } from 'lucide-react';
import { safeStorage } from '../utils/safeStorage';

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
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    safeStorage.clear();
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h1 className="text-lg font-bold text-zinc-900">Local AI Studio Recovery</h1>
              <p className="text-xs text-zinc-500">
                An error occurred while initializing local device components.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-zinc-100 p-3 rounded-xl font-mono text-[11px] text-zinc-700 max-h-32 overflow-y-auto break-words">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full py-2.5 px-4 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                <Cpu className="w-4 h-4" />
                <span>Try In-Browser Pure Local Engine</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-2 px-4 bg-zinc-100 text-zinc-700 text-xs font-medium rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Clear Cache & Reload App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
