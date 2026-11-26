import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Accessible React Error Boundary preventing unhandled UI exceptions from
 * blanking the screen or exposing internal stack traces to end users.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="bg-white border border-rose-300 rounded-xl p-6 max-w-xl mx-auto my-8 space-y-4"
        >
          <div className="flex items-center gap-2 text-rose-800 font-display font-bold text-lg">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Something went wrong while rendering this view</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            BreatheWise AI caught an unexpected display error. Your profile and air-quality settings remain intact.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload View</span>
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
