import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>⚠️ Something went wrong</h1>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '18px', marginBottom: '10px' }}>
              Click to see error details
            </summary>
            <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '5px' }}>
              <h3>Error:</h3>
              <pre style={{ color: 'red' }}>{this.state.error && this.state.error.toString()}</pre>
              
              <h3 style={{ marginTop: '20px' }}>Stack Trace:</h3>
              <pre style={{ fontSize: '12px' }}>
                {this.state.error && this.state.error.stack}
              </pre>
              
              {this.state.errorInfo && (
                <>
                  <h3 style={{ marginTop: '20px' }}>Component Stack:</h3>
                  <pre style={{ fontSize: '12px' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </>
              )}
            </div>
          </details>
          
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

