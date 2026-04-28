import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      let errorMessage = this.state.error?.message || "Unknown error";
      let errorTitle = "Something went wrong";
      let isFirestoreError = false;

      try {
        if (errorMessage.startsWith('{')) {
          const parsed = JSON.parse(errorMessage);
          if (parsed.operationType) {
            isFirestoreError = true;
            errorTitle = "Database Limit Reached";
            errorMessage = `Firestore Quota Exceeded or Permission Denied. 
Operation: ${parsed.operationType}
Path: ${parsed.path || 'unknown'}
Error: ${parsed.error}`;
          }
        }
      } catch (e) {
        // Not JSON, use raw message
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-background text-foreground transition-colors">
          <div className="max-w-md w-full p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl transition-colors">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{errorTitle}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">The application encountered an unexpected error.</p>
            
            <div className="text-left font-mono text-xs p-4 rounded-lg bg-slate-950 text-slate-100 overflow-auto max-h-[160px] mb-6">
              {errorMessage}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
