'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { Trophy, Search, Gamepad2, Shield, Loader, PlusCircle } from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  game: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  entryType: 'Free' | 'Paid';
  maxTeams: number;
  registeredTeamIds: string[];
  organizerId: string;
  createdAt: number;
}

export default function TournamentsClient() {
  const user = useAppStore((state) => state.user);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGame, setSelectedGame] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEntryType, setSelectedEntryType] = useState('All');

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "tournaments"));
      const list = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tournament[];
      // Sort by newest first
      list.sort((a, b) => b.createdAt - a.createdAt);
      setTournaments(list);
    } catch (err) {
      console.error("Error fetching tournaments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const getStatusBadge = (status: Tournament['status']) => {
    switch (status) {
      case 'Upcoming':
        return <span className="badge badge-cyan">Upcoming</span>;
      case 'Active':
        return <span className="badge badge-violet">Live</span>;
      case 'Completed':
        return <span className="badge badge-gold">Completed</span>;
    }
  };

  // Filter logic (Requirement 5)
  const filteredTournaments = tournaments.filter((tournament) => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGame = selectedGame === 'All' || tournament.game === selectedGame;
    const matchesStatus = selectedStatus === 'All' || tournament.status === selectedStatus;
    const matchesEntryType = selectedEntryType === 'All' || tournament.entryType === selectedEntryType;

    return matchesSearch && matchesGame && matchesStatus && matchesEntryType;
  });

  const uniqueGames = ["Valorant", "League of Legends", "CS:GO", "Apex Legends", "Rocket League", "Overwatch 2"];

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      <div className="hero-glow hero-glow-1" />
      
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Header section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Trophy size={32} style={{ color: 'var(--accent-gold)' }} />
              Championship Tournaments
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Browse live and upcoming bracket tournaments. Assemble your roster and compete.
            </p>
          </div>
          {user && (
            <Link href="/tournaments/create" className="btn btn-primary">
              <PlusCircle size={18} />
              Host Tournament
            </Link>
          )}
        </div>

        {/* Filters Section (Requirement 5) */}
        <div className="glass-panel filters-layout" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          
          {/* Search */}
          <div style={{ flex: '1 0 240px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
            <label htmlFor="search-input" className="sr-only">Search tournaments</label>
            <input
              id="search-input"
              type="text"
              className="glass-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search tournaments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Game filter */}
          <div style={{ flex: '1 0 160px' }}>
            <label htmlFor="game-filter" className="sr-only">Filter by Game</label>
            <select
              id="game-filter"
              className="glass-input glass-select"
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
            >
              <option value="All">All Games</option>
              {uniqueGames.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div style={{ flex: '1 0 140px' }}>
            <label htmlFor="status-filter" className="sr-only">Filter by Status</label>
            <select
              id="status-filter"
              className="glass-input glass-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Active">Live</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Entry Type Filter */}
          <div style={{ flex: '1 0 140px' }}>
            <label htmlFor="entry-filter" className="sr-only">Filter by Entry Type</label>
            <select
              id="entry-filter"
              className="glass-input glass-select"
              value={selectedEntryType}
              onChange={(e) => setSelectedEntryType(e.target.value)}
            >
              <option value="All">All Entry Types</option>
              <option value="Free">Free</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

        </div>

        {/* Tournaments Grid */}
        {loading ? (
          <div className="grid-responsive">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-card skeleton-pulse" style={{ display: 'flex', flexDirection: 'column', height: '220px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div className="skeleton-text" style={{ width: '80px', height: '18px' }} />
                  <div className="skeleton-text" style={{ width: '60px', height: '18px' }} />
                </div>
                <div className="skeleton-text" style={{ width: '80%', height: '24px', marginBottom: '1rem' }} />
                <div className="skeleton-text" style={{ width: '50%', height: '16px', marginBottom: '1.5rem' }} />
                <div className="skeleton-button" style={{ marginTop: 'auto' }} />
              </div>
            ))}
          </div>
        ) : filteredTournaments.length > 0 ? (
          <div className="grid-responsive">
            {filteredTournaments.map((t) => (
              <article key={t.id} className="glass-card card-hover" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  {getStatusBadge(t.status)}
                  <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>{t.entryType} Entry</span>
                </div>

                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>{t.name}</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  <Gamepad2 size={16} style={{ color: 'var(--accent-cyan)' }} />
                  <span>{t.game}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', marginTop: 'auto' }}>
                  <Shield size={16} />
                  <span>Rosters: {t.registeredTeamIds?.length || 0} / {t.maxTeams}</span>
                </div>

                <Link href={`/tournaments/${t.id}`} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
                  View Tournament
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '5rem 2rem' }} className="glass-panel">
            <Trophy size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem auto', opacity: 0.4 }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No Tournaments Found</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              We couldn&apos;t find any tournaments matching your filter selections.
            </p>
            <button onClick={() => { setSearchTerm(''); setSelectedGame('All'); setSelectedStatus('All'); setSelectedEntryType('All'); }} className="btn btn-outline">
              Clear Filters
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
