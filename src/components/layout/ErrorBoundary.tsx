import { Component, ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    // When an error happens in any child, we flip this flag
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // This logs the error in dev tools so you can still debug
    console.error("ErrorBoundary caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
          <div className="max-w-md text-center space-y-4 px-4">
            <h1 className="text-2xl font-semibold">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-400">
              Please refresh the page. If this keeps happening, contact your admin.
            </p>
          </div>
        </div>
      );
    }

    // If no error, just render the app normally
    return this.props.children;
  }
}
