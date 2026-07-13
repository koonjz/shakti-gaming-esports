'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore, Profile, Team } from '@/store/useAppStore';
import { Users, UserPlus, UserMinus, Check, X, Shield, LogOut, Loader, PlusCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function TeamsClient() {
  const user = useAppStore((state) => state.user);
  const profile = useAppStore((state) => state.profile);
  const team = useAppStore((state) => state.team);
  const teamLoading = useAppStore((state) => state.teamLoading);
  const loading = useAppStore((state) => state.loading);
  const router = useRouter();

  // Component states
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteGamertag, setInviteGamertag] = useState('');
  const [memberProfiles, setMemberProfiles] = useState<Profile[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Team[]>([]);
  const [actioningInviteId, setActioningInviteId] = useState<string | null>(null);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch profiles of members in user's team
  useEffect(() => {
    const fetchMemberProfiles = async () => {
      if (!team?.members || team.members.length === 0) {
        setMemberProfiles([]);
        return;
      }
      try {
        const profilesRef = collection(db, "profiles");
        const chunks = [];
        const memberIds = [...team.members];
        while (memberIds.length > 0) {
          chunks.push(memberIds.splice(0, 30));
        }

        let allProfiles: Profile[] = [];
        for (const chunk of chunks) {
          const q = query(profilesRef, where("uid", "in", chunk));
          const snap = await getDocs(q);
          const chunkProfiles = snap.docs.map(d => d.data() as Profile);
          allProfiles = [...allProfiles, ...chunkProfiles];
        }
        setMemberProfiles(allProfiles);
      } catch (err) {
        console.error("Error fetching member profiles:", err);
      }
    };

    fetchMemberProfiles();
  }, [team?.members]);

  // Fetch pending invitations for this user
  const fetchReceivedInvites = async () => {
    if (!profile?.gamertag) return;
    try {
      const q = query(
        collection(db, "teams"), 
        where("pendingInvites", "array-contains", profile.gamertag)
      );
      const snap = await getDocs(q);
      const invitesList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
      setReceivedInvites(invitesList);
    } catch (err) {
      console.error("Error fetching received invites:", err);
    }
  };

  useEffect(() => {
    fetchReceivedInvites();
  }, [profile?.gamertag, team]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Create team action
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    
    if (!newTeamName.trim()) {
      setError("Team name cannot be empty.");
      return;
    }

    setActionLoading(true);
    try {
      await addDoc(collection(db, "teams"), {
        name: newTeamName.trim(),
        captainId: user!.uid,
        members: [user!.uid],
        pendingInvites: [],
        createdAt: Date.now()
      });

      setNewTeamName('');
      setSuccess(`Team "${newTeamName}" created successfully!`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create team.");
    } finally {
      setActionLoading(false);
    }
  };

  // Send invite action
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const cleanGamertag = inviteGamertag.trim().toLowerCase();
    if (!cleanGamertag) {
      setError("Please enter a gamertag.");
      return;
    }

    if (!team) {
      setError("You must have a team to send invites.");
      return;
    }

    setActionLoading(true);

    try {
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("gamertag", "==", cleanGamertag));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError(`Player @${cleanGamertag} does not exist.`);
        setActionLoading(false);
        return;
      }

      const invitedPlayer = snap.docs[0].data() as Profile;

      if (team.members.includes(invitedPlayer.uid)) {
        setError(`@${cleanGamertag} is already a member of your team.`);
        setActionLoading(false);
        return;
      }

      if (team.pendingInvites.includes(cleanGamertag)) {
        setError(`An invitation is already pending for @${cleanGamertag}.`);
        setActionLoading(false);
        return;
      }

      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        pendingInvites: arrayUnion(cleanGamertag)
      });

      // Write notification document to the invited player's notifications subcollection
      const notificationRef = collection(db, "profiles", invitedPlayer.uid, "notifications");
      await addDoc(notificationRef, {
        type: 'team_invite',
        message: `You have been invited to join team ${team.name}.`,
        relatedId: team.id,
        read: false,
        createdAt: serverTimestamp()
      });

      setInviteGamertag('');
      setSuccess(`Invited @${cleanGamertag} to join your team.`);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Only the team captain can invite players.");
      } else {
        setError(err.message || "Failed to send invitation.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke invite (Captain only)
  const handleRevokeInvite = async (gamertag: string) => {
    if (!team) return;
    clearMessages();
    try {
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        pendingInvites: arrayRemove(gamertag)
      });
      setSuccess(`Revoked invitation for @${gamertag}.`);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Only the team captain can revoke invites.");
      } else {
        setError("Failed to revoke invitation.");
      }
    }
  };

  // Accept invite
  const handleAcceptInvite = async (invitingTeam: Team) => {
    if (!profile) return;
    clearMessages();
    setActioningInviteId(invitingTeam.id);
    setActionLoading(true);

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      const teamRef = doc(db, "teams", invitingTeam.id);
      await updateDoc(teamRef, {
        members: arrayUnion(user!.uid),
        pendingInvites: arrayRemove(profile.gamertag)
      });
      
      setSuccess(`Successfully joined team ${invitingTeam.name}!`);
      fetchReceivedInvites();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Invite acceptance rejected. Verify you are the target player.");
      } else {
        setError("Failed to accept team invitation.");
      }
    } finally {
      setActioningInviteId(null);
      setActionLoading(false);
    }
  };

  // Reject invite
  const handleRejectInvite = async (invitingTeam: Team) => {
    if (!profile) return;
    clearMessages();
    setActioningInviteId(invitingTeam.id);
    setActionLoading(true);

    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      const teamRef = doc(db, "teams", invitingTeam.id);
      await updateDoc(teamRef, {
        pendingInvites: arrayRemove(profile.gamertag)
      });
      setSuccess(`Declined invitation from team ${invitingTeam.name}.`);
      fetchReceivedInvites();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Rejection failed. Verify your profile match.");
      } else {
        setError("Failed to reject invitation.");
      }
    } finally {
      setActioningInviteId(null);
      setActionLoading(false);
    }
  };

  // Leave Team
  const handleLeaveTeam = async () => {
    if (!team || !user) return;
    if (team.captainId === user.uid) {
      setError("Captains cannot leave. Disband the team instead.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to leave this team?")) return;

    clearMessages();
    setActionLoading(true);

    try {
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        members: arrayRemove(user.uid)
      });
      setSuccess("Successfully left the team.");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Database rejected exit. Verify you are still on the roster.");
      } else {
        setError("Failed to leave team.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Remove member (Captain only)
  const handleRemoveMember = async (memberUid: string, memberGamertag: string) => {
    if (!team) return;
    if (!window.confirm(`Are you sure you want to remove @${memberGamertag} from the team?`)) return;

    clearMessages();
    try {
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        members: arrayRemove(memberUid)
      });
      setSuccess(`Removed @${memberGamertag} from the team.`);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Only the team captain can remove members.");
      } else {
        setError("Failed to remove member.");
      }
    }
  };

  // Disband team (Captain only)
  const handleDisbandTeam = async () => {
    if (!team) return;
    if (!window.confirm("CRITICAL: Disbanding the team is permanent and removes all roster memberships. Proceed?")) return;

    clearMessages();
    setActionLoading(true);

    try {
      await deleteDoc(doc(db, "teams", team.id));
      setSuccess("Team disbanded successfully.");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError("Action failed: Only the team captain can disband the team.");
      } else {
        setError("Failed to disband team.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || teamLoading) {
    return (
      <div style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
        <div className="container" style={{ maxWidth: '900px', position: 'relative', zIndex: 1 }}>
          <div className="glass-panel skeleton-pulse" style={{ padding: '2.5rem', height: '120px', marginBottom: '2rem' }}>
            <div className="skeleton-text" style={{ width: '40%', height: '32px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="grid-2-col">
            <div className="glass-panel skeleton-pulse" style={{ padding: '2.5rem', height: '350px' }} />
            <div className="glass-panel skeleton-pulse" style={{ padding: '2.5rem', height: '350px' }} />
          </div>
        </div>
      </div>
    );
  }

  const isCaptain = team?.captainId === user?.uid;

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="container" style={{ maxWidth: '900px', position: 'relative', zIndex: 1 }}>
        
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <Users size={32} style={{ color: 'var(--accent-cyan)' }} />
          <h1 style={{ fontSize: '2.25rem' }}>Team Management</h1>
        </div>

        {/* Global Notifications */}
        {(error || success) && (
          <div style={{
            background: error ? 'hsla(350, 85%, 55%, 0.12)' : 'hsla(145, 80%, 45%, 0.12)',
            border: `1px solid ${error ? 'var(--accent-red)' : 'var(--accent-green)'}`,
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '2rem',
            color: error ? 'var(--accent-red)' : 'var(--accent-green)',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} />
            <span>{error || success}</span>
          </div>
        )}

        {/* CASE 1: USER IS NOT IN A TEAM */}
        {!team ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }} className="grid-2-col">
            {/* Create Team Card */}
            <article className="glass-panel" style={{ padding: '2.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={22} style={{ color: 'var(--accent-cyan)' }} />
                Create a Roster
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Establish a new competitive team. As Captain, you will invite members, manage the roster, and register for tournaments.
              </p>

              <form onSubmit={handleCreateTeam}>
                <div className="form-group">
                  <label htmlFor="new-team-name" className="form-label">Team / Organization Name</label>
                  <input
                    id="new-team-name"
                    type="text"
                    className="glass-input"
                    placeholder="Enter team name..."
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Creating...' : 'Initialize Team'}
                </button>
              </form>
            </article>

            {/* Received Invitations Card */}
            <article className="glass-panel" style={{ padding: '2.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={22} style={{ color: 'var(--accent-violet)' }} />
                Active Invites
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                {receivedInvites.map((invTeam) => {
                  const isActioning = actioningInviteId === invTeam.id;
                  return (
                    <div 
                      key={invTeam.id} 
                      className="glass-card" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: isActioning ? '0px' : '1rem',
                        opacity: isActioning ? 0 : 1,
                        maxHeight: isActioning ? '0px' : '120px',
                        overflow: 'hidden',
                        transition: 'opacity 200ms ease, max-height 200ms ease, padding 200ms ease, margin-bottom 200ms ease',
                        marginBottom: isActioning ? '0px' : '0.5rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{invTeam.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Created by Captain</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleAcceptInvite(invTeam)}
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          title="Accept Invite"
                          aria-label={`Accept invite to join team ${invTeam.name}`}
                          disabled={actionLoading}
                        >
                          <Check size={14} />
                        </button>
                        <button 
                          onClick={() => handleRejectInvite(invTeam)}
                          className="btn btn-outline"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--accent-red)', borderColor: 'hsla(350, 85%, 55%, 0.3)' }}
                          title="Decline Invite"
                          aria-label={`Decline invite to join team ${invTeam.name}`}
                          disabled={actionLoading}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {receivedInvites.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    <Users size={32} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
                    <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>No pending team invitations.</p>
                  </div>
                )}
              </div>
            </article>
          </div>
        ) : (
          /* CASE 2: USER IS ALREADY IN A TEAM */
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2rem' }} className="grid-2-col">
            
            {/* Roster & Members list */}
            <article className="glass-panel" style={{ padding: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <span className="badge badge-cyan" style={{ marginBottom: '0.3rem' }}>ACTIVE ROSTER</span>
                  <h2 style={{ fontSize: '1.75rem' }}>{team.name}</h2>
                </div>
                {isCaptain ? (
                  <button 
                    onClick={handleDisbandTeam}
                    className="btn btn-outline"
                    style={{ fontSize: '0.85rem', color: 'var(--accent-red)', borderColor: 'hsla(350, 85%, 55%, 0.3)', padding: '0.4rem 0.8rem' }}
                    disabled={actionLoading}
                  >
                    Disband Team
                  </button>
                ) : (
                  <button 
                    onClick={handleLeaveTeam}
                    className="btn btn-outline"
                    style={{ fontSize: '0.85rem', color: 'var(--accent-red)', borderColor: 'hsla(350, 85%, 55%, 0.3)', padding: '0.4rem 0.8rem' }}
                    disabled={actionLoading}
                  >
                    <LogOut size={14} style={{ marginRight: '0.2rem' }} />
                    Leave Team
                  </button>
                )}
              </div>

              {/* Roster list */}
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Roster Members ({memberProfiles.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {memberProfiles.map((member) => {
                  const memberIsCaptain = member.uid === team.captainId;
                  return (
                    <div key={member.uid} className="glass-card card-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          background: 'var(--bg-secondary)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontWeight: 700,
                          border: '1px solid var(--border-color)'
                        }}>
                          {member.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Link href={`/players/${member.gamertag}`} style={{ fontWeight: 700, color: 'var(--text-primary)' }} className="hover-cyan">
                              {member.displayName}
                            </Link>
                            {memberIsCaptain && (
                              <span style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.1rem' }} title="Captain">
                                <Shield size={12} />
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{member.gamertag} &bull; {member.skillLevel}</div>
                        </div>
                      </div>

                      {/* Captain actions */}
                      {isCaptain && !memberIsCaptain && (
                        <button 
                          onClick={() => handleRemoveMember(member.uid, member.gamertag)}
                          className="btn btn-outline"
                          style={{ padding: '0.3rem 0.5rem', color: 'var(--accent-red)', borderColor: 'transparent' }}
                          aria-label={`Remove teammate ${member.displayName}`}
                          title="Remove Player"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>

            {/* Captain Actions Panel (Invite / Pending Invites) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {isCaptain ? (
                <>
                  {/* Invite Panel */}
                  <article className="glass-panel" style={{ padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <UserPlus size={18} style={{ color: 'var(--accent-cyan)' }} />
                      Recruit Teammate
                    </h2>
                    <form onSubmit={handleSendInvite}>
                      <div className="form-group">
                        <label htmlFor="invite-gamertag" className="form-label">Search Gamertag</label>
                        <div className="input-glow-wrapper">
                          <span style={{ position: 'absolute', left: '1rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>@</span>
                          <input
                            id="invite-gamertag"
                            type="text"
                            className="glass-input"
                            style={{ paddingLeft: '2.25rem' }}
                            placeholder="gamertag..."
                            value={inviteGamertag}
                            onChange={(e) => setInviteGamertag(e.target.value)}
                            disabled={actionLoading}
                          />
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ width: '100%', height: '2.6rem' }}
                        disabled={actionLoading}
                      >
                        Send Roster Invite
                      </button>
                    </form>
                  </article>

                  {/* Pending Outbound Invites */}
                  <article className="glass-panel" style={{ padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Pending Outbound Invites</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      {team.pendingInvites && team.pendingInvites.map((pGamertag) => (
                        <div key={pGamertag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>@{pGamertag}</span>
                          <button 
                            onClick={() => handleRevokeInvite(pGamertag)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}
                            title="Cancel Invite"
                            aria-label={`Cancel invitation for @${pGamertag}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}

                      {(!team.pendingInvites || team.pendingInvites.length === 0) && (
                        <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending outbound invites.</p>
                      )}
                    </div>
                  </article>
                </>
              ) : (
                /* Non-captain summary */
                <article className="glass-panel" style={{ padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Role Info</h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    You are a registered roster member of <strong style={{ color: 'var(--text-primary)' }}>{team.name}</strong>.
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                    Only the captain can modify team rosters, invite new players, or sign up the team for bracket tournaments.
                  </p>
                </article>
              )}
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
