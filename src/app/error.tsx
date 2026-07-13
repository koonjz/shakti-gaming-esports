'use client';

import { useEffect } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Unhandled dynamic runtime error:', error);
  }, [error]);

  return (
    <main style={{
      position: 'relative',
      minHeight: 'calc(100vh - 4.5rem)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Glows */}
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="glass-panel fade-in" style={{
        position: 'relative',
        width: '100%',
        maxWidth: '520px',
        padding: '3rem 2.5rem',
        textAlign: 'center',
        zIndex: 1,
        border: '1px solid hsla(280, 80%, 55%, 0.2)',
        boxShadow: '0 0 30px hsla(280, 80%, 55%, 0.05)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'hsla(280, 80%, 55%, 0.1)',
          border: '2px solid var(--accent-violet)',
          color: 'var(--accent-violet)',
          marginBottom: '1.5rem',
          boxShadow: '0 0 20px hsla(280, 80%, 55%, 0.2)'
        }}>
          <ShieldAlert size={36} />
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          marginBottom: '0.75rem',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em'
        }}>
          System Malfunction
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          lineHeight: '1.6',
          marginBottom: '1.5rem'
        }}>
          A critical system error occurred during execution. This could be due to a transient database synchronization drop or invalid route parameters.
        </p>

        {error.message && (
          <div style={{
            background: 'hsla(223, 20%, 6%, 0.6)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            marginBottom: '2rem',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: 'var(--accent-red)',
            overflowX: 'auto',
            maxHeight: '100px'
          }}>
            <strong>Diagnostic:</strong> {error.message}
          </div>
        )}

        <button 
          onClick={() => reset()}
          className="btn btn-primary" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center',
            margin: '0 auto',
            padding: '0.8rem 1.8rem',
            fontSize: '0.95rem',
            background: 'linear-gradient(135deg, var(--accent-violet) 0%, hsl(280, 80%, 55%) 100%)',
            boxShadow: 'var(--glow-violet)'
          }}
        >
          <RefreshCw size={18} />
          Reboot System (Retry)
        </button>
      </div>
    </main>
  );
}
