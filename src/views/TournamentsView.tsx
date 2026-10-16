'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { tournamentService, Tournament } from '@/services/tournamentService';
import { useAppStore } from '@/store/useAppStore';
import { isAdmin } from '@/lib/adminConfig';
import { Trophy, Search, Gamepad2, PlusCircle, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import GlassCard from '@/components/ui/GlassCard';
import { TournamentCountdown } from '@/components/TournamentCountdown';
import { getEffectiveTournamentStatus, autoCheckTournamentStatus, useEffectiveTournamentStatus } from '@/lib/tournamentUtils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const getStatusBadge = (status: Tournament['status']) => {
  switch (status) {
    case 'Upcoming':
      return (
        <Badge variant="cyan">
          Upcoming
          <span 
            style={{ 
              width: '7px', 
              height: '7px', 
              borderRadius: '50%', 
              backgroundColor: '#00ff88', 
              boxShadow: '0 0 6px #00ff88',
              display: 'inline-block',
              marginLeft: '0.35rem',
              verticalAlign: 'middle'
            }} 
            aria-hidden="true" 
          />
        </Badge>
      );
    case 'Active':
      return <Badge variant="live">Live</Badge>;
    case 'Completed':
      return <Badge variant="gold">Completed</Badge>;
    default:
      return <Badge variant="cyan">{status}</Badge>;
  }
};

function TournamentCardItem({ tournament }: { tournament: Tournament }) {
  const registeredCount = tournament.registeredTeamIds?.length || 0;
  const isFull = registeredCount >= tournament.maxTeams;
  const effectiveStatus = useEffectiveTournamentStatus(tournament);

  return (
    <GlassCard variant="card" hoverable={true} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        {getStatusBadge(effectiveStatus)}
        <Badge variant={tournament.entryType === 'Free' ? 'cyan' : 'gold'}>
          {tournament.entryType}
        </Badge>
      </div>

      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{tournament.name}</h3>
      <div style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
        <Gamepad2 size={16} /> {tournament.game}
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <TournamentCountdown tournament={tournament} compact={true} />
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          <span>Rosters</span>
          <strong style={{ color: isFull ? 'var(--accent-red)' : 'var(--text-primary)' }}>
            {registeredCount} / {tournament.maxTeams} {isFull && '(FULL)'}
          </strong>
        </div>

        <Link href={`/tournaments/${tournament.id}`}>
          <Button variant={effectiveStatus === 'Active' ? 'primary' : 'outline'} style={{ width: '100%', justifyContent: 'center' }}>
            {effectiveStatus === 'Active' ? 'Spectate Bracket' : effectiveStatus === 'Completed' ? 'View Results & Bracket' : 'View Tournament Details'}
          </Button>
        </Link>
      </div>
    </GlassCard>
  );
}

export default function TournamentsView() {
  const user    = useAppStore((state) => state.user);
  // UX-only guard: used to show/hide the Create Tournament button.
  // Real security enforcement is in firestore.rules → isAdminEmail().
  const userIsAdmin = !!user && isAdmin(user.email);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGame, setSelectedGame] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEntryType, setSelectedEntryType] = useState('All');

  useEffect(() => {
    const unsub = tournamentService.subscribeAllTournaments(
      (list) => {
        list.forEach(t => autoCheckTournamentStatus(t));
        setTournaments(list);
        setLoading(false);

        // Asynchronously sync any status changes (e.g. auto-ended or active) to Firestore
        list.forEach(async (t) => {
          const effStatus = getEffectiveTournamentStatus(t);
          if (effStatus !== t.status) {
            try {
              await updateDoc(doc(db, "tournaments", t.id), { status: effStatus });
            } catch (err) {
              console.error("Auto status sync failed for tournament:", t.id, err);
            }
          }
        });
      },
      () => setLoading(false)
    );

    return () => {
      unsub();
    };
  }, []);

  // Derive games list
  const uniqueGames = Array.from(new Set(tournaments.map(t => t.game).filter(Boolean)));

  // Filter tournaments
  const filteredTournaments = tournaments.filter(t => {
    const effectiveStatus = getEffectiveTournamentStatus(t);
    const matchesSearch = !searchTerm.trim() || 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.game.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGame = selectedGame === 'All' || t.game.toLowerCase() === selectedGame.toLowerCase();
    const matchesStatus = selectedStatus === 'All' || effectiveStatus === selectedStatus;
    const matchesEntry = selectedEntryType === 'All' || (t.entryType || 'Free') === selectedEntryType;

    return matchesSearch && matchesGame && matchesStatus && matchesEntry;
  });

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '7.5rem 1.5rem 4rem 1.5rem' }}>
      {/* Background Decorative Glows */}
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />
      
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Trophy size={32} style={{ color: 'var(--accent-cyan)' }} />
              <h1 style={{ fontSize: '2.25rem' }}>Tournaments Hub</h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              Browse, register, or host esports tournaments across all titles.
            </p>
          </div>

          {user && (
            <Link href="/tournaments/create">
              <Button variant="primary" style={{ borderRadius: '9999px', padding: '0.75rem 1.75rem' }}>
                <PlusCircle size={18} /> Host Tournament
              </Button>
            </Link>
          )}
        </div>

        {/* Filter Controls */}
        <GlassCard variant="panel" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search tournaments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.6rem',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Game Selector */}
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              <option value="All">All Games ({tournaments.length})</option>
              {uniqueGames.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Active">Live</option>
              <option value="Completed">Completed</option>
            </select>

            {/* Entry Fee Filter */}
            <select
              value={selectedEntryType}
              onChange={(e) => setSelectedEntryType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              <option value="All">All Entry Types</option>
              <option value="Free">Free Entry</option>
              <option value="Paid">Paid Entry</option>
            </select>

          </div>
        </GlassCard>

        {/* Tournament Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            Loading tournaments hub...
          </div>
        ) : filteredTournaments.length === 0 ? (
          <GlassCard style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Tournaments Found</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {searchTerm || selectedGame !== 'All' || selectedStatus !== 'All' || selectedEntryType !== 'All'
                ? 'Try adjusting your filters or search criteria.'
                : 'No tournaments have been scheduled yet. Be the first to create one!'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              {(searchTerm || selectedGame !== 'All' || selectedStatus !== 'All' || selectedEntryType !== 'All') && (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchTerm(''); setSelectedGame('All'); setSelectedStatus('All'); setSelectedEntryType('All'); }}
                >
                  Clear All Filters
                </Button>
              )}

              {user && (
                <Link href="/tournaments/create">
                  <Button variant="primary" style={{ borderRadius: '9999px', padding: '0.75rem 1.75rem' }}>
                    <PlusCircle size={16} /> Host First Tournament
                  </Button>
                </Link>
              )}
            </div>
          </GlassCard>
        ) : (
          <div className="grid-responsive">
            {filteredTournaments.map(tournament => (
              <TournamentCardItem key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
