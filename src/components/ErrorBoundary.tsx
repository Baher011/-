import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'حدث خطأ أثناء تحميل البيانات. يرجى إعادة تحميل الصفحة.';
      if (this.state.errorMessage.includes('Quota exceeded')) {
        friendly = 'تم الوصول للحد اليومي المجاني لقاعدة البيانات، سيتجدد تلقائياً غداً.';
      } else if (this.state.errorMessage.includes('Missing or insufficient permissions')) {
        friendly = 'لا تملك صلاحية تنفيذ هذه العملية. تأكد من تسجيل الدخول بالحساب الصحيح.';
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F8F6] p-6" dir="rtl">
          <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-6 text-center space-y-4">
            <h1 className="text-lg font-bold text-[#111315]">تنبيه تقني</h1>
            <p className="text-sm text-zinc-600 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#111315] text-white text-sm font-semibold rounded-lg"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
