'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
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
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  deleteDoc,
  writeBatch,
  documentId
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore, Team } from '@/store/useAppStore';
import { isAdmin } from '@/lib/adminConfig';
import { Trophy, Calendar, Shield, Users, Layers, Award, Loader, AlertCircle, Edit3, Save, Play, Check, X, MessageSquare, Send, Trash2, Bell, Clock, ShieldAlert, CheckCircle, Flame, RefreshCw, GripVertical, ChevronUp, ChevronDown, Settings } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { TournamentCountdown } from '@/components/TournamentCountdown';
import { calculateTournamentTimeWindow, checkPlayerTournamentOverlap, autoCheckTournamentStatus, useEffectiveTournamentStatus } from '@/lib/tournamentUtils';
import { achievementService } from '@/services/achievementService';
import { tournamentService } from '@/services/tournamentService';
import BracketView from '@/components/ui/BracketView';
import ShareButton from '@/components/ui/ShareButton';

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
  discordUrl?: string | null;
  checkIn?: {
    team1CheckedIn: boolean;
    team2CheckedIn: boolean;
    checkInDeadline: number | null;
    disputed: boolean;
    disputeReason: string | null;
    disputedBy: string | null;
  } | null;
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
  startDate?: number;
  roundDurationMins?: number;
  estimatedEndTime?: number;
  discordWebhookUrl?: string;
  discordBotEnabled?: boolean;
  minRiotScore?: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderGamertag: string;
  text: string;
  createdAt: unknown;
  teamId?: string | null;
}

