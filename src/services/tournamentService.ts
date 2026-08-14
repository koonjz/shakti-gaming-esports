import { collection, onSnapshot, doc, query, orderBy, limit, Unsubscribe, writeBatch, getDoc, getDocs, updateDoc, setDoc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateRiotScore } from '@/lib/riotScoreCalculator';
import { achievementService } from '@/services/achievementService';

export interface Match {
  id: string; // m-r-idx (e.g. m-1-1)
  tournamentId: string;
  round: number;
  matchNumber: number; // position within the round (1-indexed)
  team1Id: string | null;
  team2Id: string | null;
  score1: number;
  score2: number;
  status: 'pending' | 'live' | 'completed';
  winnerId: string | null;
  updatedAt: number;
  discordUrl?: string | null;
  roomId?: string | null;
  roomPassword?: string | null;
  checkIn?: {
    team1CheckedIn: boolean;
    team2CheckedIn: boolean;
    checkInDeadline: number | null;
    disputed: boolean;
    disputeReason: string | null;
    disputedBy: string | null;
  } | null;
}

export interface Tournament {
  id: string;
  name: string;
  game: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  entryType?: 'Free' | 'Paid';
  maxTeams: number;
  registeredTeamIds: string[];
  organizerId?: string;
  createdAt: number;
  startDate?: number;
  roundDurationMins?: number;
  estimatedEndTime?: number;
  discordWebhookUrl?: string;
  discordBotEnabled?: boolean;
  minRiotScore?: number;  // Minimum avg team Riot Score required to register
  bracket?: {
    matches: any[];
  };
}

