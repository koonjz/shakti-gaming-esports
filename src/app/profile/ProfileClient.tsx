'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { Gamepad2, Award, User, Settings, Save, Loader, AlertCircle, CheckCircle, Plus, Check } from 'lucide-react';
import { recommendGames } from '@/lib/recommendGames';

const AVAILABLE_GAMES = ["Valorant", "League of Legends", "CS:GO", "Apex Legends", "Rocket League", "Overwatch 2"];
const POPULAR_ROLES = ["Duelist", "Sentinel", "Mid Laner", "Jungler", "IGL (In-Game Leader)", "Entry Fragger", "Support", "Sniper", "Flex"];

export default function ProfileClient() {
  const user = useAppStore((state) => state.user);
  const profile = useAppStore((state) => state.profile);
  const loading = useAppStore((state) => state.loading);
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [skillLevel, setSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [riotId, setRiotId] = useState('');
  
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  // Sync state with store profile once loaded
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (profile) {
      setDisplayName(profile.displayName || '');
      setSkillLevel(profile.skillLevel || 'Intermediate');
      setSelectedGames(profile.registeredGames || []);
      setPreferredRoles(profile.preferredRoles || []);
      setRiotId(profile.riotId || '');
    }
  }, [user, profile, loading, router]);

  const handleGameToggle = (game: string) => {
    if (selectedGames.includes(game)) {
      setSelectedGames(selectedGames.filter(g => g !== game));
    } else {
      setSelectedGames([...selectedGames, game]);
    }
  };

  const handleAddRole = (role: string) => {
    const trimmed = role.trim();
    if (trimmed && !preferredRoles.includes(trimmed)) {
      setPreferredRoles([...preferredRoles, trimmed]);
      setNewRole('');
    }
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setPreferredRoles(preferredRoles.filter(r => r !== roleToRemove));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Display Name is required.' });
      triggerShake();
      return;
    }

    if (riotId.trim() && !/^[^#]+#[^#]+$/.test(riotId.trim())) {
      setMessage({ type: 'error', text: 'Invalid Riot ID format. Please use name#tag (e.g. Rioter#NA1).' });
      triggerShake();
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const profileRef = doc(db, "profiles", profile.uid);
      await updateDoc(profileRef, {
        displayName: displayName.trim(),
        skillLevel,
        registeredGames: selectedGames,
        preferredRoles: preferredRoles,
        riotId: riotId.trim()
      });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      console.error("Error updating profile:", err);
      triggerShake();
      if (err.code === 'permission-denied') {
        setMessage({ type: 'error', text: 'Action failed: You do not have permission to modify this profile.' });
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleSimulateWin = async () => {
    if (!profile) return;
    try {
      const profileRef = doc(db, "profiles", profile.uid);
      const currentWins = profile.stats?.wins || 0;
      const currentPoints = profile.stats?.points || 1000;
      
      await updateDoc(profileRef, {
        "stats.wins": currentWins + 1,
        "stats.points": currentPoints + 150
      });
      setMessage({ type: 'success', text: 'Victory simulated! +150 Points added.' });
    } catch (err: any) {
      console.error(err);
      triggerShake();
      if (err.code === 'permission-denied') {
        setMessage({ type: 'error', text: "Action failed: You do not have permission to modify this profile's stats." });
      } else {
        setMessage({ type: 'error', text: 'Failed to simulate win.' });
      }
    }
  };

  const handleAddGameFromRecommendation = async (gameName: string) => {
    if (!profile) return;
    if (selectedGames.includes(gameName)) return;

    setUpdating(true);
    setMessage(null);
    const updatedGames = [...selectedGames, gameName];
    setSelectedGames(updatedGames);

    try {
      const profileRef = doc(db, "profiles", profile.uid);
      await updateDoc(profileRef, {
        registeredGames: updatedGames
      });
      setMessage({ type: 'success', text: `Added ${gameName} to your registered games!` });
    } catch (err: any) {
      console.error("Error adding recommended game:", err);
      triggerShake();
      setMessage({ type: 'error', text: 'Failed to add recommended game.' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !profile) {
    return (
      <div style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
        <div className="container" style={{ maxWidth: '800px', position: 'relative', zIndex: 1 }}>
          <div className="glass-panel skeleton-pulse" style={{ padding: '2.5rem', height: '500px' }}>
            <div className="skeleton-text" style={{ width: '30%', height: '32px', marginBottom: '2.5rem' }} />
            <div style={{ display: 'flex', gap: '2rem', flexDirection: 'column' }}>
              <div className="skeleton-text" style={{ width: '90%', height: '40px' }} />
              <div className="skeleton-text" style={{ width: '70%', height: '40px' }} />
              <div className="skeleton-text" style={{ width: '80%', height: '80px' }} />
              <div className="skeleton-button" style={{ width: '100%', marginTop: '2rem' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 4.5rem)', padding: '3rem 1.5rem' }}>
      <div className="hero-glow hero-glow-1" />
      
      <div className="container" style={{ maxWidth: '800px', position: 'relative', zIndex: 1 }}>
        
        <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            color: 'var(--bg-primary)'
          }}>
            {profile.displayName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{profile.displayName}</span>
              <span className="badge badge-cyan">@{profile.gamertag}</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
              Combat Stats: <strong style={{ color: 'var(--accent-gold)' }}>{profile.stats?.points || 1000} XP</strong> &bull; <strong style={{ color: 'var(--accent-green)' }}>{profile.stats?.wins || 0} Wins</strong>
            </p>
          </div>
          
          <button 
            onClick={handleSimulateWin}
            className="btn btn-outline"
            style={{ marginLeft: 'auto', fontSize: '0.85rem' }}
          >
            Simulate Victory (+150 XP)
          </button>
        </div>

        {/* Assertive live region for validation error and success messages */}
        <div aria-live="assertive">
          {message && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: message.type === 'error' ? 'hsla(350, 85%, 55%, 0.12)' : 'hsla(145, 80%, 45%, 0.12)',
              border: `1px solid ${message.type === 'error' ? 'var(--accent-red)' : 'var(--accent-green)'}`,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              color: message.type === 'error' ? 'var(--accent-red)' : 'var(--accent-green)',
              fontSize: '0.9rem'
            }}>
              {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className={`glass-panel ${shake ? 'shake' : ''}`} style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <Settings size={20} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Edit Player Profile</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="grid-2-col">
            {/* Display Name */}
            <div className="form-group">
              <label htmlFor="prof-displayname" className="form-label">Display Name</label>
              <div className="input-glow-wrapper">
                <User size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                <input
                  id="prof-displayname"
                  type="text"
                  className="glass-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={updating}
                />
              </div>
            </div>

            {/* Skill Level */}
            <div className="form-group">
              <label htmlFor="prof-skilllevel" className="form-label">Skill Level</label>
              <select
                id="prof-skilllevel"
                className="glass-input glass-select"
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value as any)}
                disabled={updating}
              >
                <option value="Beginner">Beginner / Casual</option>
                <option value="Intermediate">Intermediate / Competitor</option>
                <option value="Advanced">Advanced / Pro-Tier</option>
              </select>
            </div>
          </div>

          {/* Riot Games ID Link */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label htmlFor="prof-riotid" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Gamepad2 size={16} style={{ color: 'var(--accent-cyan)' }} />
              Riot ID Link (For Live Stats)
            </label>
            <div className="input-glow-wrapper">
              <input
                id="prof-riotid"
                type="text"
                className="glass-input"
                placeholder="e.g. Rioter#NA1"
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                disabled={updating}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem' }}>
              Link your Riot ID (format: name#tag) to fetch and show your active League of Legends rank on your public profile.
            </span>
          </div>

          {/* Games Selection */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Gamepad2 size={16} style={{ color: 'var(--accent-cyan)' }} />
              Registered Games (Games you actively play)
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {AVAILABLE_GAMES.map((game) => {
                const isSelected = selectedGames.includes(game);
                return (
                  <button
                    type="button"
                    key={game}
                    onClick={() => handleGameToggle(game)}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      fontSize: '0.85rem',
                      boxShadow: isSelected ? 'var(--glow-cyan)' : 'none'
                    }}
                    disabled={updating}
                  >
                    {game}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Roles Selection */}
          <div className="form-group" style={{ marginTop: '2rem' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Award size={16} style={{ color: 'var(--accent-violet)' }} />
              Preferred Roles / Playstyles
            </span>

            {/* Role Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.5rem 0 1rem 0' }}>
              {preferredRoles.map((role) => (
                <span 
                  key={role} 
                  className="badge badge-violet" 
                  style={{ gap: '0.4rem', cursor: 'pointer', padding: '0.4rem 0.8rem' }}
                  onClick={() => handleRemoveRole(role)}
                  title="Click to remove"
                >
                  {role} &times;
                </span>
              ))}
              {preferredRoles.length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No preferred roles added yet.</span>
              )}
            </div>

            {/* Role quick add & input */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label htmlFor="prof-role-input" className="sr-only">Add Preferred Role</label>
              <input
                id="prof-role-input"
                type="text"
                className="glass-input"
                placeholder="Type custom role or select quick suggestions..."
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRole(newRole);
                  }
                }}
                disabled={updating}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleAddRole(newRole)}
                disabled={updating}
              >
                Add
              </button>
            </div>

            {/* Suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
              {POPULAR_ROLES.filter(r => !preferredRoles.includes(r)).slice(0, 6).map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => handleAddRole(role)}
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    background: 'var(--bg-secondary)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  disabled={updating}
                >
                  + {role}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '2rem', height: '3.2rem' }}
            disabled={updating}
          >
            {updating ? 'Saving Changes...' : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Save size={18} /> Save Profile Settings
              </span>
            )}
          </button>
        </form>

        {/* AI GAME RECOMMENDATIONS DECK */}
        {(() => {
          const recommendations = recommendGames(selectedGames, preferredRoles);
          const isColdStart = selectedGames.length === 0 && preferredRoles.length === 0;

          return (
            <section className="glass-panel fade-in" style={{ padding: '2.5rem', marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <Gamepad2 size={20} style={{ color: 'var(--accent-cyan)' }} />
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
                  {isColdStart ? 'Popular Games to Get Started' : 'Recommended For You'}
                </h2>
                {isColdStart && (
                  <span className="badge badge-cyan" style={{ fontSize: '0.7rem', textTransform: 'none', marginLeft: '0.5rem' }}>
                    Catalog defaults
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="grid-2-col">
                {recommendations.map(({ game, explanation }) => (
                  <article 
                    key={game.id} 
                    className="glass-card table-row-hover" 
                    style={{ 
                      padding: '1.5rem',
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between',
                      gap: '1rem',
                      position: 'relative'
                    }}
                    tabIndex={0}
                    aria-label={`Recommended game: ${game.name}. Genre: ${game.genre}. ${explanation}`}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{game.name}</h3>
                        <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>{game.genre}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                        {game.description}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontStyle: 'italic' }}>
                        {explanation}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddGameFromRecommendation(game.name)}
                        className="btn btn-outline touch-target"
                        style={{ 
                          width: '100%', 
                          fontSize: '0.8rem', 
                          padding: '0.4rem 0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem'
                        }}
                        disabled={updating}
                      >
                        <Plus size={14} /> Add to my games
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })()}

      </div>
    </main>
  );
}
