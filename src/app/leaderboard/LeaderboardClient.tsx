'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Profile, Team } from '@/store/useAppStore';
import { Trophy, Search, Users, Star, ArrowUpRight, Award } from 'lucide-react';
import Link from 'next/link';

export default function LeaderboardClient() {
  const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerLimit, setPlayerLimit] = useState(50);
  const [teamLimit, setTeamLimit] = useState(50);

  // Search & Filter states (Requirement 5)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState('All');

  // Real-time snapshot listener (Requirement 6)
  useEffect(() => {
    setLoading(true);
    
    // 1. Stream player profiles
    const profilesQuery = query(
      collection(db, "profiles"),
      orderBy("stats.points", "desc"),
      limit(playerLimit)
    );
    const unsubProfiles = onSnapshot(profilesQuery, (snap) => {
      const list = snap.docs.map(doc => doc.data() as Profile);
      setProfiles(list);
      setLoading(false);
    }, (err) => {
      console.error("Profiles stream error:", err);
      setLoading(false);
    });

    // 2. Stream teams
    const teamsQuery = query(
      collection(db, "teams"),
      limit(teamLimit)
    );
    const unsubTeams = onSnapshot(teamsQuery, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(list);
    }, (err) => {
      console.error("Teams stream error:", err);
    });

    return () => {
      unsubProfiles();
      unsubTeams();
    };
  }, [playerLimit, teamLimit]);

  // Derived filtered players list
  const filteredPlayers = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch = p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.gamertag.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGame = selectedGame === 'All' || p.registeredGames?.includes(selectedGame);
      return matchesSearch && matchesGame;
    });
  }, [profiles, searchQuery, selectedGame]);

  // Derived processed and sorted teams list
  const processedTeams = useMemo(() => {
    return teams.map(t => {
      const teamPoints = t.members.reduce((acc, memberUid) => {
        const memberProf = profiles.find(p => p.uid === memberUid);
        return acc + (memberProf?.stats?.points || 0);
      }, 0);
      const teamWins = t.members.reduce((acc, memberUid) => {
        const memberProf = profiles.find(p => p.uid === memberUid);
        return acc + (memberProf?.stats?.wins || 0);
      }, 0);
      return {
        ...t,
        points: teamPoints,
        wins: teamWins
      };
    }).sort((a, b) => b.points - a.points);
  }, [teams, profiles]);

  // Derived filtered teams list
  const filteredTeams = useMemo(() => {
    return processedTeams.filter((t) => {
      return t.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [processedTeams, searchQuery]);

  const topThreePlayers = useMemo(() => filteredPlayers.slice(0, 3), [filteredPlayers]);

  const uniqueGames = ["Valorant", "League of Legends", "CS:GO", "Apex Legends", "Rocket League", "Overwatch 2"];

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <Trophy size={36} style={{ color: 'var(--accent-gold)' }} />
            Live Hall of Fame
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Ranked player and team leaderboards, synced live in real-time.
          </p>
        </div>

        {/* Filters Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => { setActiveTab('players'); setSearchQuery(''); }}
              className={`btn ${activeTab === 'players' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', border: 'none' }}
              aria-label="Show player rankings leaderboard"
            >
              <Award size={16} /> Player Rankings
            </button>
            <button
              onClick={() => { setActiveTab('teams'); setSearchQuery(''); }}
              className={`btn ${activeTab === 'teams' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', border: 'none' }}
              aria-label="Show team rosters leaderboard"
            >
              <Users size={16} /> Team Rosters
            </button>
          </div>

          {/* Search Inputs (Requirement 5) */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: '1 0 280px', maxWidth: '500px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
              <label htmlFor="search-query" className="sr-only">Search rankings</label>
              <input
                id="search-query"
                type="text"
                className="glass-input"
                style={{ paddingLeft: '2.5rem', fontSize: '0.9rem' }}
                placeholder={activeTab === 'players' ? "Search players by tag..." : "Search team name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {activeTab === 'players' && (
              <div style={{ width: '160px' }}>
                <label htmlFor="leaderboard-game-filter" className="sr-only">Filter by Game</label>
                <select
                  id="leaderboard-game-filter"
                  className="glass-input glass-select"
                  style={{ fontSize: '0.9rem' }}
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                >
                  <option value="All">All Games</option>
                  {uniqueGames.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="glass-panel skeleton-pulse" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: n === 5 ? 'none' : '1px solid var(--border-color)', paddingBottom: n === 5 ? '0' : '1.1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <div className="skeleton-text" style={{ width: '32px', height: '32px', borderRadius: '50%', marginBottom: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-text" style={{ width: '120px', height: '16px', marginBottom: '0.4rem' }} />
                      <div className="skeleton-text" style={{ width: '80px', height: '12px', marginBottom: 0 }} />
                    </div>
                  </div>
                  <div className="skeleton-text" style={{ width: '80px', height: '16px', marginBottom: 0 }} />
                  <div className="skeleton-text" style={{ width: '60px', height: '16px', marginBottom: 0, marginLeft: '2rem' }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* PLAYERS LEADERBOARD */}
            {activeTab === 'players' && (
              <>
                {/* Podium for Top 3 */}
                {topThreePlayers.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1.5rem', margin: '2rem 0 4rem 0', flexWrap: 'wrap' }} className="podium-container">
                    
                    {/* 2nd Place */}
                    {topThreePlayers[1] && (
                      <article className="glass-panel" style={{ width: '200px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '4px solid hsl(265, 89%, 63%)', borderRadius: '12px', transform: 'scale(0.95)', order: 1 }}>
                        <div style={{ background: 'var(--bg-secondary)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent-violet)', border: '2px solid var(--accent-violet)', marginBottom: '0.75rem', fontSize: '1.25rem' }}>
                          2
                        </div>
                        <Link href={`/players/${topThreePlayers[1].gamertag}`} style={{ fontWeight: 700, textAlign: 'center' }} className="hover-cyan">
                          {topThreePlayers[1].displayName}
                        </Link>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{topThreePlayers[1].gamertag}</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-violet)', marginTop: '0.5rem' }}>{topThreePlayers[1].stats?.points || 1000} XP</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{topThreePlayers[1].stats?.wins || 0} Wins</div>
                      </article>
                    )}

                    {/* 1st Place */}
                    {topThreePlayers[0] && (
                      <article className="glass-panel" style={{ width: '220px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '4px solid var(--accent-gold)', borderRadius: '12px', boxShadow: '0 12px 40px hsla(45, 100%, 55%, 0.15)', border: '1px solid hsla(45, 100%, 55%, 0.3)', order: 2 }}>
                        <div style={{ background: 'var(--bg-secondary)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--accent-gold)', border: '3px solid var(--accent-gold)', marginBottom: '0.75rem', fontSize: '1.5rem', position: 'relative' }}>
                          <Star size={16} style={{ position: 'absolute', top: '-10px', fill: 'var(--accent-gold)', stroke: 'none' }} />
                          1
                        </div>
                        <Link href={`/players/${topThreePlayers[0].gamertag}`} style={{ fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }} className="hover-cyan">
                          {topThreePlayers[0].displayName}
                        </Link>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{topThreePlayers[0].gamertag}</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '0.5rem' }}>{topThreePlayers[0].stats?.points || 1000} XP</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{topThreePlayers[0].stats?.wins || 0} Wins</div>
                      </article>
                    )}

                    {/* 3rd Place */}
                    {topThreePlayers[2] && (
                      <article className="glass-panel" style={{ width: '180px', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '4px solid var(--accent-cyan)', borderRadius: '12px', transform: 'scale(0.9)', order: 3 }}>
                        <div style={{ background: 'var(--bg-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent-cyan)', border: '2px solid var(--accent-cyan)', marginBottom: '0.75rem', fontSize: '1.1rem' }}>
                          3
                        </div>
                        <Link href={`/players/${topThreePlayers[2].gamertag}`} style={{ fontWeight: 700, textAlign: 'center' }} className="hover-cyan">
                          {topThreePlayers[2].displayName}
                        </Link>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{topThreePlayers[2].gamertag}</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.5rem' }}>{topThreePlayers[2].stats?.points || 1000} XP</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{topThreePlayers[2].stats?.wins || 0} Wins</div>
                      </article>
                    )}

                  </div>
                )}

                {/* Table for Remaining Players */}
                <div className="glass-panel responsive-table" style={{ padding: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <caption>Player Leaderboard rankings based on aggregated match performance and XP score.</caption>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <th style={{ padding: '1rem' }}>Rank</th>
                        <th style={{ padding: '1rem' }}>Player</th>
                        <th style={{ padding: '1rem' }}>Active Games</th>
                        <th style={{ padding: '1rem' }}>Skill Level</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>XP Points</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Profile</th>
                      </tr>
                    </thead>
                    <tbody aria-live="polite">
                      {filteredPlayers.map((player, idx) => {
                        if (idx < 0) return null;
                        return (
                          <tr key={`${player.uid}-${idx}-${player.stats?.points || 1000}`} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.95rem' }} className="table-row-hover status-flash">
                            <td data-label="Rank" style={{ padding: '1rem', fontWeight: 800, color: idx === 0 ? 'var(--accent-gold)' : idx === 1 ? 'var(--accent-violet)' : idx === 2 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                              #{idx + 1}
                            </td>
                            <td data-label="Player" style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                                  {player.displayName.substring(0, 2).toUpperCase()}
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                  <div style={{ fontWeight: 700 }}>{player.displayName}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{player.gamertag}</div>
                                </div>
                              </div>
                            </td>
                            <td data-label="Active Games" style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {player.registeredGames?.slice(0, 2).map(g => (
                                  <span key={g} className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', textTransform: 'none' }}>{g}</span>
                                ))}
                                {player.registeredGames?.length > 2 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{player.registeredGames.length - 2}</span>}
                              </div>
                            </td>
                            <td data-label="Skill Level" style={{ padding: '1rem' }}>
                              <span className={`badge ${player.skillLevel === 'Advanced' ? 'badge-gold' : player.skillLevel === 'Intermediate' ? 'badge-violet' : 'badge-cyan'}`} style={{ fontSize: '0.7rem' }}>
                                {player.skillLevel}
                              </span>
                            </td>
                            <td data-label="XP Points" style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                              {player.stats?.points || 1000}
                            </td>
                            <td data-label="Profile" style={{ padding: '1rem', textAlign: 'right' }}>
                              <Link href={`/players/${player.gamertag}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--accent-violet)' }} className="hover-cyan">
                                View <ArrowUpRight size={14} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPlayers.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            No players match your search filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {profiles.length === playerLimit && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                      <button onClick={() => setPlayerLimit(prev => prev + 50)} className="btn btn-outline touch-target" style={{ fontSize: '0.85rem' }}>
                        Load More Players
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TEAMS LEADERBOARD */}
            {activeTab === 'teams' && (
              <div className="glass-panel responsive-table" style={{ padding: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <caption>Team Leaderboard rankings based on combined roster XP scores.</caption>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '1rem' }}>Rank</th>
                      <th style={{ padding: '1rem' }}>Team Organization</th>
                      <th style={{ padding: '1rem' }}>Members Count</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Accumulated wins</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Total XP Points</th>
                    </tr>
                  </thead>
                  <tbody aria-live="polite">
                    {filteredTeams.map((teamItem, idx) => (
                      <tr key={`${teamItem.id}-${idx}-${teamItem.points || 0}`} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.95rem' }} className="table-row-hover status-flash">
                        <td data-label="Rank" style={{ padding: '1rem', fontWeight: 800, color: idx === 0 ? 'var(--accent-gold)' : idx === 1 ? 'var(--accent-violet)' : idx === 2 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                          #{idx + 1}
                        </td>
                        <td data-label="Team Organization" style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%)', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--bg-primary)', fontSize: '0.8rem' }}>
                              {teamItem.name.substring(0, 2).toUpperCase()}
                            </div>
                            <Link href={`/teams/${teamItem.id}`} style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-cyan">
                              {teamItem.name}
                            </Link>
                          </div>
                        </td>
                        <td data-label="Members Count" style={{ padding: '1rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                            <Users size={14} />
                            {teamItem.members?.length || 0} Members
                          </span>
                        </td>
                        <td data-label="Accumulated wins" style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--accent-green)' }}>
                          {teamItem.wins || 0} Wins
                        </td>
                        <td data-label="Total XP Points" style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent-gold)' }}>
                          {teamItem.points || 0} XP
                        </td>
                      </tr>
                    ))}
                    {filteredTeams.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          No team rosters match your search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {teams.length === teamLimit && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                    <button onClick={() => setTeamLimit(prev => prev + 50)} className="btn btn-outline touch-target" style={{ fontSize: '0.85rem' }}>
                      Load More Teams
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      <style jsx global>{`
        .table-row-hover {
          transition: var(--transition-fast);
        }
        .table-row-hover:hover {
          background: hsla(223, 20%, 10%, 0.4);
        }
        @media (max-width: 640px) {
          .podium-container {
            flex-direction: column !important;
            align-items: center !important;
          }
        }
      `}</style>
    </main>
  );
}
