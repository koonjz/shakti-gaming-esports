'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  addDoc,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { isAdmin } from '@/lib/adminConfig';
import {
  Trophy,
  Gamepad2,
  Layers,
  DollarSign,
  ArrowLeft,
  Loader,
  AlertCircle,
  Calendar,
  Clock,
  ShieldOff,
} from 'lucide-react';
import Link from 'next/link';

export default function CreateTournamentClient() {
  const user    = useAppStore((state) => state.user);
  const loading = useAppStore((state) => state.loading);
  const router  = useRouter();

  // Helper to format ISO datetime-local string (default 1 hour from now)
  const getDefaultStartDateStr = () => {
    const d = new Date(Date.now() + 3600000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  // Form states
  const [name,              setName]              = useState('');
  const [game,              setGame]              = useState('Valorant');
  const [entryType,         setEntryType]         = useState<'Free' | 'Paid'>('Free');
  const [maxTeams,          setMaxTeams]          = useState<number>(4);
  const [startDateStr,      setStartDateStr]      = useState<string>(getDefaultStartDateStr());
  const [roundDurationMins, setRoundDurationMins] = useState<number>(45);
  const [minRiotScore,      setMinRiotScore]      = useState<number>(0);

  const [actionLoading, setActionLoading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [shake,         setShake]         = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  // ── Auth guard: redirect unauthenticated users ──────────────────
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ── Admin guard: redirect non-admins once auth is resolved ──────
  const userIsAdmin = !loading && !!user && isAdmin(user.email);

  if (!loading && user && !userIsAdmin) {
    return (
      <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '7.5rem 1.5rem 4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />
        <div className="glass-panel" style={{ maxWidth: 480, width: '100%', padding: '2.5rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <ShieldOff size={48} style={{ color: 'var(--accent-red)', marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Admin Access Required</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
            Only platform admins can create tournaments.
            If you believe this is an error, contact your administrator.
          </p>
          <Link href="/tournaments">
            <button className="btn btn-primary" style={{ borderRadius: '9999px', padding: '0.75rem 2rem' }}>
              Back to Tournaments
            </button>
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader className="animate-spin" size={40} style={{ color: 'var(--accent-cyan)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Verifying admin session...</p>
      </div>
    );
  }

  // Calculate estimated end time dynamically
  const rounds = Math.max(1, Math.ceil(Math.log2(maxTeams)));
  const effectiveRoundMins = Math.max(45, Number(roundDurationMins) || 45);
  const totalDurationMins = rounds * effectiveRoundMins;

  // ── Form submission ─────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Tournament name is required.');
      triggerShake();
      return;
    }

    if (!startDateStr) {
      setError('Please select a tournament start date & time.');
      triggerShake();
      return;
    }

    const startTimestampNum = new Date(startDateStr).getTime();
    if (isNaN(startTimestampNum)) {
      setError('Invalid start date format.');
      triggerShake();
      return;
    }

    if (startTimestampNum <= Date.now()) {
      setError('Start time must be in the future.');
      triggerShake();
      return;
    }

    if (!Number.isInteger(maxTeams) || maxTeams < 2 || maxTeams > 64) {
      setError('Bracket size must be between 2 and 64 teams.');
      triggerShake();
      return;
    }

    if (effectiveRoundMins < 45) {
      setError('Each round must be allocated AT LEAST 45 minutes.');
      triggerShake();
      return;
    }

    const estimatedEndTime = startTimestampNum + totalDurationMins * 60 * 1000;

    setActionLoading(true);

    try {
      // ── 1. Create the tournament document ────────────────────────
      const startTimestampObj = Timestamp.fromDate(new Date(startDateStr));
      const tournamentRef = await addDoc(collection(db, 'tournaments'), {
        name:              name.trim(),
        game,
        entryType,
        maxTeams:          Number(maxTeams),
        startTime:         startTimestampObj,
        startDate:         startTimestampNum,
        roundDurationMins: effectiveRoundMins,
        estimatedEndTime:  estimatedEndTime,
        status:            'Upcoming',
        organizerId:       user!.uid,
        registeredTeamIds: [],
        minRiotScore:      Number(minRiotScore) || 0,
        createdAt:         serverTimestamp(),
      });

      // ── 2. Broadcast new_tournament notification to ALL users ───
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      const uids = profilesSnap.docs.map((d) => d.id);

      const formattedDate = new Date(startDateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      const notifMessage = `New tournament: ${name.trim()} (${game}) — starts ${formattedDate}`;

      // Chunk into batches of 500 (Firestore limit)
      const BATCH_LIMIT = 500;
      for (let i = 0; i < uids.length; i += BATCH_LIMIT) {
        const chunk = uids.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((uid) => {
          const notifRef = doc(
            collection(db, 'profiles', uid, 'notifications')
          );
          batch.set(notifRef, {
            type:      'new_tournament',
            message:   notifMessage,
            relatedId: tournamentRef.id,
            read:      false,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      router.push('/tournaments');
    } catch (err: any) {
      console.error('Error creating tournament:', err);
      if (err?.code === 'permission-denied') {
        setError('Permission denied. Only admins can create tournaments. If you are an admin, ensure your email is registered in firestore.rules.');
      } else {
        setError(err.message || 'Failed to host tournament.');
      }
      triggerShake();
    } finally {
      setActionLoading(false);
    }
  };

  const uniqueGames = [
    'Valorant', 'League of Legends', 'CS:GO', 'Apex Legends',
    'Rocket League', 'Overwatch 2', 'Fortnite', 'PUBG',
  ];

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '7.5rem 1.5rem 4rem 1.5rem' }}>
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

        {/* Error banner */}
        <div aria-live="assertive">
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: 'hsla(350, 85%, 55%, 0.12)',
              border: '1px solid var(--accent-red)',
              borderRadius: '8px', padding: '0.75rem 1rem',
              marginBottom: '1.5rem', color: 'var(--accent-red)', fontSize: '0.9rem'
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
                required
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

          {/* Start Date & Time */}
          <div className="form-group">
            <label htmlFor="create-tourney-startdate" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} style={{ color: 'var(--accent-cyan)' }} />
              Tournament Start Schedule
            </label>
            <input
              id="create-tourney-startdate"
              type="datetime-local"
              className="glass-input"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              disabled={actionLoading}
              required
            />
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
                <option value={32}>32 Rosters (5 Rounds)</option>
                <option value={64}>64 Rosters (6 Rounds)</option>
              </select>
            </div>

            {/* Round Duration */}
            <div className="form-group">
              <label htmlFor="create-tourney-roundmins" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} style={{ color: 'var(--accent-cyan)' }} />
                Round Allocation (mins)
              </label>
              <input
                id="create-tourney-roundmins"
                type="number"
                min={45}
                className="glass-input"
                value={roundDurationMins}
                onChange={(e) => setRoundDurationMins(Math.max(45, Number(e.target.value)))}
                disabled={actionLoading}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                Min 45 mins per round
              </span>
            </div>

          </div>

          {/* Access Type */}
          <div className="form-group">
            <label htmlFor="create-tourney-entrytype" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <DollarSign size={16} style={{ color: 'var(--accent-gold)' }} />
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

          {/* Minimum Riot Score (Admin only) */}
          <div className="form-group">
            <label htmlFor="create-tourney-minriot" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={16} style={{ color: 'var(--accent-gold)' }} />
              Minimum Riot Score Requirement
            </label>
            <div className="input-glow-wrapper">
              <input
                id="create-tourney-minriot"
                type="number"
                min={0}
                step={100}
                className="glass-input"
                value={minRiotScore}
                onChange={(e) => setMinRiotScore(Math.max(0, Number(e.target.value)))}
                disabled={actionLoading}
                placeholder="0"
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block', lineHeight: 1.4 }}>
              Teams with an average Riot Score below this threshold cannot register. Set to <strong>0</strong> for no restriction.
              <br />
              <span style={{ color: 'var(--accent-gold)' }}>Typical scores: Unranked ~1,000 · Silver ~1,200 · Platinum ~1,600 · Diamond ~2,000+</span>
            </span>
          </div>

          {/* Schedule Summary Preview */}
          <div style={{
            background: 'hsla(185, 85%, 50%, 0.05)',
            border: '1px solid hsla(185, 85%, 50%, 0.2)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.3rem' }}>
              Est. Schedule Summary:
            </div>
            <div>Total Rounds: <strong>{rounds} rounds</strong></div>
            <div>Time per round: <strong>{effectiveRoundMins} mins</strong> (Rule: min 45m)</div>
            <div>Est. Total Duration: <strong>{totalDurationMins} minutes ({Math.floor(totalDurationMins / 60)}h {totalDurationMins % 60}m)</strong></div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="create-tourney-submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', height: '3rem' }}
            disabled={actionLoading}
          >
            {actionLoading ? 'Launching Tournament...' : 'Launch Tournament'}
          </button>
        </form>

      </div>
    </main>
  );
}
