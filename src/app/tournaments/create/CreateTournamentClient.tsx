'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { Trophy, Gamepad2, Layers, DollarSign, ArrowLeft, Loader, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function CreateTournamentClient() {
  const user = useAppStore((state) => state.user);
  const loading = useAppStore((state) => state.loading);
  const router = useRouter();

  // Form states
  const [name, setName] = useState('');
  const [game, setGame] = useState('Valorant');
  const [entryType, setEntryType] = useState<'Free' | 'Paid'>('Free');
  const [maxTeams, setMaxTeams] = useState<number>(4);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Tournament name is required.");
      triggerShake();
      return;
    }

    setActionLoading(true);

    try {
      await addDoc(collection(db, "tournaments"), {
        name: name.trim(),
        game,
        entryType,
        maxTeams: Number(maxTeams),
        status: 'Upcoming',
        organizerId: user!.uid,
        registeredTeamIds: [],
        bracket: {
          matches: []
        },
        createdAt: Date.now()
      });

      router.push('/tournaments');
    } catch (err: any) {
      console.error("Error creating tournament:", err);
      setError(err.message || "Failed to host tournament.");
      triggerShake();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader className="animate-spin text-cyan" size={40} style={{ color: 'var(--accent-cyan)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Verifying organizer session...</p>
      </div>
    );
  }

  const uniqueGames = ["Valorant", "League of Legends", "CS:GO", "Apex Legends", "Rocket League", "Overwatch 2"];

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="container" style={{ maxWidth: '600px', position: 'relative', zIndex: 1 }}>
        
        {/* Back Link */}
        <Link href="/tournaments" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }} className="hover-cyan">
          <ArrowLeft size={16} /> Back to Tournaments
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <Trophy size={28} style={{ color: 'var(--accent-cyan)' }} />
          <h1 style={{ fontSize: '1.75rem' }}>Host Tournament</h1>
        </div>

        {/* Assertive live region for validation error announcer */}
        <div aria-live="assertive">
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'hsla(350, 85%, 55%, 0.12)',
              border: '1px solid var(--accent-red)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              color: 'var(--accent-red)',
              fontSize: '0.9rem'
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Creation Form */}
        <form onSubmit={handleCreate} className={`glass-panel ${shake ? 'shake' : ''}`} style={{ padding: '2.5rem' }}>
          {/* Name */}
          <div className="form-group">
            <label htmlFor="create-tourney-name" className="form-label">Tournament Name</label>
            <div className="input-glow-wrapper">
              <Trophy size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
              <input
                id="create-tourney-name"
                type="text"
                className="glass-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="e.g. Winter Valorant Clash"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={actionLoading}
              />
            </div>
          </div>

          {/* Game */}
          <div className="form-group">
            <label htmlFor="create-tourney-game" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Gamepad2 size={16} style={{ color: 'var(--accent-cyan)' }} />
              Select Game
            </label>
            <select
              id="create-tourney-game"
              className="glass-input glass-select"
              value={game}
              onChange={(e) => setGame(e.target.value)}
              disabled={actionLoading}
            >
              {uniqueGames.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Bracket size & Entry type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="grid-2-col">
            
            {/* Max Teams */}
            <div className="form-group">
              <label htmlFor="create-tourney-maxteams" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={16} style={{ color: 'var(--accent-violet)' }} />
                Bracket Size
              </label>
              <select
                id="create-tourney-maxteams"
                className="glass-input glass-select"
                value={maxTeams}
                onChange={(e) => setMaxTeams(Number(e.target.value))}
                disabled={actionLoading}
              >
                <option value={4}>4 Rosters (2 Rounds)</option>
                <option value={8}>8 Rosters (3 Rounds)</option>
                <option value={16}>16 Rosters (4 Rounds)</option>
              </select>
            </div>

            {/* Entry Type */}
            <div className="form-group">
              <label htmlFor="create-tourney-entrytype" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <DollarSign size={16} style={{ color: 'var(--accent-cyan)' }} />
                Registration Access
              </label>
              <select
                id="create-tourney-entrytype"
                className="glass-input glass-select"
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as any)}
                disabled={actionLoading}
              >
                <option value="Free">Free to Join</option>
                <option value="Paid">Paid Entry (Ticket/Pass Required)</option>
              </select>
            </div>

          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem', height: '3rem' }}
            disabled={actionLoading}
          >
            {actionLoading ? 'Creating Tournament...' : 'Launch Tournament'}
          </button>
        </form>

      </div>
    </main>
  );
}