export const tournamentService = {
  /**
   * Real-time subscription for recent tournaments (e.g. Home Page)
   */
  subscribeRecentTournaments(max: number = 3, onUpdate: (tournaments: Tournament[]) => void, onError?: (err: unknown) => void): Unsubscribe {
    const q = query(
      collection(db, "tournaments"),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      onUpdate(list);
    }, (err) => {
      console.error("Error in subscribeRecentTournaments:", err);
      if (onError) onError(err);
    });
  },

  /**
   * Real-time subscription for all tournaments (e.g. Tournaments Arena Hub)
   */
  subscribeAllTournaments(onUpdate: (tournaments: Tournament[]) => void, onError?: (err: unknown) => void): Unsubscribe {
    const q = query(
      collection(db, "tournaments"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      onUpdate(list);
    }, (err) => {
      console.error("Error in subscribeAllTournaments:", err);
      if (onError) onError(err);
    });
  },

  /**
   * Real-time subscription for single tournament document
   */
  subscribeTournamentById(id: string, onUpdate: (tournament: Tournament | null) => void, onError?: (err: unknown) => void): Unsubscribe {
    const ref = doc(db, "tournaments", id);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        onUpdate({ id: snap.id, ...snap.data() } as Tournament);
      } else {
        onUpdate(null);
      }
    }, (err) => {
      console.error(`Error in subscribeTournamentById (${id}):`, err);
      if (onError) onError(err);
    });
  },

  /**
   * Real-time subscription for matches subcollection
   * Sorts the matches by round and matchNumber in memory to avoid index requirements.
   */
  subscribeMatches(tournamentId: string, onUpdate: (matches: Match[]) => void, onError?: (err: any) => void): Unsubscribe {
    const ref = collection(db, "tournaments", tournamentId, "matches");
    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      // Sort in memory by round and matchNumber
      list.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.matchNumber - b.matchNumber;
      });
      onUpdate(list);
    }, (err) => {
      console.error("Error subscribing to matches:", err);
      if (onError) onError(err);
    });
  },

  /**
   * Synchronizes the parent document's bracket.matches array with subcollection matches
   */
  async syncParentBracketMatches(tournamentId: string): Promise<void> {
    try {
      const matchesRef = collection(db, "tournaments", tournamentId, "matches");
      const matchesSnap = await getDocs(matchesRef);
      const list = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.matchNumber - b.matchNumber;
      });
      const tRef = doc(db, "tournaments", tournamentId);
      await updateDoc(tRef, { 'bracket.matches': list });
    } catch (err) {
      console.error("Failed to sync parent bracket matches:", err);
    }
  },

  /**
   * Updates custom match lobby room ID and password (Organizer / Admin only)
   */
  async updateMatchRoomDetails(tournamentId: string, matchId: string, roomId: string, roomPassword?: string): Promise<void> {
    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    await updateDoc(matchRef, {
      roomId: roomId.trim(),
      roomPassword: roomPassword ? roomPassword.trim() : null,
      updatedAt: Date.now()
    });
    await this.syncParentBracketMatches(tournamentId);
  },

  /**
   * Generates single-elimination brackets and creates match documents in the subcollection.
   * Seeds teams based on AVERAGE RIOT SCORE of team members, assigning BYEs to top seeds if team count is odd.
   * Riot Score = 1000 (base) + tier points + rank sub-division points + LP + (level × 5) + (wins × 10)
   */
  async generateBracket(tournamentId: string, teamIds: string[]): Promise<void> {
    return this._generateBracketInternal(tournamentId, teamIds, null);
  },

  /**
   * Generates bracket with a manually specified seed order (admin override).
   * orderedTeamIds[0] = #1 Seed, orderedTeamIds[1] = #2 Seed, etc.
   */
  async regenerateBracketWithCustomOrder(tournamentId: string, orderedTeamIds: string[]): Promise<void> {
    return this._generateBracketInternal(tournamentId, orderedTeamIds, orderedTeamIds);
  },

  /**
   * Resets the bracket: deletes all match subcollection docs, clears bracket.matches,
   * and resets the tournament status back to 'Upcoming'.
   */
  async resetBracket(tournamentId: string): Promise<void> {
    const tRef = doc(db, "tournaments", tournamentId);
    // Delete all match documents in subcollection
    try {
      const matchesRef = collection(db, "tournaments", tournamentId, "matches");
      const matchesSnap = await getDocs(matchesRef);
      const batch = writeBatch(db);
      matchesSnap.docs.forEach(d => batch.delete(d.ref));
      // Reset tournament document
      batch.update(tRef, {
        status: 'Upcoming',
        'bracket.matches': []
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to reset bracket:", err);
      throw err;
    }
  },

  /**
   * Computes the average Riot Score for a team based on all member profiles.
   * Uses calculateRiotScore(summonerLevel, tier, rank, lp, wins) per member.
   */
  async _computeTeamAvgRiotScore(teamId: string): Promise<number> {
    try {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      if (!teamDoc.exists()) return 0;
      const members: string[] = teamDoc.data().members || [];
      if (members.length === 0) return 0;

      let totalScore = 0;
      let memberCount = 0;
      for (const mUid of members) {
        const pDoc = await getDoc(doc(db, "profiles", mUid));
        if (pDoc.exists()) {
          const pData = pDoc.data();
          const summonerLevel: number = pData.riotStats?.summonerLevel || 30;
          const rankInfo = pData.riotStats?.rankInfo || {};
          const tier: string = rankInfo.tier || 'UNRANKED';
          const rank: string = rankInfo.rank || '';
          const lp: number = rankInfo.leaguePoints || 0;
          const wins: number = pData.stats?.wins || 0;
          totalScore += calculateRiotScore(summonerLevel, tier, rank, lp, wins);
          memberCount++;
        }
      }
      return memberCount > 0 ? Math.round(totalScore / memberCount) : 0;
    } catch (err) {
      console.error(`Error computing avg Riot Score for team ${teamId}:`, err);
      return 0;
    }
  },

  /**
   * Internal bracket generation — used by generateBracket and regenerateBracketWithCustomOrder.
   * If customOrderedTeamIds is provided, those are used directly (admin manual seed order).
   * Otherwise, teams are auto-sorted by descending average Riot Score.
   */
  async _generateBracketInternal(tournamentId: string, teamIds: string[], customOrderedTeamIds: string[] | null): Promise<void> {
    const tRef = doc(db, "tournaments", tournamentId);
    const tSnap = await getDoc(tRef);
    if (!tSnap.exists()) throw new Error("Tournament not found");
    const tData = tSnap.data() as Tournament;

    const numTeams = teamIds.length;
    if (numTeams < 1) throw new Error("At least 1 team is required to generate brackets.");

    // ── Special case: only 1 team registered → auto-winner ──────────
    if (numTeams === 1) {
      const winnerId = teamIds[0];
      const autoMatchId = 'm-1-1';
      const autoMatch = {
        id: autoMatchId,
        tournamentId,
        round: 1,
        matchNumber: 1,
        team1Id: winnerId,
        team2Id: null,
        score1: 1,
        score2: 0,
        status: 'completed',
        winnerId,
        updatedAt: Date.now(),
        checkIn: null,
        discordUrl: null,
        roomId: null,
        roomPassword: null,
      };
      const batch = writeBatch(db);
      const matchDocRef = doc(db, "tournaments", tournamentId, "matches", autoMatchId);
      batch.set(matchDocRef, autoMatch);
      batch.update(tRef, {
        status: 'Completed',
        winnerId,
        'bracket.matches': [autoMatch],
      });
      await batch.commit();
      return;
    }



    // Riot Score-based seeding: Fetch avg Riot Score for each team
    const teamScores: Array<{ id: string; score: number }> = [];
    for (const tId of teamIds) {
      const score = await this._computeTeamAvgRiotScore(tId);
      teamScores.push({ id: tId, score });
    }
    console.log('[BracketGen] Team Riot Score seeding:', teamScores.map(t => `${t.id}: ${t.score}`).join(', '));

    // Sort teams by avg Riot Score descending (#1 Seed = highest score)
    teamScores.sort((a, b) => b.score - a.score);
    // If admin provided a custom order, use that instead of auto-sort
    const sortedTeamIds = customOrderedTeamIds ?? teamScores.map(ts => ts.id);

    // Smallest power of 2 bracket size (e.g. 3 teams -> 4 slots, 5 teams -> 8 slots)
    const totalRounds = Math.max(1, Math.ceil(Math.log2(numTeams)));
    const bracketTeamsCount = Math.pow(2, totalRounds);

    const batch = writeBatch(db);
    const matchesMap: Record<string, Match> = {};

    // 1. Initialize all matches for totalRounds
    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = bracketTeamsCount / Math.pow(2, r);
      for (let idx = 1; idx <= matchesInRound; idx++) {
        const matchId = `m-${r}-${idx}`;
        matchesMap[matchId] = {
          id: matchId,
          tournamentId,
          round: r,
          matchNumber: idx,
          team1Id: null,
          team2Id: null,
          score1: 0,
          score2: 0,
          status: 'pending',
          winnerId: null,
          updatedAt: Date.now(),
          checkIn: null,
          discordUrl: null,
          roomId: null,
          roomPassword: null
        };
      }
    }

    // 2. Populate Round 1 team ids using history-seeded ordering (handles odd team counts smoothly)
    const matchesInRound1 = bracketTeamsCount / 2;
    for (let idx = 1; idx <= matchesInRound1; idx++) {
      const matchId = `m-1-${idx}`;
      const team1Index = (idx - 1) * 2;
      const team2Index = team1Index + 1;
      matchesMap[matchId].team1Id = sortedTeamIds[team1Index] || null;
      matchesMap[matchId].team2Id = sortedTeamIds[team2Index] || null;
    }

    // 3. Process matches round-by-round to auto-advance BYE winners
    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = bracketTeamsCount / Math.pow(2, r);
      for (let idx = 1; idx <= matchesInRound; idx++) {
        const matchId = `m-${r}-${idx}`;
        const match = matchesMap[matchId];

        if (r === 1) {
          if (match.team1Id && !match.team2Id) {
            // Team 1 gets a BYE
            match.winnerId = match.team1Id;
            match.status = 'completed';
            match.score1 = 1;
            match.score2 = 0;
          } else if (!match.team1Id && match.team2Id) {
            // Team 2 gets a BYE
            match.winnerId = match.team2Id;
            match.status = 'completed';
            match.score1 = 0;
            match.score2 = 1;
          } else if (match.team1Id && match.team2Id) {
            match.status = 'live';
            match.checkIn = {
              team1CheckedIn: false,
              team2CheckedIn: false,
              checkInDeadline: Date.now() + 10 * 60 * 1000,
              disputed: false,
              disputeReason: null,
              disputedBy: null
            };
          }
        } else {
          // If both slots populated in subsequent rounds, make it live
          if (match.team1Id && match.team2Id) {
            match.status = 'live';
            match.checkIn = {
              team1CheckedIn: false,
              team2CheckedIn: false,
              checkInDeadline: Date.now() + 10 * 60 * 1000,
              disputed: false,
              disputeReason: null,
              disputedBy: null
            };
          }
        }

        // Advance BYE winner in memory to next round
        if (match.status === 'completed' && match.winnerId && r < totalRounds) {
          const nextMatchId = `m-${r + 1}-${Math.ceil(idx / 2)}`;
          const nextMatch = matchesMap[nextMatchId];
          if (nextMatch) {
            if (idx % 2 === 1) {
              nextMatch.team1Id = match.winnerId;
            } else {
              nextMatch.team2Id = match.winnerId;
            }
          }
        }
      }
    }

    // 4. Save matches to subcollection
    for (const matchId in matchesMap) {
      const matchDocRef = doc(db, "tournaments", tournamentId, "matches", matchId);
      batch.set(matchDocRef, matchesMap[matchId]);
    }

    // 5. Update tournament status and bracket payload
    batch.update(tRef, {
      status: 'Active',
      'bracket.matches': Object.values(matchesMap)
    });

    await batch.commit();
  },

  /**
   * Updates scores, advances the bracket winner, awards XP / achievements, and posts history.
   */
  async updateMatchScore(tournamentId: string, matchId: string, score1: number, score2: number): Promise<void> {
    if (score1 === score2) throw new Error("Matches cannot end in a tie.");

    const tournamentRef = doc(db, "tournaments", tournamentId);
    const tSnap = await getDoc(tournamentRef);
    if (!tSnap.exists()) throw new Error("Tournament not found");
    const tData = tSnap.data() as Tournament;

    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    const mSnap = await getDoc(matchRef);
    if (!mSnap.exists()) throw new Error("Match not found");
    const mData = mSnap.data() as Match;

    const round = mData.round;
    const matchNumber = mData.matchNumber;
    const team1Id = mData.team1Id;
    const team2Id = mData.team2Id;

    const winnerId = score1 > score2 ? team1Id : team2Id;
    const loserId = score1 > score2 ? team2Id : team1Id;
    if (!winnerId) throw new Error("Winner cannot be determined.");

    const batch = writeBatch(db);

    // 1. Update Match to completed
    batch.update(matchRef, {
      score1,
      score2,
      status: 'completed',
      winnerId,
      updatedAt: Date.now(),
      "checkIn.checkInDeadline": null
    });

    const regCount = tData.registeredTeamIds?.length || tData.maxTeams || 4;
    const totalRounds = Math.max(1, Math.ceil(Math.log2(regCount)));

    // 2. Advance winner in bracket
    if (round < totalRounds) {
      const nextMatchNumber = Math.ceil(matchNumber / 2);
      const nextMatchId = `m-${round + 1}-${nextMatchNumber}`;
      const nextMatchRef = doc(db, "tournaments", tournamentId, "matches", nextMatchId);
      const nextMatchSnap = await getDoc(nextMatchRef);

      if (nextMatchSnap.exists()) {
        const nextMatchData = nextMatchSnap.data() as Match;
        const updates: any = {};
        
        if (matchNumber % 2 === 1) {
          updates.team1Id = winnerId;
        } else {
          updates.team2Id = winnerId;
        }

        const hasT1 = (matchNumber % 2 === 1) ? winnerId : nextMatchData.team1Id;
        const hasT2 = (matchNumber % 2 === 0) ? winnerId : nextMatchData.team2Id;

        if (hasT1 && hasT2) {
          updates.status = 'live';
          updates.checkIn = {
            team1CheckedIn: false,
            team2CheckedIn: false,
            checkInDeadline: Date.now() + 10 * 60 * 1000,
            disputed: false,
            disputeReason: null,
            disputedBy: null
          };
        }

        batch.update(nextMatchRef, updates);
      }
    } else {
      // Finals completed!
      batch.update(tournamentRef, {
        status: 'Completed'
      });

      // Award Undefeated Season
      if (winnerId) {
        try {
          const teamRef = doc(db, "teams", winnerId);
          const teamSnap = await getDoc(teamRef);
          if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            for (const memberUid of teamData.members) {
              const pRef = doc(db, "profiles", memberUid);
              const pSnap = await getDoc(pRef);
              if (pSnap.exists()) {
                const pData = pSnap.data();
                const achievements = pData.achievements || [];
                achievementService.unlockAchievement(memberUid, 'undefeated', achievements);
              }
            }
          }
        } catch (err) {
          console.error("Undefeated badge award failed:", err);
        }
      }
    }

    // 3. Update player stats, XP points and achievements
    try {
      const allMembersToNotify: string[] = [];
      const winnerMembers: string[] = [];
      const loserMembers: string[] = [];

      const fetchTeamMembers = async (tId: string | null, listDest: string[]) => {
        if (!tId) return;
        const snap = await getDoc(doc(db, "teams", tId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.members) {
            data.members.forEach((mId: string) => {
              listDest.push(mId);
              if (!allMembersToNotify.includes(mId)) {
                allMembersToNotify.push(mId);
              }
            });
          }
        }
      };

      await fetchTeamMembers(winnerId, winnerMembers);
      await fetchTeamMembers(loserId, loserMembers);

      // Winners
      for (const mUid of winnerMembers) {
        const pRef = doc(db, "profiles", mUid);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const pData = pSnap.data();
          const newWins = (pData.stats?.wins || 0) + 1;
          const summonerLevel = pData.riotStats?.summonerLevel || 30;
          const rankInfo = pData.riotStats?.rankInfo || {};
          const newPoints = calculateRiotScore(
            summonerLevel,
            rankInfo.tier || 'UNRANKED',
            rankInfo.rank || '',
            rankInfo.leaguePoints || 0,
            newWins
          );

          batch.update(pRef, {
            "stats.wins": newWins,
            "stats.points": newPoints,
            "stats.totalTournaments": (pData.stats?.totalTournaments || 0) + 1
          });

          achievementService.unlockAchievement(mUid, 'first_blood', pData.achievements || []);
        }
      }

      // Losers
      for (const mUid of loserMembers) {
        const pRef = doc(db, "profiles", mUid);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const pData = pSnap.data();
          batch.update(pRef, {
            "stats.losses": (pData.stats?.losses || 0) + 1,
            "stats.totalTournaments": (pData.stats?.totalTournaments || 0) + 1
          });
        }
      }

      // Fetch team names
      const getTeamName = async (tId: string | null) => {
        if (!tId) return 'TBD';
        const s = await getDoc(doc(db, "teams", tId));
        return s.exists() ? s.data().name : 'Team';
      };

      const t1Name = await getTeamName(team1Id);
      const t2Name = await getTeamName(team2Id);

      // Write Match History
      const historyRef = doc(collection(db, "matchHistory"));
      batch.set(historyRef, {
        matchId,
        tournamentId,
        tournamentName: tData.name,
        game: tData.game,
        team1Id: team1Id || '',
        team1Name: t1Name,
        team2Id: team2Id || '',
        team2Name: t2Name,
        score1,
        score2,
        winnerId,
        resolvedAt: serverTimestamp(),
        team1Members: team1Id === winnerId ? winnerMembers : loserMembers,
        team2Members: team2Id === winnerId ? winnerMembers : loserMembers,
        participantIds: [team1Id, team2Id, ...allMembersToNotify].filter(Boolean)
      });

      // Write Notifications
      allMembersToNotify.forEach((mUid) => {
        const nRef = doc(collection(db, "profiles", mUid, "notifications"));
        batch.set(nRef, {
          type: 'match_result',
          message: `Match resolved: ${t1Name} vs ${t2Name} in ${tData.name}.`,
          relatedId: tournamentId,
          read: false,
          createdAt: serverTimestamp()
        });
      });

    } catch (err) {
      console.error("Match stats/history logs failed:", err);
    }

    await batch.commit();
    await this.syncParentBracketMatches(tournamentId);
  },

  /**
   * Marks a team checked in for a match slot.
   */
  async checkInTeam(tournamentId: string, matchId: string, teamSlot: 'team1' | 'team2'): Promise<void> {
    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    const updates: any = {};
    if (teamSlot === 'team1') {
      updates['checkIn.team1CheckedIn'] = true;
    } else {
      updates['checkIn.team2CheckedIn'] = true;
    }
    await updateDoc(matchRef, updates);
    await this.syncParentBracketMatches(tournamentId);
  },

  /**
   * Flags a match dispute.
   */
  async flagDispute(tournamentId: string, matchId: string, teamName: string, reason: string): Promise<void> {
    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    await updateDoc(matchRef, {
      'checkIn.disputed': true,
      'checkIn.disputeReason': reason.trim(),
      'checkIn.disputedBy': teamName
    });
    await this.syncParentBracketMatches(tournamentId);
  },

  /**
   * Claims a forfeit win for a team slot.
   */
  async claimForfeitWin(tournamentId: string, matchId: string, winnerSlot: 'team1' | 'team2'): Promise<void> {
    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    const mSnap = await getDoc(matchRef);
    if (!mSnap.exists()) throw new Error("Match not found");
    const mData = mSnap.data() as Match;

    const winnerId = winnerSlot === 'team1' ? mData.team1Id : mData.team2Id;
    if (!winnerId) throw new Error("Winner team not present in slot.");

    const score1 = winnerSlot === 'team1' ? 1 : 0;
    const score2 = winnerSlot === 'team1' ? 0 : 1;

    await this.updateMatchScore(tournamentId, matchId, score1, score2);
  },

  /**
   * Resolves disputes via reset, clear, or declaring wins.
   */
  async resolveDispute(tournamentId: string, matchId: string, actionType: 'win_t1' | 'win_t2' | 'reset_timer' | 'clear'): Promise<void> {
    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    
    if (actionType === 'win_t1' || actionType === 'win_t2') {
      const slot = actionType === 'win_t1' ? 'team1' : 'team2';
      await this.claimForfeitWin(tournamentId, matchId, slot);
      return;
    }

    if (actionType === 'reset_timer') {
      await updateDoc(matchRef, {
        'checkIn.checkInDeadline': Date.now() + 10 * 60 * 1000,
        'checkIn.disputed': false,
        'checkIn.disputeReason': null,
        'checkIn.disputedBy': null
      });
    } else if (actionType === 'clear') {
      await updateDoc(matchRef, {
        'checkIn.disputed': false,
        'checkIn.disputeReason': null,
        'checkIn.disputedBy': null
      });
    }
    await this.syncParentBracketMatches(tournamentId);
  }
};
