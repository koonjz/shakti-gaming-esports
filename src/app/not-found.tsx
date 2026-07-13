import Link from 'next/link';
import { AlertTriangle, Home } from 'lucide-react';

export default function NotFound() {
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
        maxWidth: '500px',
        padding: '3rem 2rem',
        textAlign: 'center',
        zIndex: 1,
        border: '1px solid hsla(186, 100%, 48%, 0.15)',
        boxShadow: '0 0 30px hsla(186, 100%, 48%, 0.05)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'hsla(350, 85%, 55%, 0.1)',
          border: '2px solid var(--accent-red)',
          color: 'var(--accent-red)',
          marginBottom: '1.5rem',
          boxShadow: '0 0 20px hsla(350, 85%, 55%, 0.2)'
        }}>
          <AlertTriangle size={36} />
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          marginBottom: '0.75rem',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em'
        }}>
          404 - Area Not Found
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          lineHeight: '1.6',
          marginBottom: '2rem'
        }}>
          The page or sector you are looking for has either been decommissioned, relocated, or never existed in the database.
        </p>

        <Link href="/" className="btn btn-primary" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          justifyContent: 'center',
          margin: '0 auto',
          padding: '0.8rem 1.8rem',
          fontSize: '0.95rem'
        }}>
          <Home size={18} />
          Return Home
        </Link>
      </div>
    </main>
  );
}