export default function TournamentDetailClient({ id }: { id: string }) {
  const user = useAppStore((state) => state.user);
  const team = useAppStore((state) => state.team);
  const profile = useAppStore((state) => state.profile);
  const [mounted, setMounted] = useState(false);
  const userIsAdmin = isAdmin(user?.email);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tournament state loaded from Firestore snapshot
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teamsMap, setTeamsMap] = useState<Record<string, string>>({}); // id -> name
  
  // UI States
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Admin bracket management states
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [seedOrder, setSeedOrder] = useState<string[]>([]);
  const [seedScores, setSeedScores] = useState<Record<string, number>>({}); // teamId -> avg Riot Score
  const [seedScoresLoading, setSeedScoresLoading] = useState(false);
  const [useCustomOrder, setUseCustomOrder] = useState(false);

  // Discord integration status
  const [discordEnabled, setDiscordEnabled] = useState(false);

  // Time ticking state for real-time forfeit countdowns
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Subscribe to Tournament real-time updates & Teams metadata
  useEffect(() => {
    if (!id) return;

    let teamsUnsub: (() => void) | null = null;

    const unsub = onSnapshot(doc(db, "tournaments", id), (docSnap) => {
      if (docSnap.exists()) {
        const tData = { id: docSnap.id, ...docSnap.data() } as Tournament;
        setTournament(tData);
        setDiscordEnabled(tData.discordBotEnabled || false);
        
        // Real-time subscription for registered teams names & metadata
        if (tData.registeredTeamIds && tData.registeredTeamIds.length > 0) {
          if (teamsUnsub) teamsUnsub();
          const teamsRef = collection(db, "teams");
          const chunks = [];
          const idsCopy = [...tData.registeredTeamIds];
          while (idsCopy.length > 0) {
            chunks.push(idsCopy.splice(0, 30));
          }

          const tempMap: Record<string, string> = {};
          const unsubs: (() => void)[] = [];

          for (const chunk of chunks) {
            const qTeams = query(teamsRef, where(documentId(), "in", chunk));
            const u = onSnapshot(qTeams, (snap) => {
              snap.docs.forEach(d => {
                tempMap[d.id] = d.data().name;
              });
              setTeamsMap({ ...tempMap });
            }, (err) => {
              console.error("Error streaming tournament teams details:", err);
            });
            unsubs.push(u);
          }

          teamsUnsub = () => unsubs.forEach(fn => fn());
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

    return () => {
      unsub();
      if (teamsUnsub) teamsUnsub();
    };
  }, [id]);

  // Auto-check tournament and live match timeouts
  useEffect(() => {
    if (!tournament || tournament.status === 'Completed') return;

    autoCheckTournamentStatus(tournament);

    const timer = setInterval(() => {
      autoCheckTournamentStatus(tournament);
    }, 5000);

    return () => clearInterval(timer);
  }, [tournament]);

  const isOrganizer = tournament?.organizerId === user?.uid;
  // Admin = platform admin OR organizer for elevated bracket controls
  const isBracketAdmin = userIsAdmin || isOrganizer;
  const isParticipant = team && tournament?.registeredTeamIds?.includes(team.id);
  const isChatEligible = user && (isOrganizer || isParticipant || userIsAdmin);

  // ✅ FIX: useEffectiveTournamentStatus must be called HERE (before any early returns)
  // React Error #310 was caused by this hook being called after conditional returns.
  const effectiveStatus = useEffectiveTournamentStatus(tournament);

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
    if (!id || !isChatEligible) return;

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

    // ── Minimum Riot Score gate ──────────────────────────────────────
    if (tournament.minRiotScore && tournament.minRiotScore > 0) {
      setActionLoading(true);
      try {
        const teamAvgScore = await tournamentService._computeTeamAvgRiotScore(team.id);
        if (teamAvgScore < tournament.minRiotScore) {
          setError(`Registration REJECTED: Your team's average Riot Score is ${teamAvgScore.toLocaleString()} pts, but this tournament requires a minimum of ${tournament.minRiotScore.toLocaleString()} pts. Improve your team's Riot rankings to qualify.`);
          setActionLoading(false);
          return;
        }
      } catch {
        setError('Could not verify team Riot Score. Please try again.');
        setActionLoading(false);
        return;
      }
      setActionLoading(false);
    }

    setActionLoading(true);
    try {
      // Overlap Validation: Player can't participate in concurrent tournaments
      const tournamentsSnap = await getDocs(collection(db, "tournaments"));
      const allTournaments = tournamentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      
      const conflict = await checkPlayerTournamentOverlap(team.members || [], tournament, allTournaments);
      if (conflict.hasConflict) {
        setError(`Registration REJECTED: Team member @${conflict.conflictingPlayerGamertag} is already registered in tournament '${conflict.conflictingTournamentName}' running at the same time (${conflict.conflictTimeWindow}). A player cannot participate in multiple tournaments simultaneously.`);
        setActionLoading(false);
        return;
      }

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

  // Broadcast Announcement Notification (Organizer only)
  const handleBroadcastNotification = async () => {
    clearMessages();
    if (!tournament || !isOrganizer) return;

    const customMessage = window.prompt(
      "Send alert notification to ALL registered players in this tournament:",
      `Important update for ${tournament.name}: Tournament schedule is updated. Please check brackets!`
    );

    if (!customMessage || !customMessage.trim()) return;

    setActionLoading(true);
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

      if (membersToNotify.length === 0) {
        setError("No registered players found to notify.");
        setActionLoading(false);
        return;
      }

      const notifyBatch = writeBatch(db);
      membersToNotify.forEach((mUid) => {
        const nRef = doc(collection(db, "profiles", mUid, "notifications"));
        notifyBatch.set(nRef, {
          type: 'tournament_starting',
          message: customMessage.trim(),
          relatedId: tournament.id,
          read: false,
          createdAt: serverTimestamp()
        });
      });
      await notifyBatch.commit();
      setSuccess(`Notification broadcast successfully sent to ${membersToNotify.length} registered players!`);
    } catch (notifyErr) {
      console.error("Failed to broadcast notification:", notifyErr);
      setError("Failed to send broadcast notifications.");
    } finally {
      setActionLoading(false);
    }
  };
  // Discord integration channel creation helper
  const createDiscordLobbyForMatch = async (mId: string, t1Id: string | null, t2Id: string | null) => {
    if (!tournament) return null;
    const t1Name = t1Id ? (teamsMap[t1Id] || 'Team 1') : 'TBD';
    const t2Name = t2Id ? (teamsMap[t2Id] || 'Team 2') : 'TBD';
    try {
      const res = await fetch('/api/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_channel',
          matchId: mId,
          team1Name: t1Name,
          team2Name: t2Name,
          tournamentName: tournament.name
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.channelUrl || null;
      }
    } catch (err) {
      console.error("Error creating Discord channel:", err);
    }
    return null;
  };

  // Discord bracket announcement helper
  const postDiscordBracketUpdate = async (msg: string) => {
    try {
      await fetch('/api/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bracket_update',
          tournamentName: tournament?.name || 'Tournament',
          message: msg
        })
      });
    } catch (err) {
      console.error("Failed to post Discord bracket announcement:", err);
    }
  };

  // Toggle Discord Bot Lobbies integration
  const handleToggleDiscord = async (enabled: boolean) => {
    if (!tournament || !isOrganizer) return;
    setActionLoading(true);
    try {
      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        discordBotEnabled: enabled
      });
      setDiscordEnabled(enabled);
      setSuccess(`Discord Bot Lobbies ${enabled ? 'enabled' : 'disabled'}!`);
    } catch (err) {
      console.error(err);
      setError("Failed to update Discord settings.");
    } finally {
      setActionLoading(false);
    }
  };

  // Team check-in handler
  const handleCheckIn = async (matchId: string, teamSlot: 'team1' | 'team2') => {
    if (!tournament || !team) return;
    clearMessages();
    setActionLoading(true);

    try {
      const updatedMatches = [...tournament.bracket.matches];
      const matchIdx = updatedMatches.findIndex(m => m.id === matchId);
      if (matchIdx === -1) throw new Error("Match not found.");

      const match = { ...updatedMatches[matchIdx] };
      if (!match.checkIn) {
        match.checkIn = {
          team1CheckedIn: false,
          team2CheckedIn: false,
          checkInDeadline: Date.now() + 10 * 60 * 1000,
          disputed: false,
          disputeReason: null,
          disputedBy: null
        };
      }

      if (teamSlot === 'team1') {
        match.checkIn.team1CheckedIn = true;
      } else {
        match.checkIn.team2CheckedIn = true;
      }

      updatedMatches[matchIdx] = match;

      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        'bracket.matches': updatedMatches
      });

      setSuccess(`Successfully checked in for ${team.name}!`);
    } catch (err: any) {
      console.error("Failed to check in:", err);
      setError("Check-in action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Claim Forfeit Win handler
  const handleClaimForfeitWin = async (matchId: string, winnerSlot: 'team1' | 'team2') => {
    if (!tournament) return;
    clearMessages();
    setActionLoading(true);

    try {
      const updatedMatches = [...tournament.bracket.matches];
      const matchIdx = updatedMatches.findIndex(m => m.id === matchId);
      if (matchIdx === -1) throw new Error("Match not found.");

      const match = { ...updatedMatches[matchIdx] };
      const team1Name = match.team1Id ? (teamsMap[match.team1Id] || 'Team 1') : 'TBD';
      const team2Name = match.team2Id ? (teamsMap[match.team2Id] || 'Team 2') : 'TBD';

      if (winnerSlot === 'team1') {
        match.score1 = 1;
        match.score2 = 0;
        match.winnerId = match.team1Id;
      } else {
        match.score1 = 0;
        match.score2 = 1;
        match.winnerId = match.team2Id;
      }

      // Mark check-in state completed
      if (match.checkIn) {
        match.checkIn.checkInDeadline = null; // Clear deadline
      }

      updatedMatches[matchIdx] = match;

      const winnerId = match.winnerId;
      let nextMatchToCreateDiscord: Match | null = null;

      // Logic to advance the team to next match (same as handleSaveMatchScore)
      if (match.nextMatchId) {
        const nextIdx = updatedMatches.findIndex(m => m.id === match.nextMatchId);
        if (nextIdx !== -1) {
          const nextMatch = { ...updatedMatches[nextIdx] };
          
          if (match.matchIndex % 2 === 1) {
            nextMatch.team1Id = winnerId;
          } else {
            nextMatch.team2Id = winnerId;
          }

          // If both slots now ready, initialize check-in timer
          if (nextMatch.team1Id && nextMatch.team2Id) {
            nextMatch.checkIn = {
              team1CheckedIn: false,
              team2CheckedIn: false,
              checkInDeadline: Date.now() + 10 * 60 * 1000,
              disputed: false,
              disputeReason: null,
              disputedBy: null
            };
            nextMatchToCreateDiscord = nextMatch;
          }
          updatedMatches[nextIdx] = nextMatch;
        }
      } else {
        // Tournament completed!
        const tournamentRef = doc(db, "tournaments", tournament.id);
        await updateDoc(tournamentRef, {
          status: 'Completed'
        });

        // Award UNDEFEATED SEASON achievement to champion members
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
                  const achievements = pData.achievements || [];
                  await achievementService.unlockAchievement(memberUid, 'undefeated', achievements);
                }
              }
            }
          } catch (achievementErr) {
            console.error("Failed to award undefeated season badge:", achievementErr);
          }
        }
      }

      // Save to firebase
      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        'bracket.matches': updatedMatches
      });

      // Write match record and notify players
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

        const historyRef = doc(collection(db, "matchHistory"));
        const participantIds = [match.team1Id, match.team2Id, ...membersToNotify].filter(Boolean) as string[];

        const notifyBatch = writeBatch(db);
        
        notifyBatch.set(historyRef, {
          matchId: match.id,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          game: tournament.game,
          team1Id: match.team1Id || '',
          team1Name,
          team2Id: match.team2Id || '',
          team2Name,
          score1: match.score1,
          score2: match.score2,
          winnerId,
          resolvedAt: serverTimestamp(),
          team1Members,
          team2Members,
          participantIds,
          forfeited: true
        });

        membersToNotify.forEach((mUid) => {
          const nRef = doc(collection(db, "profiles", mUid, "notifications"));
          notifyBatch.set(nRef, {
            type: 'match_result',
            message: `Match forfeited: ${team1Name} vs ${team2Name} in ${tournament.name}. Result declared.`,
            relatedId: tournament.id,
            read: false,
            createdAt: serverTimestamp()
          });
        });
        
        await notifyBatch.commit();
      } catch (notifyErr) {
        console.error("Forfeit history log failed:", notifyErr);
      }

      // Post to discord
      if (discordEnabled) {
        const winningTeamName = winnerSlot === 'team1' ? team1Name : team2Name;
        const losingTeamName = winnerSlot === 'team1' ? team2Name : team1Name;
        await postDiscordBracketUpdate(`🏳️ **Forfeit declared!** Team **${losingTeamName}** failed to check in on time. **${winningTeamName}** claims the forfeit victory and advances!`);
      }

      // Unlock FIRST BLOOD achievement for winner team members
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
                const achievements = pData.achievements || [];
                await achievementService.unlockAchievement(memberUid, 'first_blood', achievements);
              }
            }
          }
        } catch (err) {
          console.error("Unlock achievement failed:", err);
        }
      }

      // If next match is ready, asynchronously create Discord lobby
      if (discordEnabled && nextMatchToCreateDiscord) {
        const channelUrl = await createDiscordLobbyForMatch(
          nextMatchToCreateDiscord.id, 
          nextMatchToCreateDiscord.team1Id, 
          nextMatchToCreateDiscord.team2Id
        );
        if (channelUrl) {
          const finalMatchesSnap = await getDoc(tournamentRef);
          if (finalMatchesSnap.exists()) {
            const finalMatches = finalMatchesSnap.data().bracket?.matches || [];
            const idxToUp = finalMatches.findIndex((m: any) => m.id === nextMatchToCreateDiscord!.id);
            if (idxToUp !== -1) {
              finalMatches[idxToUp].discordUrl = channelUrl;
              await updateDoc(tournamentRef, {
                'bracket.matches': finalMatches
              });
            }
          }
        }
      }

      setSuccess("Forfeit victory recorded and bracket advanced!");
    } catch (err: any) {
      console.error(err);
      setError("Failed to record forfeit win.");
    } finally {
      setActionLoading(false);
    }
  };

  // Flag Dispute handler
  const handleFlagDispute = async (matchId: string) => {
    if (!tournament || !team) return;
    const reason = window.prompt("Enter dispute details for the tournament admins/organizers:");
    if (!reason || !reason.trim()) return;

    clearMessages();
    setActionLoading(true);

    try {
      const updatedMatches = [...tournament.bracket.matches];
      const matchIdx = updatedMatches.findIndex(m => m.id === matchId);
      if (matchIdx === -1) throw new Error("Match not found.");

      const match = { ...updatedMatches[matchIdx] };
      if (!match.checkIn) {
        match.checkIn = {
          team1CheckedIn: false,
          team2CheckedIn: false,
          checkInDeadline: null,
          disputed: false,
          disputeReason: null,
          disputedBy: null
        };
      }

      match.checkIn.disputed = true;
      match.checkIn.disputeReason = reason.trim();
      match.checkIn.disputedBy = team.name;

      updatedMatches[matchIdx] = match;

      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        'bracket.matches': updatedMatches
      });

      // Post to discord
      if (discordEnabled) {
        await postDiscordBracketUpdate(`⚠️ **Dispute flagged!** Match ${match.matchIndex} has been flagged for dispute by **${team.name}**: "${reason.trim()}". Admins have been alerted.`);
      }

      setSuccess("Dispute successfully flagged. Tournament host has been notified.");
    } catch (err) {
      console.error("Error flagging dispute:", err);
      setError("Failed to flag dispute.");
    } finally {
      setActionLoading(false);
    }
  };

  // Admin Dispute resolver
  const handleResolveDispute = async (matchId: string, actionType: 'win_t1' | 'win_t2' | 'reset_timer' | 'clear') => {
    if (!tournament || !isOrganizer) return;
    clearMessages();
    setActionLoading(true);

    try {
      const updatedMatches = [...tournament.bracket.matches];
      const matchIdx = updatedMatches.findIndex(m => m.id === matchId);
      if (matchIdx === -1) throw new Error("Match not found.");

      const match = { ...updatedMatches[matchIdx] };

      if (actionType === 'win_t1' || actionType === 'win_t2') {
        const winnerSlot = actionType === 'win_t1' ? 'team1' : 'team2';
        setActionLoading(false);
        
        await handleClaimForfeitWin(matchId, winnerSlot);

        // Award COMEBACK KING badge to winning team members of a resolved dispute
        const winnerId = winnerSlot === 'team1' ? match.team1Id : match.team2Id;
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
                  await achievementService.unlockAchievement(memberUid, 'comeback_king', pData.achievements || []);
                }
              }
            }
          } catch (e) {
            console.error("Failed to unlock comeback king:", e);
          }
        }
        return;
      }

      if (actionType === 'reset_timer') {
        if (!match.checkIn) {
          match.checkIn = {
            team1CheckedIn: false,
            team2CheckedIn: false,
            checkInDeadline: Date.now() + 10 * 60 * 1000,
            disputed: false,
            disputeReason: null,
            disputedBy: null
          };
        } else {
          match.checkIn.checkInDeadline = Date.now() + 10 * 60 * 1000;
          match.checkIn.disputed = false;
          match.checkIn.disputeReason = null;
          match.checkIn.disputedBy = null;
        }
      } else if (actionType === 'clear') {
        if (match.checkIn) {
          match.checkIn.disputed = false;
          match.checkIn.disputeReason = null;
          match.checkIn.disputedBy = null;
        }
      }

      updatedMatches[matchIdx] = match;

      const tournamentRef = doc(db, "tournaments", tournament.id);
      await updateDoc(tournamentRef, {
        'bracket.matches': updatedMatches
      });

      // Post to discord
      if (discordEnabled) {
        await postDiscordBracketUpdate(`🛠️ **Dispute resolved!** Match ${match.matchIndex} dispute cleared by organizer. check-in timer reset to 10 minutes.`);
      }

      setSuccess("Dispute resolved successfully.");
    } catch (err) {
      console.error("Error resolving dispute:", err);
      setError("Failed to resolve dispute.");
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Brackets and Start Tournament (Organizer / Admin only)
  const handleStartTournament = async () => {
    clearMessages();
    if (!tournament) return;

    if (tournament.registeredTeamIds.length < 1) {
      setError("At least 1 team must register before generating brackets.");
      return;
    }

    setActionLoading(true);
    try {
      await tournamentService.generateBracket(tournament.id, tournament.registeredTeamIds);
      setSuccess("Brackets generated! Tournament is now Live. (Seeded by avg Riot Score)");
    } catch (err: any) {
      console.error("Error starting tournament:", err);
      setError(err.message || "Failed to start tournament brackets.");
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Load seed scores for all registered teams
  const handleLoadSeedScores = async () => {
    if (!tournament) return;
    setSeedScoresLoading(true);
    try {
      const scores: Record<string, number> = {};
      for (const tId of tournament.registeredTeamIds) {
        scores[tId] = await tournamentService._computeTeamAvgRiotScore(tId);
      }
      setSeedScores(scores);
      // Initialize seed order by descending Riot Score (auto-order)
      const sorted = [...tournament.registeredTeamIds].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
      setSeedOrder(sorted);
    } catch (err) {
      console.error("Failed to load seed scores:", err);
      setError("Failed to load Riot Score data for seeding.");
    } finally {
      setSeedScoresLoading(false);
    }
  };

  // Admin: Move a team up in seed order
  const handleMoveSeedUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...seedOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSeedOrder(next);
    setUseCustomOrder(true);
  };

  // Admin: Move a team down in seed order
  const handleMoveSeedDown = (idx: number) => {
    if (idx === seedOrder.length - 1) return;
    const next = [...seedOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSeedOrder(next);
    setUseCustomOrder(true);
  };

  // Admin: Reset bracket (wipe all matches, revert to Upcoming)
  const handleResetBracket = async () => {
    if (!tournament) return;
    if (!window.confirm('⚠️ ADMIN ACTION: This will DELETE all matches and reset the tournament to Upcoming. Are you sure?')) return;
    clearMessages();
    setActionLoading(true);
    try {
      await tournamentService.resetBracket(tournament.id);
      setSuccess('Bracket reset successfully. Tournament is now Upcoming.');
      setShowAdminPanel(false);
      setSeedOrder([]);
      setSeedScores({});
    } catch (err: any) {
      console.error('Failed to reset bracket:', err);
      setError(err.message || 'Failed to reset bracket.');
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Generate bracket with current seed order (custom or auto)
  const handleGenerateWithSeedOrder = async () => {
    if (!tournament || seedOrder.length < 2) {
      setError('Load seed scores first and ensure at least 2 teams are registered.');
      return;
    }
    if (!window.confirm(`Generate bracket with ${useCustomOrder ? 'CUSTOM' : 'AUTO Riot Score'} seed order? This will start the tournament.`)) return;
    clearMessages();
    setActionLoading(true);
    try {
      if (useCustomOrder) {
        await tournamentService.regenerateBracketWithCustomOrder(tournament.id, seedOrder);
        setSuccess('Bracket generated with custom seed order! Tournament is now Live.');
      } else {
        await tournamentService.generateBracket(tournament.id, seedOrder);
        setSuccess('Bracket generated with Riot Score seeding! Tournament is now Live.');
      }
      setShowAdminPanel(false);
    } catch (err: any) {
      console.error('Failed to generate bracket:', err);
      setError(err.message || 'Failed to generate bracket.');
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
      if (match.checkIn) {
        match.checkIn.checkInDeadline = null; // Clear check-in deadline
      }
      updatedMatches[matchIdx] = match;

      let nextMatchToCreateDiscord: Match | null = null;

      if (match.nextMatchId) {
        const nextIdx = updatedMatches.findIndex(m => m.id === match.nextMatchId);
        if (nextIdx !== -1) {
          const nextMatch = { ...updatedMatches[nextIdx] };
          
          if (match.matchIndex % 2 === 1) {
            nextMatch.team1Id = winnerId;
          } else {
            nextMatch.team2Id = winnerId;
          }

          // If next match is now ready, initialize check-in
          if (nextMatch.team1Id && nextMatch.team2Id) {
            nextMatch.checkIn = {
              team1CheckedIn: false,
              team2CheckedIn: false,
              checkInDeadline: Date.now() + 10 * 60 * 1000,
              disputed: false,
              disputeReason: null,
              disputedBy: null
            };
            nextMatchToCreateDiscord = nextMatch;
          }

          updatedMatches[nextIdx] = nextMatch;
        }
      } else {
        const tournamentRef = doc(db, "tournaments", tournament.id);
        await updateDoc(tournamentRef, {
          status: 'Completed'
        });

        // Award UNDEFEATED SEASON achievement to champion members
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
                  await achievementService.unlockAchievement(memberUid, 'undefeated', pData.achievements || []);
                }
              }
            }
          } catch (achievementErr) {
            console.error("Failed to award undefeated season badge:", achievementErr);
          }
        }

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
        
        // 1. Write the Match History log
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

      // Post match result update to Discord
      if (discordEnabled) {
        const t1Name = match.team1Id ? (teamsMap[match.team1Id] || 'T1') : 'T1';
        const t2Name = match.team2Id ? (teamsMap[match.team2Id] || 'T2') : 'T2';
        const winnerName = winnerId === match.team1Id ? t1Name : t2Name;
        await postDiscordBracketUpdate(`⚔️ **Match Complete!** **${t1Name}** [${editScore1}] vs [${editScore2}] **${t2Name}** in **${tournament.name}**. Winner: **${winnerName}**!`);
        
        if (!match.nextMatchId) {
          await postDiscordBracketUpdate(`🏆 **Championship Complete!** Team **${winnerName}** has won the **${tournament.name}** tournament! Congratulations Champions! 👑`);
        }
      }

      // Check and unlock FIRST BLOOD achievement for winning team members
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
                await achievementService.unlockAchievement(memberUid, 'first_blood', pData.achievements || []);
              }
            }
          }
        } catch (achievementErr) {
          console.error("Failed to unlock first blood:", achievementErr);
        }
      }

      // If next match is ready, asynchronously create Discord lobby
      if (discordEnabled && nextMatchToCreateDiscord) {
        const channelUrl = await createDiscordLobbyForMatch(
          nextMatchToCreateDiscord.id, 
          nextMatchToCreateDiscord.team1Id, 
          nextMatchToCreateDiscord.team2Id
        );
        if (channelUrl) {
          const finalMatchesSnap = await getDoc(tournamentRef);
          if (finalMatchesSnap.exists()) {
            const finalMatches = finalMatchesSnap.data().bracket?.matches || [];
            const idxToUp = finalMatches.findIndex((m: any) => m.id === nextMatchToCreateDiscord!.id);
            if (idxToUp !== -1) {
              finalMatches[idxToUp].discordUrl = channelUrl;
              await updateDoc(tournamentRef, {
                'bracket.matches': finalMatches
              });
            }
          }
        }
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
      <main style={{ display: 'flex', minHeight: 'calc(100vh - 4.5rem)', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div className="glass-panel" style={{ 
          padding: '3rem 2.5rem', 
          maxWidth: '520px', 
          textAlign: 'center',
          border: '1px solid rgba(255, 42, 109, 0.4)',
          background: 'radial-gradient(circle at center, rgba(255, 42, 109, 0.08) 0%, rgba(6, 12, 28, 0.95) 100%)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(255, 42, 109, 0.15)', border: '1px solid var(--accent-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem auto', color: 'var(--accent-red)'
          }}>
            <AlertCircle size={36} />
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.75rem', textTransform: 'uppercase' }}>
            Tournament Unavailable
          </h1>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6, fontSize: '0.98rem' }}>
            {error || `The tournament bracket ID "${id}" could not be located in our live Firestore database. It may have been archived, removed, or the link is invalid.`}
          </p>

          <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2rem', fontFamily: 'monospace' }}>
            Target ID: {id}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/tournaments" style={{ flex: '1 1 180px' }}>
              <Button variant="primary" style={{ width: '100%', justifyContent: 'center', borderRadius: '9999px', padding: '0.8rem 1.5rem' }}>
                Browse All Arenas
              </Button>
            </Link>
            <Link href="/" style={{ flex: '1 1 140px' }}>
              <Button variant="outline" style={{ width: '100%', justifyContent: 'center', borderRadius: '9999px', padding: '0.8rem 1.5rem' }}>
                Return Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isRegistered = team && tournament.registeredTeamIds.includes(team.id);
  // effectiveStatus is already computed at the top of the component (before any early returns) to fix React Error #310

  const matchesByRound: Record<number, Match[]> = {};
  if (tournament.bracket?.matches) {
    tournament.bracket.matches.forEach(m => {
      if (!matchesByRound[m.round]) {
        matchesByRound[m.round] = [];
      }
      matchesByRound[m.round].push(m);
    });
  }

  // FIX: Use Math.ceil(Math.log2(...)) to always get an integer round count
  const roundsCount = Math.max(1, Math.ceil(Math.log2(Math.max(tournament.maxTeams, 2))));
  const roundsArray = Array.from({ length: roundsCount }, (_, i) => i + 1);

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '7.5rem 1.5rem 4rem 1.5rem' }}>
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Top Info Panel */}
        <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <span className={`badge ${
                  effectiveStatus === 'Upcoming' ? 'badge-cyan' :
                  effectiveStatus === 'Active' ? 'badge-violet' : 'badge-gold'
                }`}>
                  {effectiveStatus === 'Active' ? 'Live' : effectiveStatus}
                  {effectiveStatus === 'Upcoming' && (
                    <span 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        backgroundColor: '#00ff88', 
                        boxShadow: '0 0 8px #00ff88',
                        display: 'inline-block',
                        marginLeft: '0.4rem',
                        verticalAlign: 'middle'
                      }} 
                      aria-hidden="true" 
                    />
                  )}
                </span>
                <span className="badge badge-cyan">{tournament.game}</span>
                <span className="badge badge-violet">{tournament.entryType} Entry</span>
              </div>

              <h1 style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>{tournament.name}</h1>
              
              <div style={{ marginBottom: '1rem' }}>
                <TournamentCountdown tournament={tournament} showDetails={true} />
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Bracket capacity: <strong>{tournament.registeredTeamIds.length} / {tournament.maxTeams}</strong> rosters registered.
              </p>
              {tournament.minRiotScore && tournament.minRiotScore > 0 && (
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginTop: '0.4rem' }}>
                  <span style={{ padding: '0.2rem 0.65rem', borderRadius: '9999px', background: 'rgba(255, 200, 0, 0.12)', border: '1px solid rgba(255, 200, 0, 0.35)', color: 'var(--accent-gold)', fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ⚡ Min Riot Score: {tournament.minRiotScore.toLocaleString()} pts required
                  </span>
                </p>
              )}
            </div>

            {/* Registration / Start / Broadcast / Share Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <ShareButton
                  title={tournament.name}
                  description={`${tournament.game} • ${effectiveStatus} • ${tournament.registeredTeamIds.length}/${tournament.maxTeams} teams`}
                />
                {isOrganizer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      💬 Discord Integration
                    </span>
                    <input 
                      type="checkbox" 
                      id="discord-bot-toggle"
                      checked={discordEnabled}
                      onChange={(e) => handleToggleDiscord(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-cyan)' }}
                      disabled={actionLoading}
                    />
                  </div>
                )}
                {effectiveStatus === 'Upcoming' && (
                  <>
                    {isOrganizer ? (
                      <button 
                        onClick={handleStartTournament}
                        className="btn btn-primary"
                        disabled={actionLoading || tournament.registeredTeamIds.length < 1}
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

              {/* Organizer Broadcast Notification Action */}
              {isBracketAdmin && tournament.registeredTeamIds.length > 0 && (
                <button
                  onClick={handleBroadcastNotification}
                  className="btn btn-outline"
                  disabled={actionLoading}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Bell size={14} style={{ color: 'var(--accent-cyan)' }} /> Notify All Registered Players
                </button>
              )}

              {/* Admin Panel Toggle */}
              {isBracketAdmin && (
                <button
                  onClick={() => setShowAdminPanel(v => !v)}
                  className="btn btn-outline"
                  disabled={actionLoading}
                  style={{
                    fontSize: '0.82rem',
                    padding: '0.4rem 0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderColor: showAdminPanel ? 'var(--accent-violet)' : 'var(--border-color)',
                    color: showAdminPanel ? 'var(--accent-violet)' : 'var(--text-secondary)',
                    background: showAdminPanel ? 'hsla(280,80%,55%,0.08)' : 'transparent'
                  }}
                >
                  <Settings size={14} /> {showAdminPanel ? 'Hide' : 'Show'} Admin Controls
                </button>
              )}
            </div>
          </div>

          {/* Round Duration Schedule Timetable */}
          {(() => {
            const timeWindow = calculateTournamentTimeWindow(tournament);
            return (
              <div style={{ 
                marginTop: '1.5rem', 
                paddingTop: '1.5rem', 
                borderTop: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={14} /> Total Allocated Duration
                  </div>
                  <strong style={{ color: 'var(--accent-cyan)' }}>
                    {timeWindow.totalRounds * timeWindow.roundDurationMins} minutes ({timeWindow.totalRounds} Rounds $\times$ {timeWindow.roundDurationMins}m min)
                  </strong>
                </div>

                {timeWindow.roundSchedules.map((rs) => (
                  <div key={rs.round} style={{ fontSize: '0.8rem', background: 'hsla(0, 0%, 100%, 0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                      Round {rs.round} (45m min)
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {new Date(rs.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(rs.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ============================
            ADMIN BRACKET MANAGEMENT PANEL
            ============================ */}
        {isBracketAdmin && showAdminPanel && (
          <div
            className="glass-panel"
            style={{
              marginBottom: '1.5rem',
              padding: '1.75rem',
              border: '1px solid hsla(280, 80%, 55%, 0.35)',
              background: 'hsla(280, 80%, 10%, 0.18)',
              boxShadow: '0 0 30px hsla(280, 80%, 55%, 0.06)'
            }}
          >
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-violet)', margin: 0 }}>
                <Settings size={18} /> Admin Bracket Controls
                {userIsAdmin && (
                  <span style={{ fontSize: '0.65rem', background: 'hsla(280,80%,55%,0.2)', border: '1px solid var(--accent-violet)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontWeight: 700, verticalAlign: 'middle' }}>PLATFORM ADMIN</span>
                )}
              </h3>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {/* Reset Bracket */}
                <button
                  onClick={handleResetBracket}
                  className="btn btn-outline"
                  disabled={actionLoading || tournament.status === 'Upcoming'}
                  style={{
                    fontSize: '0.8rem', padding: '0.45rem 0.9rem',
                    borderColor: 'var(--accent-red)', color: 'var(--accent-red)',
                    display: 'flex', alignItems: 'center', gap: '0.35rem'
                  }}
                  title="Deletes all matches and resets tournament to Upcoming"
                >
                  <RefreshCw size={13} /> Reset Bracket
                </button>
              </div>
            </div>

            {/* Seed Order Editor */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                  📊 Team Seed Order (by Avg Riot Score) — drag teams up/down to set custom seeding before generating the bracket.
                </p>
                <button
                  onClick={handleLoadSeedScores}
                  className="btn btn-outline"
                  disabled={seedScoresLoading || actionLoading || tournament.registeredTeamIds.length < 2}
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                >
                  {seedScoresLoading ? <Loader size={13} className="animate-spin" /> : <Shield size={13} />}
                  {seedScoresLoading ? 'Loading Scores...' : 'Load Riot Scores'}
                </button>
              </div>

              {/* Seed list */}
              {seedOrder.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {seedOrder.map((tId, idx) => (
                    <div
                      key={tId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: idx === 0
                          ? 'hsla(51, 100%, 50%, 0.06)'
                          : idx === 1
                          ? 'hsla(186, 100%, 48%, 0.05)'
                          : 'hsla(0, 0%, 100%, 0.02)',
                        border: `1px solid ${
                          idx === 0 ? 'hsla(51,100%,50%,0.25)'
                          : idx === 1 ? 'hsla(186,100%,48%,0.2)'
                          : 'var(--border-color)'
                        }`,
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem'
                      }}
                    >
                      {/* Seed Badge */}
                      <span style={{
                        minWidth: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        background: idx === 0
                          ? 'hsla(51, 100%, 50%, 0.2)'
                          : idx === 1
                          ? 'hsla(186, 100%, 48%, 0.15)'
                          : 'var(--bg-secondary)',
                        color: idx === 0 ? 'var(--accent-gold)' : idx === 1 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        border: '1px solid currentColor'
                      }}>
                        #{idx + 1}
                      </span>

                      {/* Team name */}
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {teamsMap[tId] || tId}
                      </span>

                      {/* Riot Score badge */}
                      {seedScores[tId] !== undefined && (
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'hsla(186, 100%, 48%, 0.08)',
                          border: '1px solid hsla(186, 100%, 48%, 0.2)',
                          borderRadius: '6px',
                          padding: '0.2rem 0.5rem',
                          color: 'var(--accent-cyan)',
                          fontFamily: 'monospace',
                          fontWeight: 700
                        }}>
                          ⚡ {seedScores[tId].toLocaleString()} RS
                        </span>
                      )}

                      {/* Up/Down controls */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <button
                          onClick={() => handleMoveSeedUp(idx)}
                          disabled={idx === 0 || actionLoading}
                          style={{
                            background: 'none', border: '1px solid var(--border-color)',
                            color: idx === 0 ? 'var(--text-muted)' : 'var(--accent-violet)',
                            borderRadius: '4px', padding: '0.1rem 0.25rem', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                            opacity: idx === 0 ? 0.3 : 1, lineHeight: 1
                          }}
                          title="Move up (higher seed)"
                          aria-label="Move team up in seed order"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => handleMoveSeedDown(idx)}
                          disabled={idx === seedOrder.length - 1 || actionLoading}
                          style={{
                            background: 'none', border: '1px solid var(--border-color)',
                            color: idx === seedOrder.length - 1 ? 'var(--text-muted)' : 'var(--accent-violet)',
                            borderRadius: '4px', padding: '0.1rem 0.25rem',
                            cursor: idx === seedOrder.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: idx === seedOrder.length - 1 ? 0.3 : 1, lineHeight: 1
                          }}
                          title="Move down (lower seed)"
                          aria-label="Move team down in seed order"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center', padding: '1.5rem',
                  border: '1px dashed var(--border-color)', borderRadius: '8px',
                  color: 'var(--text-muted)', fontSize: '0.88rem'
                }}>
                  {tournament.registeredTeamIds.length < 2
                    ? 'At least 2 teams must be registered before loading seed scores.'
                    : 'Click "Load Riot Scores" to fetch team Riot Score data and preview the seed order.'}
                </div>
              )}
            </div>

            {/* Custom order info banner */}
            {useCustomOrder && seedOrder.length > 0 && (
              <div style={{
                padding: '0.6rem 1rem',
                background: 'hsla(51, 100%, 50%, 0.07)',
                border: '1px solid hsla(51, 100%, 50%, 0.25)',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.82rem',
                color: 'var(--accent-gold)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <GripVertical size={14} />
                Custom seed order is active — bracket will use the order shown above instead of auto Riot Score ranking.
                <button
                  onClick={() => { setUseCustomOrder(false); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline' }}
                >
                  Reset to Auto
                </button>
              </div>
            )}

            {/* Generate Bracket button */}
            {seedOrder.length >= 2 && (
              <button
                onClick={handleGenerateWithSeedOrder}
                className="btn btn-primary"
                disabled={actionLoading}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, var(--accent-violet) 0%, hsl(280, 80%, 55%) 100%)',
                  boxShadow: 'var(--glow-violet)',
                  fontSize: '0.9rem',
                  padding: '0.65rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Play size={16} />
                Generate Bracket {useCustomOrder ? '(Custom Seed Order)' : '(Auto Riot Score Seeding)'}
              </button>
            )}
          </div>
        )}

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

          {(effectiveStatus === 'Upcoming' && !tournament.bracket?.matches?.length) ? (
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
            <BracketView
              tournamentId={tournament.id}
              organizerId={tournament.organizerId}
              maxTeams={tournament.maxTeams}
              registeredTeamIds={tournament.registeredTeamIds}
              teamsMap={teamsMap}
              userUid={user?.uid}
              team={team}
              isAdminUser={userIsAdmin}
              actionLoading={actionLoading}
              setActionLoading={setActionLoading}
              setError={setError}
              setSuccess={setSuccess}
            />
          )}
        </div>

      </div>

      {/* CHAT DRAWER PANEL (Rendered outside transform element to fix position:fixed scrolling bug) */}
      {mounted && typeof document !== 'undefined' ? createPortal(
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
            borderColor: 'var(--border-color)',
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
      </div>,
      document.body
    ) : null}
    </main>
  );
}
