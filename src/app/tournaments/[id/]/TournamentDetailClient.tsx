'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  arrayUnion,
  getDoc,
  arrayRemove,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore, Team } from '@/store/useAppStore';
import { Trophy, Calendar, Shield, Users, Layers, Award, Loader, AlertCircle, Edit3, Save, Play, Check, X, MessageSquare, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Match {
  id: string; // m-r-idx (e.g., m-1-1, m-2-1)
  round: number;
  matchIndex: number; // index in this round
  team1Id: string | null;
  team2Id: string | null;
  score1: number;
  score2: number;
  winnerId: string | null;
  nextMatchId: string | null;
}

interface Tournament {
  id: string;
  name: string;
  game: string;
  organizerId: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  entryType: 'Free' | 'Paid';
  maxTeams: number;
  registeredTeamIds: string[];
  bracket: {
    matches: Match[];
  };
  createdAt: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderGamertag: string;
  text: string;
  createdAt: any;
  teamId?: string | null;
}

export default function TournamentDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const team = useAppStore((state) => state.team);
  const profile = useAppStore((state) => state.profile);
  const loading = useAppStore((state) => state.loading);

  // Tournament state loaded from Firestore snapshot
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teamsMap, setTeamsMap] = useState<Record<string, string>>({}); // id -> name
  
  // UI States
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Match score editing states (Organizer only)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editScore1, setEditScore1] = useState(0);
  const [editScore2, setEditScore2] = useState(0);

  // Live Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [chatLoading, setChatLoading] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to Tournament real-time updates (Requirement 2 & Firestore listeners)
  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, "tournaments", id), async (docSnap) => {
      if (docSnap.exists()) {
        const tData = { id: docSnap.id, ...docSnap.data() } as Tournament;
        setTournament(tData);
        
        // Fetch teams metadata
        if (tData.registeredTeamIds && tData.registeredTeamIds.length > 0) {
          try {
            const teamsRef = collection(db, "teams");
            const q = query(teamsRef, where("id", "in", tData.registeredTeamIds));
            const teamSnap = await getDocs(q);
            
            const tempMap: Record<string, string> = {};
            for (const tId of tData.registeredTeamIds) {
              const dRef = doc(db, "teams", tId);
              const snapDoc = await getDoc(dRef);
              if (snapDoc.exists()) {
                tempMap[tId] = snapDoc.data().name;
              }
            }
            setTeamsMap(tempMap);
          } catch (err) {
            console.error("Error fetching tournament teams details:", err);
          }
        }
      } else {
        setError("Tournament does not exist.");
      }
      setPageLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to stream tournament updates.");
      setPageLoading(false);
    });

    return () => unsub();
  }, [id]);

  const isOrganizer = tournament?.organizerId === user?.uid;
  const isParticipant = team && tournament?.registeredTeamIds?.includes(team.id);
  const isChatEligible = user && (isOrganizer || isParticipant);

  // Auto scroll chat to bottom when messages list updates
  const scrollToBottom = (force = false) => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (force || isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to messages subcollection (latency compensation / order by createdAt)
  useEffect(() => {
    if (!id || !isChatEligible) {
      setMessages([]);
      setChatLoading(false);
      return;
    }

    setChatLoading(true);
    const messagesRef = collection(db, "tournaments", id, "messages");
    const q = query(
      messagesRef,
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          senderId: data.senderId,
          senderGamertag: data.senderGamertag,
          text: data.text,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          teamId: data.teamId
        } as ChatMessage;
      });
      // Sort ascending to get chronological message view
      list.reverse();
      setMessages(list);
      setChatLoading(false);
    }, (err) => {
      console.error("Chat sync stream error:", err);
      setChatLoading(false);
    });

    return () => unsub();
  }, [id, isChatEligible]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tournament || !isChatEligible) return;

    const trimmed = newMessageText.trim();
    if (!trimmed || trimmed.length > 500) return;

    setNewMessageText('');

    try {
      const messagesRef = collection(db, "tournaments", id, "messages");
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderGamertag: profile?.gamertag || 'anonymous',
        text: trimmed,
        createdAt: serverTimestamp(),
        teamId: isOrganizer ? null : (team?.id || null)
      });
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError("Failed to send message. Eligibility check rejected write.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user || !tournament || !isOrganizer) return;
    if (!window.confirm("Moderation Action: Delete this message from history?")) return;

    try {
      const msgRef = doc(db, "tournaments", id, "messages", messageId);
      await deleteDoc(msgRef);
    } catch (err: any) {
      console.error("Error deleting message:", err);
      setError("Moderation delete action rejected.");
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Join tournament (Requirement 2 & 8 Validation)
  const handleJoinTournament = async () => {
    clearMessages();
    if (!tournament) return;

    if (!user) {
      setError("Please log in to register.");
      return;
    }

    if (!team) {
      setError("You must belong to a team roster to register. Create or join a team first.");
      return;
    }

    // Verify user is team captain
    if (team.captainId !== user.uid) {
      setError("Only the Team Captain can register the roster for tournaments.");
      return;
    }

    // Req 8 Validation checks
    if (tournament.status !== 'Upcoming') {
      setError("Registration is closed. The tournament has already started or completed.");
      return;
    }

    if (tournament.registeredTeamIds.includes(team.id)) {
      setError("Your team is already registered for this tournament.");
      return;
    }

    if (tournament.registeredTeamIds.length >= tournament.maxTeams) {
      setError("This tournament has reached its maximum roster capacity.");
      return;
    }

    setActionLoading(true);
    try {
      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        registeredTeamIds: arrayUnion(team.id),
        lastRegisteredTeamId: team.id
      });

      // Write batch of registration_confirmed notifications to all members of the registering team
      const nBatch = writeBatch(db);
      if (team.members) {
        team.members.forEach((mId) => {
          const nRef = doc(collection(db, "profiles", mId, "notifications"));
          nBatch.set(nRef, {
            type: 'registration_confirmed',
            message: `Your team ${team.name} has registered for tournament ${tournament.name}.`,
            relatedId: tournament.id,
            read: false,
            createdAt: serverTimestamp(),
            teamId: team.id
          });
        });
      }
      await nBatch.commit();

      setSuccess("Your team has registered successfully!");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Registration failed: Action rejected by database rules. Confirm you are the Team Captain and that registration requirements are met.");
      } else {
        setError(err.message || "Failed to register for tournament.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Brackets and Start Tournament (Organizer only)
  const handleStartTournament = async () => {
    clearMessages();
    if (!tournament) return;

    if (tournament.registeredTeamIds.length < 2) {
      setError("At least 2 teams must register before generating brackets.");
      return;
    }

    setActionLoading(true);

    try {
      const max = tournament.maxTeams;
      const registered = tournament.registeredTeamIds;
      const matches: Match[] = [];
      
      const totalRounds = Math.log2(max);

      // Loop through each round to pre-generate matches
      for (let r = 1; r <= totalRounds; r++) {
        const matchesInRound = max / Math.pow(2, r);

        for (let idx = 1; idx <= matchesInRound; idx++) {
          const matchId = `m-${r}-${idx}`;
          let team1Id: string | null = null;
          let team2Id: string | null = null;
          
          if (r === 1) {
            const team1Index = (idx - 1) * 2;
            const team2Index = team1Index + 1;
            
            team1Id = registered[team1Index] || null;
            team2Id = registered[team2Index] || null;
          }

          const nextMatchId = r === totalRounds ? null : `m-${r + 1}-${Math.ceil(idx / 2)}`;

          matches.push({
            id: matchId,
            round: r,
            matchIndex: idx,
            team1Id,
            team2Id,
            score1: 0,
            score2: 0,
            winnerId: null,
            nextMatchId
          });
        }
      }

      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        status: 'Active',
        'bracket.matches': matches
      });

      // Write tournament_starting notifications to all members of registered teams
      try {
        const membersToNotify: string[] = [];
        if (tournament.registeredTeamIds && tournament.registeredTeamIds.length > 0) {
          const teamsRef = collection(db, "teams");
          const q = query(teamsRef, where("id", "in", tournament.registeredTeamIds));
          const teamSnap = await getDocs(q);
          
          teamSnap.docs.forEach((docSnap) => {
            const tData = docSnap.data();
            if (tData.members) {
              tData.members.forEach((mId: string) => {
                if (!membersToNotify.includes(mId)) {
                  membersToNotify.push(mId);
                }
              });
            }
          });
        }

        const notifyBatch = writeBatch(db);
        membersToNotify.forEach((mUid) => {
          const nRef = doc(collection(db, "profiles", mUid, "notifications"));
          notifyBatch.set(nRef, {
            type: 'tournament_starting',
            message: `Tournament ${tournament.name} has started! Check the bracket.`,
            relatedId: tournament.id,
            read: false,
            createdAt: serverTimestamp()
          });
        });
        await notifyBatch.commit();
      } catch (notifyErr) {
        console.error("Failed to write tournament_starting notifications:", notifyErr);
      }

      setSuccess("Brackets generated! Tournament is now Live.");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Only the tournament organizer has permission to generate brackets and start the tournament.");
      } else {
        setError("Failed to start tournament brackets.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const startEditMatch = (m: Match) => {
    setEditingMatchId(m.id);
    setEditScore1(m.score1);
    setEditScore2(m.score2);
  };

  const handleSaveMatchScore = async (matchId: string) => {
    clearMessages();
    if (!tournament) return;

    setActionLoading(true);
    try {
      const updatedMatches = [...tournament.bracket.matches];
      const matchIdx = updatedMatches.findIndex(m => m.id === matchId);
      if (matchIdx === -1) throw new Error("Match not found.");

      const match = { ...updatedMatches[matchIdx] };
      match.score1 = editScore1;
      match.score2 = editScore2;

      if (editScore1 === editScore2) {
        setError("Matches cannot end in a tie. Please adjust scores.");
        setActionLoading(false);
        return;
      }

      const winnerId = editScore1 > editScore2 ? match.team1Id : match.team2Id;
      if (!winnerId) {
        setError("Error resolving winner from empty slots.");
        setActionLoading(false);
        return;
      }

      match.winnerId = winnerId;
      updatedMatches[matchIdx] = match;

      if (match.nextMatchId) {
        const nextIdx = updatedMatches.findIndex(m => m.id === match.nextMatchId);
        if (nextIdx !== -1) {
          const nextMatch = { ...updatedMatches[nextIdx] };
          
          if (match.matchIndex % 2 === 1) {
            nextMatch.team1Id = winnerId;
          } else {
            nextMatch.team2Id = winnerId;
          }
          updatedMatches[nextIdx] = nextMatch;
        }
      } else {
        const tournamentRef = doc(db, "tournaments", tournament.id);
        await updateDoc(tournamentRef, {
          status: 'Completed'
        });

        if (winnerId) {
          try {
            const teamRef = doc(db, "teams", winnerId);
            const teamSnap = await getDoc(teamRef);
            if (teamSnap.exists()) {
              const teamData = teamSnap.data() as Team;
              for (const memberUid of teamData.members) {
                const pRef = doc(db, "profiles", memberUid);
                const pSnap = await getDoc(pRef);
                if (pSnap.exists()) {
                  const pData = pSnap.data();
                  const currentWins = pData.stats?.wins || 0;
                  const currentPoints = pData.stats?.points || 1000;
                  await updateDoc(pRef, {
                    "stats.wins": currentWins + 1,
                    "stats.points": currentPoints + 300
                  });
                }
              }
            }
          } catch (statErr) {
            console.error("Failed to award victory points to team members:", statErr);
          }
        }
      }

      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        'bracket.matches': updatedMatches
      });

      // Write match_result notifications to members of both teams
      try {
        const team1Members: string[] = [];
        const team2Members: string[] = [];
        const membersToNotify: string[] = [];

        const fetchTeamMembers = async (tId: string | null, listDest: string[]) => {
          if (!tId) return;
          const snap = await getDoc(doc(db, "teams", tId));
          if (snap.exists()) {
            const tData = snap.data();
            if (tData.members) {
              tData.members.forEach((mId: string) => {
                listDest.push(mId);
                if (!membersToNotify.includes(mId)) {
                  membersToNotify.push(mId);
                }
              });
            }
          }
        };

        await fetchTeamMembers(match.team1Id, team1Members);
        await fetchTeamMembers(match.team2Id, team2Members);

        const team1Name = match.team1Id ? (teamsMap[match.team1Id] || 'TBD') : 'TBD';
        const team2Name = match.team2Id ? (teamsMap[match.team2Id] || 'TBD') : 'TBD';

        const historyRef = doc(collection(db, "matchHistory"));
        const participantIds = [match.team1Id, match.team2Id, ...membersToNotify].filter(Boolean) as string[];

        const notifyBatch = writeBatch(db);
        
        // 1. Write the Match History log (denormalized, query-friendly)
        notifyBatch.set(historyRef, {
          matchId: match.id,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          game: tournament.game,
          team1Id: match.team1Id || '',
          team1Name,
          team2Id: match.team2Id || '',
          team2Name,
          score1: editScore1,
          score2: editScore2,
          winnerId,
          resolvedAt: serverTimestamp(),
          team1Members,
          team2Members,
          participantIds
        });

        // 2. Set notifications for players
        membersToNotify.forEach((mUid) => {
          const nRef = doc(collection(db, "profiles", mUid, "notifications"));
          notifyBatch.set(nRef, {
            type: 'match_result',
            message: `Match result recorded: ${team1Name} vs ${team2Name} in ${tournament.name}.`,
            relatedId: tournament.id,
            read: false,
            createdAt: serverTimestamp()
          });
        });
        
        await notifyBatch.commit();
      } catch (notifyErr) {
        console.error("Failed to write match_result notifications and history:", notifyErr);
      }

      setEditingMatchId(null);
      setSuccess("Match score updated and advanced!");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Only the tournament organizer can record scores and complete matches.");
      } else {
        setError("Failed to save match score.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          {/* Header Skeleton */}
          <div className="glass-panel skeleton-pulse" style={{ padding: '2rem', marginBottom: '2.5rem', height: '140px' }}>
            <div className="skeleton-text" style={{ width: '40%', height: '32px', marginBottom: '1rem' }} />
            <div className="skeleton-text" style={{ width: '60%', height: '16px' }} />
          </div>

          {/* Bracket Skeleton */}
          <div className="glass-panel skeleton-pulse" style={{ padding: '3rem', height: '400px' }}>
            <div className="skeleton-text" style={{ width: '20%', height: '24px', marginBottom: '2rem' }} />
            <div style={{ display: 'flex', gap: '2.5rem', justifyContent: 'space-around', marginTop: '3rem' }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '200px' }}>
                  <div className="skeleton-text" style={{ height: '80px', borderRadius: '8px' }} />
                  <div className="skeleton-text" style={{ height: '80px', borderRadius: '8px' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <main style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', maxWidth: '480px', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: 'var(--accent-red)', margin: '0 auto 1.5rem auto' }} />
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Tournament Error</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error || 'Tournament not found.'}</p>
          <Link href="/tournaments" className="btn btn-primary" style={{ width: '100%' }}>
            Browse Tournaments
          </Link>
        </div>
      </main>
    );
  }

  const isRegistered = team && tournament.registeredTeamIds.includes(team.id);

  const matchesByRound: Record<number, Match[]> = {};
  if (tournament.bracket?.matches) {
    tournament.bracket.matches.forEach(m => {
      if (!matchesByRound[m.round]) {
        matchesByRound[m.round] = [];
      }
      matchesByRound[m.round].push(m);
    });
  }

  const roundsCount = Math.log2(tournament.maxTeams);
  const roundsArray = Array.from({ length: roundsCount }, (_, i) => i + 1);

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Top Info Panel */}
        <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className={`badge ${
                  tournament.status === 'Upcoming' ? 'badge-cyan' :
                  tournament.status === 'Active' ? 'badge-violet' : 'badge-gold'
                }`}>
                  {tournament.status}
                </span>
                <span className="badge badge-cyan">{tournament.game}</span>
                <span className="badge badge-violet">{tournament.entryType} Entry</span>
              </div>
              <h1 style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>{tournament.name}</h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                Bracket capacity: {tournament.registeredTeamIds.length} / {tournament.maxTeams} rosters registered.
              </p>
            </div>

            {/* Registration / Start Actions */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {tournament.status === 'Upcoming' && (
                <>
                  {isOrganizer ? (
                    <button 
                      onClick={handleStartTournament}
                      className="btn btn-primary"
                      disabled={actionLoading || tournament.registeredTeamIds.length < 2}
                      style={{ background: 'linear-gradient(135deg, var(--accent-violet) 0%, hsl(280, 80%, 55%) 100%)', boxShadow: 'var(--glow-violet)' }}
                    >
                      <Play size={16} /> Generate Bracket & Start
                    </button>
                  ) : isRegistered ? (
                    <button className="btn btn-outline" style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }} disabled>
                      <Check size={16} /> Roster Registered
                    </button>
                  ) : (
                    <button 
                      onClick={handleJoinTournament}
                      className="btn btn-primary"
                      disabled={actionLoading || tournament.registeredTeamIds.length >= tournament.maxTeams}
                    >
                      Register Team Roster
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Global Action feedback messages */}
        {(error || success) && (
          <div 
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: error ? 'hsla(350, 85%, 55%, 0.12)' : 'hsla(145, 80%, 45%, 0.12)',
              border: `1px solid ${error ? 'var(--accent-red)' : 'var(--accent-green)'}`,
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '2rem',
              color: error ? 'var(--accent-red)' : 'var(--accent-green)',
              fontSize: '0.95rem'
            }}
          >
            <AlertCircle size={18} />
            <span>{error || success}</span>
          </div>
        )}

        {/* BRACKET VIEW CONTAINER */}
        <div 
          className="glass-panel scroll-x-container" 
          style={{ padding: '2.5rem' }}
          aria-live="polite"
        >
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} style={{ color: 'var(--accent-cyan)' }} />
            Tournament Bracket
          </h2>

          {tournament.status === 'Upcoming' ? (
            <div style={{ textAlign: 'center', padding: '4rem 1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
              <Trophy size={48} style={{ opacity: 0.25, margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Bracket Pending Launch</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '400px', margin: '0 auto' }}>
                Brackets will generate and show here once the organizer starts the tournament. Currently waiting for team registrations.
              </p>

              {/* Roster overview */}
              <div style={{ marginTop: '2rem', maxWidth: '360px', margin: '2rem auto 0 auto' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Registered Rosters ({tournament.registeredTeamIds.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {tournament.registeredTeamIds.map((tId) => (
                    <div key={tId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.9rem', justifyContent: 'center' }}>
                      <Shield size={14} style={{ color: 'var(--accent-cyan)' }} />
                      <span>{teamsMap[tId] || 'Roster Loading...'}</span>
                    </div>
                  ))}
                  {tournament.registeredTeamIds.length === 0 && (
                    <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No teams registered yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* BRACKET LAYOUT (Rounds Side-by-Side) */
            <div style={{ display: 'flex', gap: '2.5rem', minWidth: '800px', padding: '1rem 0' }}>
              {roundsArray.map((rNum) => {
                const roundMatches = matchesByRound[rNum] || [];
                const roundTitle = rNum === roundsCount ? "Championship Finals" : 
                                   rNum === roundsCount - 1 ? "Semifinals" : `Round ${rNum}`;
                
                return (
                  <div key={rNum} style={{ display: 'flex', flexDirection: 'column', width: '260px', flexShrink: 0 }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                      {roundTitle}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', flexGrow: 1, gap: '2rem' }}>
                      {roundMatches.map((m) => {
                        const t1Name = m.team1Id ? (teamsMap[m.team1Id] || 'Team Roster') : 'TBD';
                        const t2Name = m.team2Id ? (teamsMap[m.team2Id] || 'Team Roster') : 'TBD';
                        const isT1Winner = m.winnerId && m.winnerId === m.team1Id;
                        const isT2Winner = m.winnerId && m.winnerId === m.team2Id;

                        return (
                          <article 
                            key={m.id} 
                            style={{ 
                              background: 'hsla(223, 20%, 8%, 0.8)',
                              borderRadius: '8px', 
                              border: m.winnerId ? '1px solid var(--border-color)' : '1px solid hsla(186, 100%, 48%, 0.2)',
                              boxShadow: m.winnerId ? 'none' : '0 0 10px hsla(186, 100%, 48%, 0.05)',
                              padding: '0.8rem',
                              position: 'relative'
                            }}
                          >
                            <span style={{ position: 'absolute', top: '-0.6rem', right: '0.5rem', background: 'var(--bg-secondary)', fontSize: '0.65rem', padding: '0.1rem 0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                              Match {m.matchIndex}
                            </span>

                            {editingMatchId === m.id ? (
                              <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <label htmlFor={`edit-score-t1-${m.id}`} style={{ fontSize: '0.85rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t1Name}</label>
                                  <input 
                                    id={`edit-score-t1-${m.id}`}
                                    type="number" 
                                    className="glass-input" 
                                    style={{ width: '50px', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }} 
                                    value={editScore1} 
                                    onChange={(e) => setEditScore1(Number(e.target.value))} 
                                  />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <label htmlFor={`edit-score-t2-${m.id}`} style={{ fontSize: '0.85rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t2Name}</label>
                                  <input 
                                    id={`edit-score-t2-${m.id}`}
                                    type="number" 
                                    className="glass-input" 
                                    style={{ width: '50px', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }} 
                                    value={editScore2} 
                                    onChange={(e) => setEditScore2(Number(e.target.value))} 
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                  <button 
                                    onClick={() => handleSaveMatchScore(m.id)} 
                                    className="btn btn-primary touch-target" 
                                    style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem' }}
                                    disabled={actionLoading}
                                  >
                                    Save
                                  </button>
                                  <button 
                                    onClick={() => setEditingMatchId(null)} 
                                    className="btn btn-outline touch-target" 
                                    style={{ padding: '0.3rem', fontSize: '0.75rem' }}
                                    aria-label="Cancel editing score"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Standard match slot rendering */
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.3rem' }}>
                                {/* Team 1 Slot */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {m.team1Id ? (
                                    <Link 
                                      href={`/teams/${m.team1Id}`}
                                      className="slide-in-right hover-cyan"
                                      style={{ 
                                        fontSize: '0.9rem', 
                                        fontWeight: isT1Winner ? 700 : 500,
                                        color: isT1Winner ? 'var(--accent-green)' : (m.winnerId && !isT1Winner ? 'var(--text-muted)' : 'var(--text-primary)'),
                                        maxWidth: '160px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textDecoration: 'none'
                                      }}
                                    >
                                      {t1Name}
                                    </Link>
                                  ) : (
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t1Name}</span>
                                  )}
                                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isT1Winner ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                    {m.score1}
                                  </span>
                                </div>
                                {/* Team 2 Slot */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {m.team2Id ? (
                                    <Link 
                                      href={`/teams/${m.team2Id}`}
                                      className="slide-in-right hover-cyan"
                                      style={{ 
                                        fontSize: '0.9rem', 
                                        fontWeight: isT2Winner ? 700 : 500,
                                        color: isT2Winner ? 'var(--accent-green)' : (m.winnerId && !isT2Winner ? 'var(--text-muted)' : 'var(--text-primary)'),
                                        maxWidth: '160px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textDecoration: 'none'
                                      }}
                                    >
                                      {t2Name}
                                    </Link>
                                  ) : (
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t2Name}</span>
                                  )}
                                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isT2Winner ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                    {m.score2}
                                  </span>
                                </div>

                                {/* Score update triggers for organizer */}
                                {isOrganizer && tournament.status === 'Active' && !m.winnerId && m.team1Id && m.team2Id && (
                                  <button 
                                    onClick={() => startEditMatch(m)}
                                    className="btn btn-outline touch-target"
                                    style={{ marginTop: '0.4rem', padding: '0.2rem', fontSize: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                                    aria-label={`Record score for match ${m.matchIndex} between ${t1Name} and ${t2Name}`}
                                  >
                                    <Edit3 size={10} /> Edit Score
                                  </button>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* CHAT DRAWER PANEL */}
      <div 
        className="glass-panel"
        style={{
          position: 'fixed',
          right: isChatExpanded ? '0' : '-350px',
          top: '4.5rem',
          height: 'calc(100vh - 4.5rem)',
          width: '350px',
          zIndex: 90,
          borderLeft: '1px solid hsla(186, 100%, 48%, 0.15)',
          borderRadius: '0',
          background: 'hsla(223, 20%, 5%, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'right 200ms ease',
          padding: '1.5rem',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Toggle handle button on left edge */}
        <button
          onClick={() => setIsChatExpanded(!isChatExpanded)}
          className="btn btn-outline"
          aria-label="Toggle tournament live chat shoutbox"
          aria-expanded={isChatExpanded}
          style={{
            position: 'absolute',
            left: '-48px',
            top: '50%',
            transform: 'translateY(-50%)',
            height: '48px',
            width: '48px',
            borderRadius: '8px 0 0 8px',
            borderRight: 'none',
            borderColor: 'hsla(186, 100%, 48%, 0.15)',
            background: 'var(--bg-primary)',
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '0'
          }}
        >
          <MessageSquare size={20} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
            <MessageSquare size={18} style={{ color: 'var(--accent-cyan)' }} />
            Tournament Shoutbox
          </h2>
          <button 
            onClick={() => setIsChatExpanded(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            aria-label="Close live chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat Content Body */}
        {!isChatEligible ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, textAlign: 'center', gap: '1rem', color: 'var(--text-muted)', padding: '1rem' }}>
            <AlertCircle size={32} />
            <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
              Chat unavailable.<br />Only registered tournament participants and organizers can access the live shoutbox.
            </p>
          </div>
        ) : (
          <>
            {/* Messages Scroll List */}
            <div 
              ref={chatContainerRef}
              aria-live="polite"
              style={{
                flexGrow: 1,
                overflowY: 'auto',
                paddingRight: '0.5rem',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              {chatLoading ? (
                // Skeletons
                [1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignSelf: n % 2 === 1 ? 'flex-start' : 'flex-end', width: '70%' }}>
                    <div className="skeleton-text" style={{ width: '40%', height: '10px' }} />
                    <div className="skeleton-text" style={{ width: '100%', height: '36px', borderRadius: '8px' }} />
                  </div>
                ))
              ) : messages.length > 0 ? (
                messages.map((msg) => {
                  const isMsgOrganizer = msg.senderId === tournament.organizerId;
                  const isCurrentUser = msg.senderId === user?.uid;
                  return (
                    <article 
                      key={msg.id} 
                      style={{
                        alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                      }}
                    >
                      {/* Meta header (Gamertag / Role badge) */}
                      <span style={{ 
                        fontSize: '0.7rem', 
                        color: isMsgOrganizer ? 'var(--accent-violet)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        alignSelf: isCurrentUser ? 'flex-end' : 'flex-start'
                      }}>
                        @{msg.senderGamertag}
                        {isMsgOrganizer && (
                          <span style={{ 
                            fontSize: '0.6rem', 
                            background: 'hsla(280, 80%, 55%, 0.15)', 
                            border: '1px solid var(--accent-violet)',
                            borderRadius: '3px',
                            padding: '0.05rem 0.2rem',
                            fontWeight: 600
                          }}>
                            HOST
                          </span>
                        )}
                      </span>

                      {/* Bubble */}
                      <div style={{
                        background: isCurrentUser 
                          ? 'hsla(186, 100%, 48%, 0.1)' 
                          : (isMsgOrganizer ? 'hsla(280, 80%, 55%, 0.1)' : 'var(--bg-secondary)'),
                        border: `1px solid ${
                          isCurrentUser 
                            ? 'hsla(186, 100%, 48%, 0.25)' 
                            : (isMsgOrganizer ? 'hsla(280, 80%, 55%, 0.25)' : 'var(--border-color)')
                        }`,
                        borderRadius: isCurrentUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
                        padding: '0.6rem 0.8rem',
                        fontSize: '0.85rem',
                        lineHeight: '1.4',
                        color: 'var(--text-primary)',
                        position: 'relative',
                        wordBreak: 'break-word'
                      }}>
                        {msg.text}
                        
                        {/* Moderator Delete */}
                        {isOrganizer && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            style={{
                              position: 'absolute',
                              right: '-1.5rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-red)',
                              cursor: 'pointer',
                              padding: '0',
                              opacity: 0.6
                            }}
                            title="Moderation Delete"
                            aria-label="Delete message"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem', fontStyle: 'italic' }}>
                  No messages yet. Send a shout!
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ flexGrow: 1, position: 'relative' }}>
                <label htmlFor="shoutbox-input" className="sr-only">Type your message</label>
                <input
                  id="shoutbox-input"
                  type="text"
                  className="glass-input"
                  placeholder="Type a shout..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  maxLength={500}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', height: '2.5rem' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                aria-label="Send message"
                disabled={!newMessageText.trim() || newMessageText.length > 500}
                style={{
                  height: '2.5rem',
                  width: '2.5rem',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
