import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

/**
 * ErrorBoundary — turns a render crash into a readable message instead of a
 * blank white page.
 *
 * Without a boundary anywhere in the tree, one thrown error unmounts the whole
 * app: React clears the root and the user is left staring at white, with the
 * only clue buried in the browser console. That is how a single missing prop
 * took down the entire admin dashboard (SantriArchiveDialog / categories).
 *
 * Boundaries only catch errors thrown while rendering, in lifecycle methods,
 * and in constructors below them. They do NOT catch errors inside event
 * handlers, timeouts, or rejected promises — those still need local try/catch.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the full stack in the console for developers; the UI stays readable
    // for everyone else.
    console.error('ErrorBoundary menangkap error saat render:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { title = 'Terjadi Kesalahan' } = this.props;

    return (
      <div className="flex justify-center items-center min-h-[60vh] px-4">
        <div
          role="alert"
          className="w-full max-w-lg bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-6 text-center"
        >
          <AlertTriangle className="h-10 w-10 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          <p className="mb-4 text-sm">
            Bagian ini gagal dimuat, tetapi data Anda aman. Coba muat ulang; bila
            tetap gagal, sampaikan pesan teknis di bawah kepada administrator.
          </p>

          <p className="text-xs font-mono break-words bg-destructive/10 rounded-lg p-3 mb-4 text-left">
            {error.message || String(error)}
          </p>

          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors text-sm font-medium"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Coba lagi
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Muat ulang halaman
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
