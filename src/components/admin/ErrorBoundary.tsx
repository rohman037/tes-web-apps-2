'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  panelName?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Error caught in panel "${this.props.panelName || 'Admin Panel'}":`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm space-y-4 my-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-950">
                Terjadi Kendala Memuat Panel {this.props.panelName ? `"${this.props.panelName}"` : 'Ini'}
              </h3>
              <p className="text-xs text-rose-700 font-mono bg-rose-100/60 p-2 rounded-lg max-w-xl break-all">
                {this.state.error?.message || 'Error tidak diketahui saat merender komponen.'}
              </p>
            </div>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Muat Ulang Panel</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
