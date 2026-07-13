'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { Trophy, Users, User, LogOut, Gamepad2, Menu, X, ShieldAlert, Bell } from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  writeBatch, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AppNotification {
  id: string;
  type: 'team_invite' | 'tournament_starting' | 'match_result' | 'registration_confirmed';
  message: string;
  relatedId: string;
  read: boolean;
  createdAt: any;
}

export default function Navbar() {
  const user = useAppStore((state) => state.user);
  const profile = useAppStore((state) => state.profile);
  const logout = useAppStore((state) => state.logout);
  const loading = useAppStore((state) => state.loading);
  const isOffline = useAppStore((state) => state.isOffline);
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Notification states
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const navLinks = [
    { name: 'Tournaments', href: '/tournaments', icon: Trophy },
    { name: 'Teams', href: '/teams', icon: Users },
    { name: 'Leaderboard', href: '/leaderboard', icon: ShieldAlert },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      setNotifOpen(false);
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  // Relative time formatter
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Keyboard navigation & Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to unread notifications (limit to 30)
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const ref = collection(db, "profiles", user.uid, "notifications");
    const q = query(
      ref,
      where("read", "==", false),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type,
          message: data.message,
          relatedId: data.relatedId,
          read: data.read,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
        } as AppNotification;
      });
      setNotifications(list);
    }, (err) => {
      console.error("Notifications listener error:", err);
    });

    return () => unsub();
  }, [user]);

  const handleMarkRead = async (notifId: string) => {
    if (!user) return;
    try {
      const ref = doc(db, "profiles", user.uid, "notifications", notifId);
      await updateDoc(ref, { read: true });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        const ref = doc(db, "profiles", user.uid, "notifications", n.id);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to bulk mark read:", err);
    }
  };

  return (
    <header className="header-glass">
      {isOffline && (
        <div style={{
          background: 'var(--accent-red)',
          color: 'var(--text-primary)',
          textAlign: 'center',
          fontSize: '0.8rem',
          fontWeight: 700,
          padding: '0.4rem 1rem',
          letterSpacing: '0.05em',
          boxShadow: '0 4px 20px hsla(350, 85%, 55%, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <ShieldAlert size={14} style={{ animation: 'pulse 1.5s infinite' }} />
          <span>OFFLINE MODE &mdash; DISPLAYING CACHED DATA. CHANGES WILL SYNC ON RECONNECTION.</span>
        </div>
      )}
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4.5rem' }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.4rem', fontFamily: 'var(--font-title)' }}>
          <Gamepad2 size={28} className="text-cyan" style={{ color: 'var(--accent-cyan)' }} />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            SHAKTI
          </span>
          <span style={{ color: 'var(--text-primary)' }}>GAMING</span>
        </Link>

        {/* Desktop Navigation */}
        <nav style={{ display: 'none', gap: '2rem', alignItems: 'center' }} className="desktop-nav">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link 
                key={link.name} 
                href={link.href}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  padding: '0.5rem 0',
                }}
                className="nav-hover"
              >
                <Icon size={16} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Real-time Notification Bell */}
          {user && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="btn btn-outline touch-target"
                aria-label={`Notifications, ${notifications.length} unread`}
                aria-expanded={notifOpen}
                style={{
                  position: 'relative',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: notifOpen ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span 
                    className="pulse-badge"
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: 'var(--accent-cyan)',
                      color: 'var(--bg-primary)',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      borderRadius: '50%',
                      height: '16px',
                      width: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {notifOpen && (
                <div 
                  className="glass-panel"
                  style={{
                    position: 'absolute',
                    top: '2.8rem',
                    right: 0,
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 100,
                    padding: '1rem',
                    border: '1px solid hsla(186, 100%, 48%, 0.15)',
                    background: 'hsla(223, 20%, 5%, 0.95)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
                    {notifications.length > 0 && (
                      <button 
                        onClick={handleMarkAllRead}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        No unread notifications.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id}
                          style={{
                            padding: '0.6rem',
                            borderRadius: '6px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem'
                          }}
                        >
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                            {notif.message}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {formatTimeAgo(notif.createdAt)}
                            </span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Link 
                                href={
                                  notif.type === 'team_invite' 
                                    ? '/teams' 
                                    : `/tournaments/${notif.relatedId}`
                                }
                                onClick={() => {
                                  handleMarkRead(notif.id);
                                  setNotifOpen(false);
                                }}
                                style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600 }}
                              >
                                View
                              </Link>
                              <button 
                                onClick={() => handleMarkRead(notif.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Actions (Desktop only) */}
          <div style={{ display: 'none', alignItems: 'center', gap: '1rem' }} className="desktop-actions">
            {loading ? (
              <div style={{ width: '120px', height: '2.2rem', background: 'var(--bg-tertiary)', borderRadius: '6px', opacity: 0.5 }} />
            ) : user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link 
                  href={profile?.gamertag ? `/players/${profile.gamertag}` : '/profile'}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    background: 'var(--bg-tertiary)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <User size={14} style={{ color: 'var(--accent-cyan)' }} />
                  <span>@{profile?.gamertag || 'gamer'}</span>
                </Link>
                <Link href="/profile" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }} className="hover-cyan">
                  Edit Profile
                </Link>
                <button 
                  onClick={handleLogout} 
                  className="btn btn-outline" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" className="btn btn-outline" style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
                  Login
                </Link>
                <Link href="/register" className="btn btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
                  Join Now
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: 'block', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
            className="mobile-toggle"
            aria-label={mobileMenuOpen ? "Close main menu" : "Open main menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-dropdown"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <nav 
          id="mobile-nav-dropdown"
          aria-label="Mobile Navigation"
          style={{
            position: 'absolute',
            top: '4.5rem',
            left: 0,
            right: 0,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            zIndex: 99
          }} className="mobile-dropdown">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link 
                key={link.name} 
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="touch-target"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}
              >
                <Icon size={18} style={{ color: 'var(--accent-cyan)' }} />
                {link.name}
              </Link>
            );
          })}
          <hr style={{ borderColor: 'var(--border-color)' }} />
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontWeight: 600 }}>@{profile?.gamertag || 'gamer'}</span>
              </div>
              <Link href="/profile" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                Edit Profile
              </Link>
              <button 
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }} 
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="btn btn-outline" style={{ width: '100%' }}>
                Login
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary" style={{ width: '100%' }}>
                Join Now
              </Link>
            </div>
          )}
        </nav>
      )}

      {/* Inline styles for responsive Navbar until CSS files are parsed */}
      <style jsx global>{`
        @media (min-width: 1025px) {
          .desktop-nav { display: flex !important; }
          .desktop-actions { display: flex !important; }
          .mobile-toggle { display: none !important; }
          .mobile-dropdown { display: none !important; }
        }
        .nav-hover:hover {
          color: var(--accent-cyan) !important;
        }
        .hover-cyan:hover {
          color: var(--accent-cyan) !important;
        }
        @keyframes badgePulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 hsla(186, 100%, 48%, 0.5); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 4px hsla(186, 100%, 48%, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 hsla(186, 100%, 48%, 0); }
        }
        .pulse-badge {
          animation: badgePulse 2s infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-badge {
            animation: none !important;
          }
        }
      `}</style>
    </header>
  );
}
