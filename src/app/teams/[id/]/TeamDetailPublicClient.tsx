'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trophy, Users, Shield, Calendar, ArrowLeft, Loader, AlertCircle } from 'lucide-react';
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
}

interface Team {
  id: string;
  name: string;
  captainId: string;
  members: string[];
  wins?: number;
  points?: number;
}

interface Profile {
  uid: string;
  gamertag: string;
  displayName: string;
}

export default function TeamDetailPublicClient({ id }: { id: string }) {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [captainProfile, setCaptainProfile] = useState<Profile | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Profile[]>([]);
  
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalWinsCount, setTotalWinsCount] = useState(0);
  const [totalLossesCount, setTotalLossesCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [notifError, setNotifError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchTeamDetails = async () => {
      try {
        setLoading(true);
        // 1. Fetch team document
        const teamRef = doc(db, "teams", id);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) {
          setNotifError("Team organization not found.");
          setLoading(false);
          return;
        }

        const tData = { id: teamSnap.id, ...teamSnap.data() } as Team;
        setTeam(tData);

        // 2. Fetch member profiles
        if (tData.members && tData.members.length > 0) {
          const profilesRef = collection(db, "profiles");
          const q = query(profilesRef, where("uid", "in", tData.members));
          const pSnap = await getDocs(q);
          const pList = pSnap.docs.map(d => d.data() as Profile);
          setMemberProfiles(pList);

          // Find captain profile
          const cap = pList.find(p => p.uid === tData.captainId);
          if (cap) setCaptainProfile(cap);
        }

        // 3. Fetch match history (querying participantIds containing team ID with native orderBy and limit)
        const historyRef = collection(db, "matchHistory");
        const matchQuery = query(
          historyRef, 
          where("participantIds", "array-contains", id),
          orderBy("resolvedAt", "desc"),
          limit(20)
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
            resolvedAt: data.resolvedAt ? data.resolvedAt.toDate() : new Date()
          } as MatchRecord;
        });

        setMatches(mList);
        setLastDoc(mSnap.docs[mSnap.docs.length - 1] || null);
        setHasMore(mSnap.docs.length === 20);

        // 4. Calculate total Wins and Losses server-side across all matches
        const winQuery = query(
          historyRef,
          where("participantIds", "array-contains", id),
          where("winnerId", "==", id)
        );
        const totalQuery = query(
          historyRef,
          where("participantIds", "array-contains", id)
        );

        const [winSnap, totalSnap] = await Promise.all([
          getCountFromServer(winQuery),
          getCountFromServer(totalQuery)
        ]);

        const wCount = winSnap.data().count;
        const tCount = totalSnap.data().count;
        setTotalWinsCount(wCount);
        setTotalLossesCount(tCount - wCount);

      } catch (err) {
        console.error("Error loading team history:", err);
        setNotifError("Failed to fetch team records.");
      } finally {
        setLoading(false);
      }
    };

    fetchTeamDetails();
  }, [id]);

  const loadMoreMatches = async () => {
    if (!lastDoc) return;
    try {
      const historyRef = collection(db, "matchHistory");
      const matchQuery = query(
        historyRef, 
        where("participantIds", "array-contains", id),
        orderBy("resolvedAt", "desc"),
        startAfter(lastDoc),
        limit(20)
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
          resolvedAt: data.resolvedAt ? data.resolvedAt.toDate() : new Date()
        } as MatchRecord;
      });

      setMatches(prev => [...prev, ...mList]);
      setLastDoc(mSnap.docs[mSnap.docs.length - 1] || null);
      setHasMore(mSnap.docs.length === 20);
    } catch (err) {
      console.error("Error loading more matches:", err);
    }
  };

  // Derive W/L record from server count states (accurate total, not truncated by pagination limit)
  const derivedWins = totalWinsCount;
  const derivedLosses = totalLossesCount;

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader className="animate-spin text-cyan" size={40} style={{ color: 'var(--accent-cyan)', margin: '0 auto 1rem auto' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Retrieving Team Records...</p>
        </div>
      </div>
    );
  }

  if (notifError || !team) {
    return (
      <main style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', maxWidth: '480px', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: 'var(--accent-red)', margin: '0 auto 1.5rem auto' }} />
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Team Error</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{notifError || 'Team organization not found.'}</p>
          <Link href="/leaderboard" className="btn btn-primary" style={{ width: '100%' }}>
            View Leaderboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        
        {/* Navigation back */}
        <button 
          onClick={() => router.back()}
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer', 
            marginBottom: '1.5rem',
            padding: 0
          }}
          className="hover-cyan"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* Team Header Panel */}
        <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 900, 
              color: 'var(--bg-primary)', 
              fontSize: '1.75rem' 
            }}>
              {team.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {team.name}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Captain: <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>@{captainProfile?.gamertag || 'unknown'}</span>
              </p>
            </div>
          </div>

          {/* Stats Summary Box */}
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Derived Record</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {derivedWins}W - {derivedLosses}L
              </div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roster XP</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                {team.points || 0} XP
              </div>
            </div>
          </div>
        </div>

        {/* Layout Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem' }} className="tablet-grid">
          
          {/* Active Members Roster */}
          <section className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} style={{ color: 'var(--accent-cyan)' }} />
               Roster Members
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {memberProfiles.map((member) => {
                const isCap = member.uid === team.captainId;
                return (
                  <div 
                    key={member.uid}
                    style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{member.displayName}</div>
                      <Link href={`/players/${member.gamertag}`} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} className="hover-cyan">
                        @{member.gamertag}
                      </Link>
                    </div>
                    {isCap && (
                      <span className="badge badge-gold" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                        <Shield size={10} style={{ marginRight: '0.1rem' }} /> CAPTAIN
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Match History logs */}
          <section className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={20} style={{ color: 'var(--accent-cyan)' }} />
               Match History Logs
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
                      <th style={{ padding: '0.75rem 1rem' }}>Opponent</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Score</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Tournament Name</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Game Title</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Date Played</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match) => {
                      const isTeam1 = match.team1Id === id;
                      const opponentName = isTeam1 ? match.team2Name : match.team1Name;
                      const opponentId = isTeam1 ? match.team2Id : match.team1Id;
                      const isWin = match.winnerId === id;
                      
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
                            {opponentId ? (
                              <Link href={`/teams/${opponentId}`} style={{ fontWeight: 700, color: 'var(--text-primary)' }} className="hover-cyan">
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
                            <Link href={`/tournaments/${match.tournamentId}`} style={{ color: 'var(--text-secondary)' }} className="hover-cyan">
                              {match.tournamentName}
                            </Link>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>{match.game}</span>
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

      </div>
      
      <style jsx global>{`
        @media (max-width: 768px) {
          .tablet-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
