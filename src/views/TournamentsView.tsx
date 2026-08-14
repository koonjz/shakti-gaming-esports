'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { tournamentService, Tournament } from '@/services/tournamentService';
import { useAppStore } from '@/store/useAppStore';
import { isAdmin } from '@/lib/adminConfig';
import { Trophy, Search, Gamepad2, PlusCircle, X, Zap, Clock, CheckCircle, Radio } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { TournamentCountdown } from '@/components/TournamentCountdown';
import { getEffectiveTournamentStatus, useEffectiveTournamentStatus } from '@/lib/tournamentUtils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── Game accent colors ─── */
const GAME_COLORS: Record<string, string> = {
  valorant:        'linear-gradient(90deg, #FF4655, #BD3744)',
  'league of legends': 'linear-gradient(90deg, #C89B3C, #785A28)',
  'cs:go':         'linear-gradient(90deg, #F4960B, #B36B00)',
  'apex legends':  'linear-gradient(90deg, #CD3333, #7D1F1F)',
  'rocket league': 'linear-gradient(90deg, #00A3FF, #0055AA)',
  'overwatch 2':   'linear-gradient(90deg, #F99E1A, #E67E22)',
};

const getGameAccent = (game: string) =>
  GAME_COLORS[game.toLowerCase()] ?? 'linear-gradient(90deg, var(--accent-cyan), var(--accent-violet))';

/* ─── Tournament Card ─── */
function TournamentCardItem({ tournament }: { tournament: Tournament }) {
  const registeredCount = tournament.registeredTeamIds?.length || 0;
  const isFull = registeredCount >= tournament.maxTeams;
  const effectiveStatus = useEffectiveTournamentStatus(tournament);
  const fillPct = Math.min(100, (registeredCount / Math.max(tournament.maxTeams, 1)) * 100);

  return (
    <article className="tournament-card-pro">
      {/* Game-colored top accent bar */}
      <div className="tournament-card-accent" style={{ background: getGameAccent(tournament.game) }} />

      <div className="tournament-card-body">
        {/* Header: status + entry type */}
        <div className="tournament-card-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {effectiveStatus === 'Active' && <Badge variant="live">Live</Badge>}
              {effectiveStatus === 'Upcoming' && (
                <Badge variant="cyan">
                  Upcoming
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-green)', boxShadow: '0 0 5px var(--accent-green)', display: 'inline-block', marginLeft: '0.3rem', verticalAlign: 'middle' }} />
                </Badge>
              )}
              {effectiveStatus === 'Completed' && <Badge variant="gold">Completed</Badge>}
              <Badge variant={tournament.entryType === 'Free' ? 'cyan' : 'gold'}>
                {tournament.entryType}
              </Badge>
            </div>

            <h3 className="tournament-card-title">{tournament.name}</h3>

            <div className="tournament-card-game">
              <Gamepad2 size={13} />
              {tournament.game}
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div style={{ marginBottom: '1rem' }}>
          <TournamentCountdown tournament={tournament} compact={true} />
        </div>

        {/* Slots with progress bar */}
        <div className="tournament-card-slots">
          <div className="slots-bar-track">
            <div
              className="slots-bar-fill"
              style={{
                width: `${fillPct}%`,
                background: isFull
                  ? 'linear-gradient(90deg, var(--accent-red), #CC0044)'
                  : getGameAccent(tournament.game),
              }}
            />
          </div>
          <span className="slots-text" style={{ color: isFull ? 'var(--accent-red)' : undefined }}>
            {registeredCount}/{tournament.maxTeams}{isFull ? ' FULL' : ''}
          </span>
        </div>
      </div>

      {/* CTA button */}
      <div className="tournament-card-cta">
        <Link href={`/tournaments/${tournament.id}`}>
          <Button variant={effectiveStatus === 'Active' ? 'primary' : 'outline'}>
            {effectiveStatus === 'Active'
              ? 'Spectate Bracket'
              : effectiveStatus === 'Completed'
              ? 'View Results & Bracket'
              : 'View Tournament Details'}
          </Button>
        </Link>
      </div>
    </article>
  );
}

