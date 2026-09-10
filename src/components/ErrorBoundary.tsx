import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  onNavigateDashboard?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled rendering exception:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          id="error-boundary-container"
          className="rounded-2xl border border-rose-200 bg-white p-6 sm:p-8 shadow-xs my-4"
        >
          <div className="flex items-start space-x-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">
                {this.props.fallbackTitle || 'Component Rendering Recovery'}
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {this.props.fallbackMessage ||
                  'An unexpected client-side rendering error occurred while loading this view. The application has prevented a complete crash so your session data remains intact.'}
              </p>

              {this.state.error && (
                <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50/60 px-3.5 py-2.5 text-xs text-rose-900 font-mono">
                  <span className="font-bold">Error: </span>
                  {this.state.error.message || 'Unknown runtime error'}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  id="error-boundary-retry-btn"
                  onClick={this.handleReset}
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </button>

                {this.props.onNavigateDashboard && (
                  <button
                    type="button"
                    id="error-boundary-dashboard-btn"
                    onClick={() => {
                      this.handleReset();
                      this.props.onNavigateDashboard?.();
                    }}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-slate-500" />
                    <span>Return to Dashboard</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="inline-flex items-center space-x-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors ml-auto py-1 px-2 cursor-pointer"
                >
                  <span>{this.state.showDetails ? 'Hide technical trace' : 'View technical trace'}</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {this.state.showDetails && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <pre className="max-h-56 overflow-auto rounded-lg bg-slate-900 p-3.5 text-[11px] font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {this.state.error?.stack || this.state.errorInfo?.componentStack || 'No stack trace available.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
