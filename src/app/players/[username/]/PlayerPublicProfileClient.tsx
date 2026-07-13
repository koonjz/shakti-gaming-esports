'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Profile, Team } from '@/store/useAppStore';
import { Trophy, Gamepad2, Award, Users, Calendar, AlertCircle, Loader } from 'lucide-react';
import Link from 'next/link';

interface MatchRecord {
  id: string;
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  game: string;
  team1Id: string;
  team1Name: string;
  team2Id: string;
  team2Name: string;
  score1: number;
  score2: number;
  winnerId: string;
  resolvedAt: Date;
  team1Members?: string[];
  team2Members?: string[];
}

export default function PlayerPublicProfileClient({ username }: { username: string }) {
  const router = useRouter();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalWinsCount, setTotalWinsCount] = useState(0);
  const [totalLossesCount, setTotalLossesCount] = useState(0);
  
  const [riotStats, setRiotStats] = useState<any>(null);
  const [loadingRiot, setLoadingRiot] = useState(false);
  const [riotError, setRiotError] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    const fetchPlayerData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const decodedUsername = decodeURIComponent(username).toLowerCase();
        
        // 1. Fetch profile by gamertag
        const profilesRef = collection(db, "profiles");
        const qProfile = query(profilesRef, where("gamertag", "==", decodedUsername));
        const profileSnap = await getDocs(qProfile);
        
        if (profileSnap.empty) {
          setError(`Player @${decodedUsername} could not be found.`);
          setLoading(false);
          return;
        }

        const profileDoc = profileSnap.docs[0];
        const profileData = { uid: profileDoc.id, ...profileDoc.data() } as Profile;
        setProfile(profileData);

        // 2. Fetch team if they are in one
        const teamsRef = collection(db, "teams");
        const qTeam = query(teamsRef, where("members", "array-contains", profileData.uid));
        const teamSnap = await getDocs(qTeam);
        
        if (!teamSnap.empty) {
          const teamDoc = teamSnap.docs[0];
          setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team);
        } else {
          setTeam(null);
        }

        // 3. Fetch match history logs (where participantIds contains the player's UID with native orderBy)
        const historyRef = collection(db, "matchHistory");
        const matchQuery = query(
          historyRef, 
          where("participantIds", "array-contains", profileData.uid),
          orderBy("resolvedAt", "desc"),
          limit(10)
        );
        const mSnap = await getDocs(matchQuery);
        
        const mList = mSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            matchId: data.matchId,
            tournamentId: data.tournamentId,
            tournamentName: data.tournamentName,
            game: data.game,
            team1Id: data.team1Id,
            team1Name: data.team1Name,
            team2Id: data.team2Id,
            team2Name: data.team2Name,
            score1: data.score1,
            score2: data.score2,
            winnerId: data.winnerId,
            resolvedAt: data.resolvedAt ? data.resolvedAt.toDate() : new Date(),
            team1Members: data.team1Members || [],
            team2Members: data.team2Members || []
          } as MatchRecord;
        });

        setMatches(mList);
        setLastDoc(mSnap.docs[mSnap.docs.length - 1] || null);
        setHasMore(mSnap.docs.length === 10);

        // 4. Calculate total Wins and Losses across ALL matches
        const allMatchesQuery = query(historyRef, where("participantIds", "array-contains", profileData.uid));
        const allSnap = await getDocs(allMatchesQuery);
        let wCount = 0;
        let lCount = 0;
        allSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const isT1 = data.team1Members?.includes(profileData.uid);
          const isWin = (isT1 && data.winnerId === data.team1Id) || (!isT1 && data.winnerId === data.team2Id);
          if (isWin) {
            wCount++;
          } else {
            lCount++;
          }
        });
        setTotalWinsCount(wCount);
        setTotalLossesCount(lCount);

      } catch (err: any) {
        console.error("Error fetching player:", err);
        setError("An error occurred while loading this profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [username]);

  useEffect(() => {
    const rId = profile?.riotId;
    if (!rId) {
      setRiotStats(null);
      setRiotError(null);
      return;
    }

    const fetchLiveStats = async () => {
      setLoadingRiot(true);
      setRiotError(null);
      try {
        const res = await fetch(`/api/game-stats?riotId=${encodeURIComponent(rId)}`);
        if (!res.ok) {
          const errData = await res.json();
          setRiotError(errData.error || `Riot API returned status ${res.status}`);
          if (errData.setupInstructions) {
            setRiotStats({ setupInstructions: errData.setupInstructions });
          }
        } else {
          const stats = await res.json();
          setRiotStats(stats);
        }
      } catch (err) {
        console.error("Error loading live Riot stats:", err);
        setRiotError("Connection failed: Riot API is currently unreachable.");
      } finally {
        setLoadingRiot(false);
      }
    };

    fetchLiveStats();
  }, [profile]);

  const loadMoreMatches = async () => {
    if (!lastDoc || !profile) return;
    try {
      const historyRef = collection(db, "matchHistory");
      const matchQuery = query(
        historyRef, 
        where("participantIds", "array-contains", profile.uid),
        orderBy("resolvedAt", "desc"),
        startAfter(lastDoc),
        limit(10)
      );
      const mSnap = await getDocs(matchQuery);
      
      const mList = mSnap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          matchId: data.matchId,
          tournamentId: data.tournamentId,
          tournamentName: data.tournamentName,
          game: data.game,
          team1Id: data.team1Id,
          team1Name: data.team1Name,
          team2Id: data.team2Id,
          team2Name: data.team2Name,
          score1: data.score1,
          score2: data.score2,
          winnerId: data.winnerId,
          resolvedAt: data.resolvedAt ? data.resolvedAt.toDate() : new Date(),
          team1Members: data.team1Members || [],
          team2Members: data.team2Members || []
        } as MatchRecord;
      });

      setMatches(prev => [...prev, ...mList]);
      setLastDoc(mSnap.docs[mSnap.docs.length - 1] || null);
      setHasMore(mSnap.docs.length === 10);
    } catch (err) {
      console.error("Error loading more matches:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader className="animate-spin text-cyan" size={40} style={{ color: 'var(--accent-cyan)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Retrieving player details...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <main style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', maxWidth: '480px', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: 'var(--accent-red)', margin: '0 auto 1.5rem auto' }} />
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Profile Error</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error || 'Player profile not found.'}</p>
          <Link href="/" className="btn btn-primary" style={{ width: '100%' }}>
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      {/* Background Decorative Glows */}
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="container" style={{ maxWidth: '800px', position: 'relative', zIndex: 1 }}>
        
        {/* Main Profile Header Panel */}
        <div className="glass-panel fade-in" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
            {/* Avatar Circle */}
            <div style={{ 
              width: '90px', 
              height: '90px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: 'var(--bg-primary)'
            }}>
              {profile.displayName.substring(0, 2).toUpperCase()}
            </div>

            {/* User Meta */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '2.25rem' }}>{profile.displayName}</h1>
                <span className="badge badge-cyan" style={{ fontSize: '0.85rem' }}>@{profile.gamertag}</span>
                <span className={`badge ${
                  profile.skillLevel === 'Advanced' ? 'badge-gold' : 
                  profile.skillLevel === 'Intermediate' ? 'badge-violet' : 'badge-cyan'
                }`}>
                  {profile.skillLevel}
                </span>
              </div>
              
              {/* Team display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
                <Users size={16} style={{ color: 'var(--accent-cyan)' }} />
                {team ? (
                  <span>
                    Plays for <strong style={{ color: 'var(--text-primary)' }}>{team.name}</strong>
                  </span>
                ) : (
                  <span style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>No active team roster</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Riot Games Live Stats Card */}
        {profile.riotId && (
          <section className="glass-panel fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Gamepad2 size={18} style={{ color: 'var(--accent-cyan)' }} />
              Live Game Records (League of Legends)
            </h2>

            {loadingRiot ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
                <Loader className="animate-spin text-cyan" size={24} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Querying Riot Secure Gateway...</span>
              </div>
            ) : riotError ? (
              <div style={{ background: 'hsla(350, 85%, 55%, 0.08)', border: '1px dashed var(--accent-red)', borderRadius: '8px', padding: '1rem', color: 'var(--accent-red)', fontSize: '0.85rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Live Stats Sync Delayed</p>
                <p style={{ lineHeight: 1.4 }}>{riotError}</p>
                {riotStats?.setupInstructions && (
                  <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                    {riotStats.setupInstructions}
                  </p>
                )}
              </div>
            ) : riotStats ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{riotStats.summonerName || profile.riotId}</span>
                    <span className="badge badge-cyan" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>Level {riotStats.summonerLevel}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem', margin: 0 }}>
                    Linked Riot ID: <strong style={{ color: 'var(--text-secondary)' }}>{profile.riotId}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rank Solo Duo</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '0.2rem' }}>
                      {riotStats.rankInfo?.tier} {riotStats.rankInfo?.rank}
                      {riotStats.rankInfo?.tier !== 'UNRANKED' && ` — ${riotStats.rankInfo?.leaguePoints} LP`}
                    </div>
                  </div>
                  {riotStats.rankInfo?.tier !== 'UNRANKED' && (
                    <>
                      <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Record</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '0.2rem' }}>
                          {riotStats.rankInfo?.wins}W - {riotStats.rankInfo?.losses}L
                        </div>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Win Rate</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
                          {riotStats.rankInfo?.winRate}%
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="grid-2-col">
          
          {/* Stats & Rating Panel */}
          <article className="glass-panel fade-in" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={18} style={{ color: 'var(--accent-gold)' }} />
              Combat Statistics
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="glass-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>XP Rating</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.25rem' }}>
                  {profile.stats?.points || 1000}
                </div>
              </div>
              <div className="glass-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Match Wins</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '0.25rem' }}>
                  {profile.stats?.wins || 0}
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Win Ratio (Personal)</span>
                <span style={{ fontWeight: 600 }}>
                  {profile.stats?.wins + (profile.stats?.losses || 0) > 0 ? (
                    `${((profile.stats.wins / (profile.stats.wins + (profile.stats.losses || 0))) * 100).toFixed(1)}%`
                  ) : '0%'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Team Match Record</span>
                <span style={{ fontWeight: 650, color: 'var(--accent-cyan)' }}>
                  {totalWinsCount}W - {totalLossesCount}L
                </span>
              </div>
            </div>
          </article>

          {/* Loadout & Roles Panel */}
          <article className="glass-panel fade-in" style={{ padding: '2rem' }}>
            {/* Preferred Games */}
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Gamepad2 size={18} style={{ color: 'var(--accent-cyan)' }} />
              Active Games
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {profile.registeredGames && profile.registeredGames.length > 0 ? (
                profile.registeredGames.map((game) => (
                  <span key={game} className="badge badge-cyan" style={{ textTransform: 'none', padding: '0.4rem 0.8rem' }}>{game}</span>
                ))
              ) : (
                <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No games registered yet</span>
              )}
            </div>

            {/* Playstyles / Roles */}
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} style={{ color: 'var(--accent-violet)' }} />
              Preferred Roles
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {profile.preferredRoles && profile.preferredRoles.length > 0 ? (
                profile.preferredRoles.map((role) => (
                  <span key={role} className="badge badge-violet" style={{ textTransform: 'none', padding: '0.4rem 0.8rem' }}>{role}</span>
                ))
              ) : (
                <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No playstyles listed yet</span>
              )}
            </div>
          </article>

        </div>

        {/* Dynamic Match History Logs */}
        <section className="glass-panel fade-in" style={{ padding: '2rem', marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={20} style={{ color: 'var(--accent-cyan)' }} />
            Personal Match History (Team Logs)
          </h2>

          {matches.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Calendar size={32} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <p>No matches played yet.</p>
            </div>
          ) : (
            <div className="responsive-table">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Result</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Team Played For</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Opponent</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Score</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Tournament Name</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Date Played</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => {
                    const isTeam1 = match.team1Members?.includes(profile.uid);
                    const teamPlayedName = isTeam1 ? match.team1Name : match.team2Name;
                    const teamPlayedId = isTeam1 ? match.team1Id : match.team2Id;
                    
                    const opponentName = isTeam1 ? match.team2Name : match.team1Name;
                    const opponentId = isTeam1 ? match.team2Id : match.team1Id;
                    
                    const isWin = (isTeam1 && match.winnerId === match.team1Id) || 
                                  (!isTeam1 && match.winnerId === match.team2Id);
                    
                    const teamScore = isTeam1 ? match.score1 : match.score2;
                    const oppScore = isTeam1 ? match.score2 : match.score1;

                    return (
                      <tr key={match.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }} className="table-row-hover">
                        <td style={{ padding: '1rem' }}>
                          <span 
                            className={`badge ${isWin ? 'badge-green' : 'badge-red'}`} 
                            style={{ 
                              fontWeight: 800, 
                              padding: '0.2rem 0.6rem',
                              color: isWin ? 'var(--bg-primary)' : '#fff',
                              background: isWin ? 'var(--accent-green)' : 'var(--accent-red)' 
                            }}
                          >
                            {isWin ? 'W' : 'L'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {teamPlayedId ? (
                            <Link href={`/teams/${teamPlayedId}`} style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-cyan">
                              {teamPlayedName}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>{teamPlayedName}</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {opponentId ? (
                            <Link href={`/teams/${opponentId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }} className="hover-cyan">
                              {opponentName}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{opponentName}</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 700 }}>
                          {teamScore} - {oppScore}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <Link href={`/tournaments/${match.tournamentId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }} className="hover-cyan">
                            {match.tournamentName}
                          </Link>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {match.resolvedAt.toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button 
                    onClick={loadMoreMatches} 
                    className="btn btn-outline touch-target"
                    style={{ fontSize: '0.85rem' }}
                  >
                    Load More Matches
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
      
      {/* Mobile Responsive overrides */}
      <style jsx>{`
        @media (max-width: 1024px) {
          .grid-2-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