/* ─── Filter Pill helpers ─── */
type PillVariant = 'default' | 'violet' | 'gold';

function FilterPill({
  label,
  active,
  onClick,
  variant = 'default',
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: PillVariant;
  icon?: React.ReactNode;
}) {
  const activeClass =
    variant === 'violet' ? 'active-violet' :
    variant === 'gold'   ? 'active-gold'   : 'active';

  return (
    <button
      className={`filter-pill${active ? ` ${activeClass}` : ''}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Main View ─── */
export default function TournamentsView() {
  const user = useAppStore((state) => state.user);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGame, setSelectedGame] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEntryType, setSelectedEntryType] = useState('All');

  useEffect(() => {
    const unsub = tournamentService.subscribeAllTournaments(
      (list) => { setTournaments(list); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const uniqueGames = Array.from(new Set(tournaments.map(t => t.game).filter(Boolean)));

  const filteredTournaments = tournaments.filter(t => {
    const effectiveStatus = getEffectiveTournamentStatus(t);
    const matchesSearch = !searchTerm.trim() ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.game.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGame   = selectedGame === 'All' || t.game.toLowerCase() === selectedGame.toLowerCase();
    const matchesStatus = selectedStatus === 'All' || effectiveStatus === selectedStatus;
    const matchesEntry  = selectedEntryType === 'All' || (t.entryType || 'Free') === selectedEntryType;
    return matchesSearch && matchesGame && matchesStatus && matchesEntry;
  });

  const activeCount   = tournaments.filter(t => getEffectiveTournamentStatus(t) === 'Active').length;
  const upcomingCount = tournaments.filter(t => getEffectiveTournamentStatus(t) === 'Upcoming').length;

  const hasFilters = searchTerm || selectedGame !== 'All' || selectedStatus !== 'All' || selectedEntryType !== 'All';

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', overflowX: 'hidden' }}>
      {/* Ambient glows */}
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      {/* ── Cinematic Page Header ── */}
      <div className="page-hero-header">
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div className="page-hero-eyebrow">
                Competitive Arenas
              </div>
              <h1 className="page-hero-title">
                TOURNAMENT<br />
                <span className="accent">HUB</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '0.95rem', maxWidth: '480px' }}>
                Browse, register, or host esports tournaments across all titles.
                {activeCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-red)', fontWeight: 700, marginLeft: '0.4rem' }}>
                    <span className="live-dot" />
                    {activeCount} live now
                  </span>
                )}
              </p>
            </div>

            {user && (
              <Link href="/tournaments/create">
                <Button variant="primary" style={{ borderRadius: '10px', padding: '0.8rem 1.75rem' }}>
                  <PlusCircle size={18} /> Host Tournament
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ position: 'relative', zIndex: 1, paddingBottom: '5rem' }}>

        {/* ── Filter Bar ── */}
        <div style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          {/* Row 1: Search + Host button */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-input-pro">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search tournaments or games..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                id="tournament-search"
              />
              {searchTerm && (
                <button className="clear-btn" onClick={() => setSearchTerm('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>

            {hasFilters && (
              <button
                className="filter-pill"
                onClick={() => { setSearchTerm(''); setSelectedGame('All'); setSelectedStatus('All'); setSelectedEntryType('All'); }}
                title="Clear all filters"
              >
                <X size={13} /> Clear filters
              </button>
            )}
          </div>

          {/* Row 2: Status pills */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Status</span>
            <div className="filter-divider" />
            <div className="filter-pill-group">
              <FilterPill label="All" active={selectedStatus === 'All'} onClick={() => setSelectedStatus('All')} />
              <FilterPill
                label={`Live${activeCount > 0 ? ` (${activeCount})` : ''}`}
                active={selectedStatus === 'Active'}
                onClick={() => setSelectedStatus('Active')}
                variant="default"
                icon={<Radio size={13} />}
              />
              <FilterPill
                label={`Upcoming${upcomingCount > 0 ? ` (${upcomingCount})` : ''}`}
                active={selectedStatus === 'Upcoming'}
                onClick={() => setSelectedStatus('Upcoming')}
                variant="default"
                icon={<Clock size={13} />}
              />
              <FilterPill
                label="Completed"
                active={selectedStatus === 'Completed'}
                onClick={() => setSelectedStatus('Completed')}
                variant="gold"
                icon={<CheckCircle size={13} />}
              />
            </div>

            <div className="filter-divider" style={{ marginLeft: '0.25rem' }} />

            <div className="filter-pill-group">
              <FilterPill label="Free" active={selectedEntryType === 'Free'} onClick={() => setSelectedEntryType(selectedEntryType === 'Free' ? 'All' : 'Free')} />
              <FilterPill label="Paid" active={selectedEntryType === 'Paid'} onClick={() => setSelectedEntryType(selectedEntryType === 'Paid' ? 'All' : 'Paid')} variant="gold" />
            </div>
          </div>

          {/* Row 3: Game pills */}
          {uniqueGames.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Game</span>
              <div className="filter-divider" />
              <div className="filter-pill-group">
                <FilterPill label="All Games" active={selectedGame === 'All'} onClick={() => setSelectedGame('All')} icon={<Gamepad2 size={13} />} />
                {uniqueGames.map(g => (
                  <FilterPill
                    key={g}
                    label={g}
                    active={selectedGame === g}
                    onClick={() => setSelectedGame(selectedGame === g ? 'All' : g)}
                    variant="violet"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Result count */}
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <Zap size={13} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {filteredTournaments.length} tournament{filteredTournaments.length !== 1 ? 's' : ''} found
                {hasFilters && <span style={{ color: 'var(--accent-cyan)', marginLeft: '0.3rem' }}>(filtered)</span>}
              </span>
            </div>
          )}
        </div>

        {/* ── Tournament Grid ── */}
        {loading ? (
          <div className="grid-responsive">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="tournament-card-pro" style={{ minHeight: '280px', overflow: 'hidden' }}>
                <div style={{ height: '3px', background: 'var(--bg-tertiary)' }} />
                <div className="tournament-card-body" style={{ gap: '0.75rem' }}>
                  <div className="skeleton-pulse skeleton-text" style={{ width: '35%', height: '22px', borderRadius: '9999px' }} />
                  <div className="skeleton-pulse skeleton-text" style={{ width: '80%', height: '20px' }} />
                  <div className="skeleton-pulse skeleton-text" style={{ width: '50%', height: '16px' }} />
                  <div className="skeleton-pulse skeleton-text" style={{ width: '100%', height: '40px', marginTop: '1rem' }} />
                </div>
                <div className="tournament-card-cta">
                  <div className="skeleton-pulse skeleton-button" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="empty-state-pro">
            <div className="empty-state-icon">
              <Trophy size={36} />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
              No Tournaments Found
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem', fontSize: '0.95rem' }}>
              {hasFilters
                ? 'Try adjusting your filters or clearing the search.'
                : 'No tournaments have been scheduled yet. Be the first to host one!'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {hasFilters && (
                <Button
                  variant="outline"
                  onClick={() => { setSearchTerm(''); setSelectedGame('All'); setSelectedStatus('All'); setSelectedEntryType('All'); }}
                >
                  <X size={16} /> Clear All Filters
                </Button>
              )}
              {user && (
                <Link href="/tournaments/create">
                  <Button variant="primary" style={{ borderRadius: '10px' }}>
                    <PlusCircle size={16} /> Host First Tournament
                  </Button>
                </Link>
              )}
            </div>
          </div>
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
