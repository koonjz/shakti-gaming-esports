'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { tournamentService, Match } from '@/services/tournamentService';
import { Trophy, Shield, Edit3, Check, X, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface BracketViewProps {
  tournamentId: string;
  organizerId: string | undefined;
  maxTeams: number;
  registeredTeamIds: string[];
  teamsMap: Record<string, string>;
  userUid: string | null | undefined;
  team: any; // Logged-in user's team from store
  isAdminUser?: boolean; // Platform admin (can edit scores even if not organizer)
  actionLoading: boolean;
  setActionLoading: (loading: boolean) => void;
  setError: (err: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function BracketView({
  tournamentId,
  organizerId,
  maxTeams,
  registeredTeamIds,
  teamsMap,
  userUid,
  team,
  isAdminUser = false,
  actionLoading,
  setActionLoading,
  setError,
  setSuccess
}: BracketViewProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Edit match score states
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editScore1, setEditScore1] = useState(0);
  const [editScore2, setEditScore2] = useState(0);
  const [riotIdInput, setRiotIdInput] = useState('');
  const [fetchingRiotScore, setFetchingRiotScore] = useState(false);
  const [riotScoreInfo, setRiotScoreInfo] = useState<string | null>(null);

  // Edit match room credentials states (Organizer/Admin)
  const [editingRoomMatchId, setEditingRoomMatchId] = useState<string | null>(null);
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputRoomPassword, setInputRoomPassword] = useState('');

  const handleSaveRoomDetails = async (matchId: string) => {
    setError(null);
    setSuccess(null);
    if (!inputRoomId.trim()) {
      setError("Please enter a valid Room ID.");
      return;
    }
    setActionLoading(true);
    try {
      await tournamentService.updateMatchRoomDetails(tournamentId, matchId, inputRoomId, inputRoomPassword);
      setSuccess("Custom Match Lobby Credentials saved!");
      setEditingRoomMatchId(null);
    } catch (err: any) {
      console.error(err);
      setError("Failed to save room details.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFetchScoreByRiotId = async () => {
    if (!riotIdInput.trim() || !riotIdInput.includes('#')) {
      setError("Please enter a valid Riot ID format (e.g. Tarik#NA1 or Singh#IND).");
      return;
    }
    setFetchingRiotScore(true);
    setRiotScoreInfo(null);
    setError(null);

    try {
      const res = await fetch(`/api/game-stats?riotId=${encodeURIComponent(riotIdInput.trim())}&action=matchScore`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch Riot ID match score.");
      }

      setEditScore1(data.score1);
      setEditScore2(data.score2);
      setRiotScoreInfo(`Riot ID (@${data.riotId}) Live Score: ${data.score1} - ${data.score2} (${data.map || 'Match'})`);
      setSuccess(`Fetched live match result for ${data.riotId}: ${data.score1}-${data.score2}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to query Riot match score.");
    } finally {
      setFetchingRiotScore(false);
    }
  };

  // Auto ticking timer for forfeit countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time subscription to matches
  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    const unsub = tournamentService.subscribeMatches(
      tournamentId,
      (list) => {
        setMatches(list);
        setLoading(false);
      },
      (err) => {
        console.error("Bracket matches subscription error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tournamentId]);

  const isOrganizer = userUid === organizerId || isAdminUser;

  const handleSaveScore = async (matchId: string) => {
    setError(null);
    setSuccess(null);
    if (editScore1 === editScore2) {
      setError("Matches cannot end in a tie. Please adjust scores.");
      return;
    }
    setActionLoading(true);
    try {
      await tournamentService.updateMatchScore(tournamentId, matchId, editScore1, editScore2);
      setSuccess("Match score updated and bracket advanced!");
      setEditingMatchId(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update match score.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async (matchId: string, slot: 'team1' | 'team2') => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    try {
      await tournamentService.checkInTeam(tournamentId, matchId, slot);
      setSuccess("Successfully checked in!");
    } catch (err: any) {
      console.error(err);
      setError("Check-in failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaimForfeit = async (matchId: string, slot: 'team1' | 'team2') => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    try {
      await tournamentService.claimForfeitWin(tournamentId, matchId, slot);
      setSuccess("Forfeit victory recorded and bracket advanced!");
    } catch (err: any) {
      console.error(err);
      setError("Failed to claim forfeit win.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispute = async (matchId: string) => {
    setError(null);
    setSuccess(null);
    const reason = window.prompt("Enter dispute details for the tournament organizers:");
    if (!reason || !reason.trim()) return;

    setActionLoading(true);
    try {
      const teamName = team?.name || "Participant";
      await tournamentService.flagDispute(tournamentId, matchId, teamName, reason);
      setSuccess("Dispute flagged successfully. The organizer has been alerted.");
    } catch (err: any) {
      console.error(err);
      setError("Failed to flag dispute.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveDispute = async (matchId: string, type: 'win_t1' | 'win_t2' | 'reset_timer' | 'clear') => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    try {
      await tournamentService.resolveDispute(tournamentId, matchId, type);
      setSuccess("Dispute resolved successfully.");
    } catch (err: any) {
      console.error(err);
      setError("Failed to resolve dispute.");
    } finally {
      setActionLoading(false);
    }
  };

  // Group matches by round
  const matchesByRound: Record<number, Match[]> = {};
  matches.forEach((m) => {
    if (!matchesByRound[m.round]) {
      matchesByRound[m.round] = [];
    }
    matchesByRound[m.round].push(m);
  });

  const maxRoundInMatches = matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 0;
  // FIX: Math.ceil ensures we always get an integer for non-power-of-2 team counts
  const roundsCount = maxRoundInMatches > 0 
    ? maxRoundInMatches 
    : Math.max(1, Math.ceil(Math.log2(Math.max(registeredTeamIds.length || maxTeams || 4, 2))));
  const roundsArray = Array.from({ length: roundsCount }, (_, i) => i + 1);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Clock className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--accent-cyan)' }} />
        <p>Loading tournament brackets...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
        <Trophy size={48} style={{ opacity: 0.25, margin: '0 auto 1rem auto' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Bracket Pending Launch</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '400px', margin: '0 auto' }}>
          Brackets will generate and show here once the organizer starts the tournament or the start date is reached. Currently waiting for team registrations.
        </p>

        {/* Roster overview */}
        <div style={{ marginTop: '2rem', maxWidth: '360px', margin: '2rem auto 0 auto' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Registered Rosters ({registeredTeamIds.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {registeredTeamIds.map((tId) => (
              <div key={tId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.9rem', justifyContent: 'center' }}>
                <Shield size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>{teamsMap[tId] || 'Roster Loading...'}</span>
              </div>
            ))}
            {registeredTeamIds.length === 0 && (
              <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No teams registered yet.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '2.5rem', minWidth: '800px', padding: '1rem 0' }}>
      {roundsArray.map((rNum) => {
        const roundMatches = matchesByRound[rNum] || [];
        const roundTitle = rNum === roundsCount ? "Championship Finals" : 
                           rNum === roundsCount - 1 ? "Semifinals" : `Round ${rNum}`;
        
        return (
          <div key={rNum} style={{ display: 'flex', flexDirection: 'column', width: '280px', flexShrink: 0 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontFamily: 'var(--font-title)' }}>
              {roundTitle}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', flexGrow: 1, gap: '2rem' }}>
              {roundMatches.map((m) => {
                const isByeMatch = m.status === 'completed' && (!m.team1Id || !m.team2Id);
                const t1Name = m.team1Id ? (teamsMap[m.team1Id] || 'Team Roster') : (isByeMatch && !m.team1Id ? 'BYE (Auto-Advance)' : 'TBD');
                const t2Name = m.team2Id ? (teamsMap[m.team2Id] || 'Team Roster') : (isByeMatch && !m.team2Id ? 'BYE (Auto-Advance)' : 'TBD');
                const isT1Winner = m.winnerId && m.winnerId === m.team1Id;
                const isT2Winner = m.winnerId && m.winnerId === m.team2Id;

                // Check-in helper variables
                const checkInObj = m.checkIn;
                const t1Checked = checkInObj?.team1CheckedIn || false;
                const t2Checked = checkInObj?.team2CheckedIn || false;
                const deadline = checkInObj?.checkInDeadline || null;
                const expired = deadline ? now > deadline : false;
                const isDisputed = checkInObj?.disputed || false;

                const isTeam1Captain = team && m.team1Id === team.id && team.captainId === userUid;
                const isTeam2Captain = team && m.team2Id === team.id && team.captainId === userUid;

                // Time remaining string
                let timeStr = "";
                if (deadline && !expired) {
                  const diff = Math.max(0, deadline - now);
                  const mins = Math.floor(diff / 60000);
                  const secs = Math.floor((diff % 60000) / 1000);
                  timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                }

                return (
                  <article 
                    key={m.id} 
                    style={{ 
                      background: 'var(--bg-card)',
                      borderRadius: '12px', 
                      border: m.status === 'live' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                      boxShadow: m.status === 'live' ? 'var(--border-glow)' : 'none',
                      padding: '1rem',
                      position: 'relative',
                      backdropFilter: 'blur(10px)',
                      transition: 'border 0.3s ease, box-shadow 0.3s ease'
                    }}
                  >
                    <span style={{ 
                      position: 'absolute', 
                      top: '-0.6rem', 
                      right: '0.75rem', 
                      background: 'var(--bg-secondary)', 
                      fontSize: '0.65rem', 
                      padding: '0.1rem 0.5rem', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '4px', 
                      color: m.status === 'live' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      fontWeight: 700
                    }}>
                      {m.status === 'live' ? 'LIVE' : `Match ${m.matchNumber}`}
                    </span>

                    {editingMatchId === m.id ? (
                      <div style={{ marginTop: '0.5rem' }}>
                        {/* Riot ID Match Score Fetch Box */}
                        <div style={{ marginBottom: '0.65rem', padding: '0.45rem', borderRadius: '6px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                          <label htmlFor={`edit-riot-id-${m.id}`} style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                            🎮 Fetch Score by Riot ID (e.g. Tarik#NA1)
                          </label>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <input
                              id={`edit-riot-id-${m.id}`}
                              type="text"
                              placeholder="Name#Tag"
                              className="glass-input"
                              style={{ flex: 1, padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                              value={riotIdInput}
                              onChange={(e) => setRiotIdInput(e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={handleFetchScoreByRiotId}
                              disabled={fetchingRiotScore}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: 'auto', background: 'var(--accent-cyan)', color: '#000', fontWeight: 800 }}
                            >
                              {fetchingRiotScore ? 'Fetching...' : 'Fetch'}
                            </button>
                          </div>
                          {riotScoreInfo && (
                            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--accent-green)', marginTop: '0.25rem', fontWeight: 600 }}>
                              {riotScoreInfo}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label htmlFor={`edit-score-t1-${m.id}`} style={{ fontSize: '0.85rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t1Name}</label>
                          <input 
                            id={`edit-score-t1-${m.id}`}
                            type="number" 
                            className="glass-input" 
                            style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }} 
                            value={editScore1} 
                            onChange={(e) => setEditScore1(Number(e.target.value))} 
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label htmlFor={`edit-score-t2-${m.id}`} style={{ fontSize: '0.85rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t2Name}</label>
                          <input 
                            id={`edit-score-t2-${m.id}`}
                            type="number" 
                            className="glass-input" 
                            style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }} 
                            value={editScore2} 
                            onChange={(e) => setEditScore2(Number(e.target.value))} 
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            onClick={() => handleSaveScore(m.id)} 
                            className="btn btn-primary" 
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', height: 'auto' }}
                            disabled={actionLoading}
                          >
                            Save Score
                          </button>
                          <button 
                            onClick={() => setEditingMatchId(null)} 
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem', fontSize: '0.75rem', height: 'auto' }}
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
                              className="hover-cyan"
                              style={{ 
                                fontSize: '0.9rem', 
                                fontWeight: isT1Winner ? 800 : 500,
                                color: isT1Winner ? 'var(--accent-green)' : (m.winnerId && !isT1Winner ? 'var(--text-muted)' : 'var(--text-primary)'),
                                maxWidth: '180px',
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
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: isT1Winner ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                            {m.score1}
                          </span>
                        </div>
                        {/* Team 2 Slot */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {m.team2Id ? (
                            <Link 
                              href={`/teams/${m.team2Id}`}
                              className="hover-cyan"
                              style={{ 
                                fontSize: '0.9rem', 
                                fontWeight: isT2Winner ? 800 : 500,
                                color: isT2Winner ? 'var(--accent-green)' : (m.winnerId && !isT2Winner ? 'var(--text-muted)' : 'var(--text-primary)'),
                                maxWidth: '180px',
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
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: isT2Winner ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                            {m.score2}
                          </span>
                        </div>

                        {/* Discord lobby channel */}
                        {m.discordUrl && (
                          <a 
                            href={m.discordUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{
                              marginTop: '0.4rem',
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.75rem',
                              color: '#fff',
                              background: '#5865F2',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem',
                              textDecoration: 'none',
                              boxShadow: '0 0 8px rgba(88, 101, 242, 0.3)',
                              fontWeight: 600
                            }}
                          >
                            💬 Join Discord Lobby
                          </a>
                        )}

                        {/* Custom Lobby Room ID & Password Display / Form */}
                        {editingRoomMatchId === m.id ? (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255, 183, 3, 0.08)', borderRadius: '6px', border: '1px solid var(--accent-gold)' }}>
                            <label htmlFor={`edit-room-id-${m.id}`} style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                              🎮 Custom Lobby Credentials (Room ID & Pass)
                            </label>
                            <input
                              id={`edit-room-id-${m.id}`}
                              type="text"
                              placeholder="Room ID (e.g. ROOM-88241)"
                              className="glass-input"
                              style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.75rem', marginBottom: '0.3rem' }}
                              value={inputRoomId}
                              onChange={(e) => setInputRoomId(e.target.value)}
                            />
                            <input
                              id={`edit-room-pass-${m.id}`}
                              type="text"
                              placeholder="Password (e.g. shakti123)"
                              className="glass-input"
                              style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.75rem', marginBottom: '0.4rem' }}
                              value={inputRoomPassword}
                              onChange={(e) => setInputRoomPassword(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button
                                type="button"
                                onClick={() => handleSaveRoomDetails(m.id)}
                                className="btn btn-primary"
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.72rem', height: 'auto', background: 'var(--accent-gold)', color: '#000', fontWeight: 800 }}
                                disabled={actionLoading}
                              >
                                Save Credentials
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRoomMatchId(null)}
                                className="btn btn-outline"
                                style={{ padding: '0.3rem', fontSize: '0.72rem', height: 'auto' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.roomId && (
                              <div style={{ background: 'rgba(0, 240, 255, 0.08)', border: '1px solid var(--accent-cyan)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.7rem' }}>🎮 Custom Lobby Credentials</span>
                                  {isOrganizer && (
                                    <button
                                      type="button"
                                      onClick={() => { setEditingRoomMatchId(m.id); setInputRoomId(m.roomId || ''); setInputRoomPassword(m.roomPassword || ''); }}
                                      style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.72rem', color: '#fff', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span><strong>Room ID:</strong> <code style={{ background: '#000', padding: '0.1rem 0.35rem', borderRadius: '3px', color: 'var(--accent-cyan)', fontWeight: 800 }}>{m.roomId}</code></span>
                                  {m.roomPassword && <span><strong>Pass:</strong> <code style={{ background: '#000', padding: '0.1rem 0.35rem', borderRadius: '3px', color: 'var(--accent-gold)', fontWeight: 800 }}>{m.roomPassword}</code></span>}
                                </div>
                              </div>
                            )}

                            {isOrganizer && !m.roomId && m.status === 'live' && editingMatchId !== m.id && (
                              <button
                                type="button"
                                onClick={() => { setEditingRoomMatchId(m.id); setInputRoomId(''); setInputRoomPassword(''); }}
                                className="btn btn-outline"
                                style={{ marginTop: '0.4rem', padding: '0.3rem', fontSize: '0.72rem', width: '100%', height: 'auto', background: 'rgba(255, 183, 3, 0.08)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', fontWeight: 700 }}
                              >
                                🎮 Fill Room ID & Password
                              </button>
                            )}
                          </>
                        )}

                        {/* Check-In and Dispute Indicators */}
                        {m.status === 'live' && (
                          <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                            
                            {/* Team 1 Check-In Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{t1Name.substring(0, 15)}:</span>
                              {t1Checked ? (
                                <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                                  <CheckCircle size={10} /> Check-In OK
                                </span>
                              ) : (
                                <span style={{ color: 'var(--accent-gold)', fontWeight: 500 }}>Pending</span>
                              )}
                            </div>

                            {/* Team 2 Check-In Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{t2Name.substring(0, 15)}:</span>
                              {t2Checked ? (
                                <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                                  <CheckCircle size={10} /> Check-In OK
                                </span>
                              ) : (
                                <span style={{ color: 'var(--accent-gold)', fontWeight: 500 }}>Pending</span>
                              )}
                            </div>

                            {/* Forfeit Timer */}
                            {deadline && !isDisputed && (!t1Checked || !t2Checked) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 183, 3, 0.08)', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255, 183, 3, 0.2)', marginTop: '0.2rem' }}>
                                <span style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                                  <Clock size={10} /> Timer:
                                </span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: expired ? 'var(--accent-red)' : 'var(--accent-gold)' }}>
                                  {expired ? 'EXPIRED' : timeStr}
                                </span>
                              </div>
                            )}

                            {/* Check-In Buttons for players */}
                            {deadline && !expired && !isDisputed && (
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                {isTeam1Captain && !t1Checked && (
                                  <button
                                    onClick={() => handleCheckIn(m.id, 'team1')}
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.75rem', height: 'auto', background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: 'var(--bg-primary)', fontWeight: 700 }}
                                    disabled={actionLoading}
                                  >
                                    Check In Team
                                  </button>
                                )}
                                {isTeam2Captain && !t2Checked && (
                                  <button
                                    onClick={() => handleCheckIn(m.id, 'team2')}
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.75rem', height: 'auto', background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: 'var(--bg-primary)', fontWeight: 700 }}
                                    disabled={actionLoading}
                                  >
                                    Check In Team
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Claim Forfeit Win actions */}
                            {deadline && expired && !isDisputed && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
                                {t1Checked && !t2Checked && (isTeam1Captain || isOrganizer) && (
                                  <button
                                    onClick={() => handleClaimForfeit(m.id, 'team1')}
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.75rem', height: 'auto', background: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)', color: 'var(--bg-primary)', fontWeight: 700 }}
                                    disabled={actionLoading}
                                  >
                                    Claim Forfeit Win
                                  </button>
                                )}
                                {t2Checked && !t1Checked && (isTeam2Captain || isOrganizer) && (
                                  <button
                                    onClick={() => handleClaimForfeit(m.id, 'team2')}
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.75rem', height: 'auto', background: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)', color: 'var(--bg-primary)', fontWeight: 700 }}
                                    disabled={actionLoading}
                                  >
                                    Claim Forfeit Win
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Dispute Flagging trigger for players */}
                            {!isDisputed && (
                              <button
                                onClick={() => handleDispute(m.id)}
                                className="btn btn-outline"
                                style={{ fontSize: '0.7rem', padding: '0.3rem', height: 'auto', borderColor: 'rgba(239, 45, 86, 0.3)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', width: '100%', cursor: 'pointer' }}
                                disabled={actionLoading}
                              >
                                <ShieldAlert size={10} /> Flag Dispute
                              </button>
                            )}

                            {/* Dispute Banner & Organizer overrides */}
                            {isDisputed && (
                              <div style={{ background: 'rgba(239, 45, 86, 0.08)', border: '1px dashed var(--accent-red)', padding: '0.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
                                <span style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <ShieldAlert size={10} /> DISPUTED BY {checkInObj?.disputedBy?.substring(0, 15)}
                                </span>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', margin: '0', fontStyle: 'italic', lineHeight: '1.2' }}>
                                  "{checkInObj?.disputeReason}"
                                </p>
                                
                                {/* Organizer dispute actions */}
                                {isOrganizer && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                      <button
                                        onClick={() => handleResolveDispute(m.id, 'win_t1')}
                                        className="btn btn-primary"
                                        style={{ padding: '0.3rem', fontSize: '0.65rem', height: 'auto', background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: 'var(--bg-primary)' }}
                                        disabled={actionLoading}
                                      >
                                        Win T1
                                      </button>
                                      <button
                                        onClick={() => handleResolveDispute(m.id, 'win_t2')}
                                        className="btn btn-primary"
                                        style={{ padding: '0.3rem', fontSize: '0.65rem', height: 'auto', background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: 'var(--bg-primary)' }}
                                        disabled={actionLoading}
                                      >
                                        Win T2
                                      </button>
                                    </div>
                                    <button
                                      onClick={() => handleResolveDispute(m.id, 'reset_timer')}
                                      className="btn btn-outline"
                                      style={{ padding: '0.3rem', fontSize: '0.65rem', width: '100%', height: 'auto' }}
                                      disabled={actionLoading}
                                    >
                                      Reset Timer / Clear Dispute
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Score update trigger for organizer */}
                        {isOrganizer && m.status === 'live' && !m.winnerId && m.team1Id && m.team2Id && !isDisputed && (
                          <button 
                            onClick={() => {
                              setEditingMatchId(m.id);
                              setEditScore1(m.score1);
                              setEditScore2(m.score2);
                            }}
                            className="btn btn-outline"
                            style={{ marginTop: '0.4rem', padding: '0.3rem', fontSize: '0.75rem', height: 'auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                            aria-label={`Record score for match ${m.matchNumber}`}
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
  );
}
