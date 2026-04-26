"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 错误边界组件
 * 捕获 React 组件树中的错误，防止整个应用崩溃
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <h3 className="mt-3 text-lg font-medium text-red-900 dark:text-red-100">
            出错了
          </h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300 text-center max-w-md">
            {this.state.error?.message || "组件加载失败"}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * API 错误展示组件
 */
export function ApiError({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <AlertCircle className="h-12 w-12 text-amber-500" />
      <h3 className="mt-3 text-lg font-medium">请求失败</h3>
      <p className="mt-1 text-sm text-[var(--muted)] text-center max-w-md">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 btn-secondary"
        >
          重试
        </button>
      )}
    </div>
  );
}
