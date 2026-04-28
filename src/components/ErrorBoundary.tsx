import * as React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
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

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px dashed #e5e7eb', margin: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Something went wrong</h2>
            <p style={{ color: '#4b5563', marginBottom: '16px' }}>The application encountered an unexpected error.</p>
            <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '16px', borderRadius: '8px', textAlign: 'left', fontSize: '12px', overflow: 'auto', maxHeight: '160px', marginBottom: '16px' }}>
              {this.state.error?.message}
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{ backgroundColor: '#4f46e5', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
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
