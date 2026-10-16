'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { User, LogOut, Menu, X, Bell, ChevronDown, Home, Palette, Check, Sun, Moon, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  type: 'team_invite' | 'tournament_starting' | 'match_result' | 'registration_confirmed' | 'new_tournament';
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
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const pathname = usePathname();
  const isHome = pathname === '/';
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  // 2-Theme System (Neon Dark and Minimal Light)
  type ThemeId = 'neon' | 'light';
  const [theme, setTheme] = useState<ThemeId>('neon');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = (localStorage.getItem('shaktrix_theme') as ThemeId) || 'neon';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'neon' ? 'light' : 'neon';
    setTheme(nextTheme);
    localStorage.setItem('shaktrix_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Dropdown states for the inner-page black bar
  const [productsOpen, setProductsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Auto-hide scroll logic (Home page only)
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [navVisible, setNavVisible] = useState(true);

  // Click outside notification listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };

    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notifOpen]);

  // Click outside ABOUT menu listener
  useEffect(() => {
    const handleClickOutsideAbout = (event: MouseEvent) => {
      if (aboutRef.current && !aboutRef.current.contains(event.target as Node)) {
        setAboutOpen(false);
      }
    };

    if (aboutOpen) {
      document.addEventListener('mousedown', handleClickOutsideAbout);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideAbout);
    };
  }, [aboutOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setIsScrolled(currentScrollY > 50);

      if (isHome) {
        if (currentScrollY > lastScrollY && currentScrollY > 150) {
          setNavVisible(false);
        } else {
          setNavVisible(true);
        }
      } else {
        setNavVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isHome]);

  // Firestore Notification Real-time Listener (Subcollection query without server orderBy)
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, "profiles", user.uid, "notifications"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.read) {
          notifs.push({
            id: docSnap.id,
            type: data.type || 'registration_confirmed',
            message: data.message || '',
            relatedId: data.relatedId || '',
            read: !!data.read,
            createdAt: data.createdAt
          });
        }
      });

      // Safe client-side sorting
      notifs.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return tB - tA;
      });

      setNotifications(notifs);
    }, (error) => {
      console.error("Error listening to notifications:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const promptLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    setMobileMenuOpen(false);
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleMarkRead = async (notifId: string) => {
    if (!user) return;
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    try {
      const ref = doc(db, "profiles", user.uid, "notifications", notifId);
      await updateDoc(ref, { read: true });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || notifications.length === 0) return;
    const targets = [...notifications];
    setNotifications([]);
    try {
      const batch = writeBatch(db);
      targets.forEach(n => {
        const ref = doc(db, "profiles", user.uid, "notifications", n.id);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to bulk mark read:", err);
    }
  };

  const showBanner = connectionStatus === 'reconnecting' || connectionStatus === 'offline' || isOffline;

  return (
    <>
      {connectionStatus === 'reconnecting' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 110,
          background: 'linear-gradient(90deg, #ffaa00 0%, #ff6600 100%)', 
          color: '#fff', textAlign: 'center',
          fontSize: '0.78rem', fontWeight: 800, padding: '0.4rem', letterSpacing: '0.1em',
          boxShadow: '0 0 15px rgba(255, 170, 0, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
        }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            border: '2px solid #fff', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite'
          }} />
          RECONNECTING... ATTEMPTING TO RESTORE CONNECTION (5S)
        </div>
      )}

      {(connectionStatus === 'offline' || (isOffline && connectionStatus !== 'reconnecting')) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 110,
          background: 'var(--accent-red)', color: '#fff', textAlign: 'center',
          fontSize: '0.78rem', fontWeight: 800, padding: '0.4rem', letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
        }}>
          OFFLINE MODE — DISPLAYING CACHED DATA
        </div>
      )}

      {/* HEADER: Clean transparent header on home, glossy glass on inner pages */}
      <header 
        data-home={isHome}
        className={isHome ? 'is-home-header' : 'is-inner-header'}
        style={{
          position: 'fixed',
          top: showBanner ? '2.2rem' : '0',
          left: 0,
          right: 0,
          zIndex: 100,
          background: isHome ? 'transparent' : 'rgba(4, 9, 20, 0.75)',
          backdropFilter: isHome ? 'none' : 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: isHome ? 'none' : 'blur(20px) saturate(180%)',
          padding: '1.25rem 3rem',
          borderBottom: isHome ? 'none' : '1px solid rgba(0, 240, 255, 0.15)',
          transform: navVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), background 0.3s ease',
          boxShadow: isHome ? 'none' : '0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 1px 0 0 rgba(176, 38, 255, 0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1920px', margin: '0 auto' }}>
          
          {/* LEFT SIDE: Home Icon Link + SHAKTRIX Text */}
          <div className="nav-logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link 
              href="/" 
              aria-label="Home" 
              style={{ 
                color: theme === 'light' && (!isHome || isScrolled) ? '#0F172A' : '#ffffff', 
                display: 'flex', 
                alignItems: 'center', 
                transition: 'color 0.2s, opacity 0.2s' 
              }} 
              className="hover-opacity nav-home-symbol"
            >
              <Home size={20} />
            </Link>
            <div style={{ 
              fontWeight: 900, fontSize: '1.35rem', fontFamily: 'var(--font-title)', 
              letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.15rem',
              userSelect: 'none'
            }}>
              <span className="logo-shakt" style={{ color: 'var(--neon-blue)', textShadow: '0 0 15px rgba(0, 240, 255, 0.75)' }}>SHAKT</span>
              <span className="logo-rix" style={{ color: 'var(--neon-purple)', textShadow: '0 0 15px rgba(176, 38, 255, 0.75)' }}>RIX</span>
            </div>
          </div>

          {/* RIGHT SIDE: Single Theme Toggle -> Notification -> Nav Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            
            <nav className="desktop-nav" style={{ display: 'none', alignItems: 'center', gap: '1.75rem' }}>
              
              {/* Single Sun/Moon Icon Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'neon' ? 'Light' : 'Dark'} Mode`}
                title={`Switch to ${theme === 'neon' ? 'Light' : 'Dark'} Mode`}
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: theme === 'neon' ? 'var(--neon-blue)' : 'var(--accent-gold)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxSizing: 'border-box'
                }}
              >
                {theme === 'neon' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              {/* 1. Notification Symbol */}
              {user && (
                <div ref={notifRef} style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotifOpen(!notifOpen);
                    }}
                    aria-label={`Notifications, ${notifications.length} unread`}
                    aria-expanded={notifOpen}
                    style={{
                      position: 'relative',
                      width: '38px',
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: notifOpen ? 'hsla(186, 100%, 48%, 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: notifOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: notifOpen ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      boxSizing: 'border-box'
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
                      className="glass-panel fade-in"
                      style={{
                        position: 'absolute',
                        top: '3rem',
                        right: 0,
                        width: '320px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        zIndex: 1000,
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

              {/* 2. LEADERBOARD */}
              <Link href="/leaderboard" className="zentry-text-link">
                LEADERBOARD
              </Link>

              {/* 3. TOURNAMENTS */}
              <Link href="/tournaments" className="zentry-text-link">
                TOURNAMENTS
              </Link>

              {/* 4. TEAMS */}
              <Link href="/teams" className="zentry-text-link">
                TEAMS
              </Link>

              {/* 5. ABOUT US */}
              <div ref={aboutRef} style={{ position: 'relative' }}>
                <button onClick={() => { setAboutOpen(!aboutOpen); setProductsOpen(false); }} className="zentry-text-link flex items-center gap-1">
                  ABOUT <ChevronDown size={12} />
                </button>
                {aboutOpen && (
                  <div className="zentry-dropdown-menu right-0">
                    <Link href="/about/mission" onClick={() => setAboutOpen(false)} className="dropdown-item">Platform Mission</Link>
                    <Link href="/about/rulebook" onClick={() => setAboutOpen(false)} className="dropdown-item">Rulebook</Link>
                  </div>
                )}
              </div>

              {/* 6. PROFILE */}
              <Link href="/profile" className="zentry-text-link">
                PROFILE
              </Link>

              {/* 7. LOGOUT / AUTH */}
              {user ? (
                <button onClick={promptLogout} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', opacity: 0.8 }} className="hover-opacity" aria-label="Log out">
                  <LogOut size={18} />
                </button>
              ) : (
                !loading && (
                  <>
                    <Link href="/login" className="zentry-text-link">LOGIN</Link>
                    <Link href="/register" className="zentry-text-link">JOIN NOW</Link>
                  </>
                )
              )}
            </nav>

            {/* Mobile Hamburger Menu */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-toggle"
              aria-label="Toggle Navigation Menu"
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.4rem' }}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE DROPDOWN */}
      {mobileMenuOpen && (
         <nav style={{
            position: 'fixed', top: '4.5rem', left: '1rem', right: '1rem', background: 'rgba(4, 9, 20, 0.98)', 
            backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '1.5rem', zIndex: 99,
            display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(0, 240, 255, 0.2)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
         }} className="mobile-dropdown">
            <Link href="/tournaments" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>TOURNAMENTS</Link>
            <Link href="/teams" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>TEAMS</Link>
            <Link href="/glass-demo" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✨ GLASS UI SHOWCASE</Link>
            <Link href="/leaderboard" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>LEADERBOARD</Link>
            <Link href="/about/mission" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>PLATFORM MISSION</Link>
            <Link href="/about/rulebook" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>RULEBOOK</Link>
            <button 
              onClick={() => { toggleTheme(); setMobileMenuOpen(false); }} 
              style={{ 
                background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: '8px', 
                padding: '0.5rem', color: theme === 'neon' ? 'var(--neon-blue)' : 'var(--accent-gold)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                cursor: 'pointer', width: 'fit-content'
              }}
              aria-label={`Switch to ${theme === 'neon' ? 'Light' : 'Dark'} Mode`}
              title={`Switch to ${theme === 'neon' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'neon' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }}/>
            {user ? (
               <>
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', fontWeight: 700 }}>PROFILE</Link>
                  <button onClick={promptLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontWeight: 700, textAlign: 'left', padding: 0 }}>SIGN OUT</button>
               </>
            ) : (
               <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', fontWeight: 700 }}>LOGIN</Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>JOIN NOW</Link>
               </>
            )}
         </nav>
      )}

      {/* GLOBAL ANIMATIONS & STYLING */}
      <style jsx global>{`
        @media (min-width: 1025px) {
          .desktop-nav { display: flex !important; }
          .desktop-actions { display: flex !important; }
          .mobile-toggle { display: none !important; }
          .mobile-dropdown { display: none !important; }
          .mobile-theme-btn { display: none !important; }
        }
        .zentry-pill-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: #fff;
          color: #000;
          padding: 0.4rem 1.25rem;
          border-radius: 9999px;
          fontSize: 0.75rem;
          fontWeight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .zentry-pill-btn:hover {
          transform: scale(1.05);
          background: #e2e8f0;
        }
        .zentry-dropdown-menu {
          position: absolute;
          top: calc(100% + 0.75rem);
          left: 0;
          min-width: 210px;
          background: rgba(6, 12, 26, 0.95);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(0, 240, 255, 0.25);
          border-radius: 14px;
          padding: 0.6rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          z-index: 200;
          animation: dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 240, 255, 0.15), inset 0 0 12px rgba(176, 38, 255, 0.1);
        }
        .zentry-dropdown-menu.right-0 {
          left: auto;
          right: 0;
        }
        .dropdown-item {
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.85);
          padding: 0.75rem 1rem;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .dropdown-item:hover {
          background: rgba(0, 240, 255, 0.12);
          color: var(--neon-blue);
          box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.1);
          transform: translateX(4px);
        }
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .zentry-text-link {
          color: var(--text-primary);
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.95;
          transition: opacity 0.2s;
        }
        .zentry-text-link:hover {
          opacity: 1;
        }
        .zentry-text-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0%;
          height: 1px;
          background: var(--text-primary);
          transition: width 0.3s ease;
        }
        .zentry-text-link:hover::after {
          width: 100%;
        }
        .hover-opacity:hover {
          opacity: 1 !important;
        }
      `}</style>

      {/* LOGOUT CONFIRMATION PERMISSION MODAL */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'rgba(2, 6, 16, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'dropdownFadeIn 0.2s ease forwards'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: 'rgba(6, 12, 26, 0.95)',
            border: '1px solid rgba(255, 60, 60, 0.4)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 60, 60, 0.2)',
            borderRadius: '16px',
            padding: '2rem',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 60, 60, 0.15)',
              border: '1px solid rgba(255, 60, 60, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              color: 'var(--accent-red)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: '#ffffff' }}>
              Confirm Logout
            </h3>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Are you sure you want to log out of your SHAKTRIX account?
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.25rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmLogout}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.25rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #ff3c3c 0%, #aa0000 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(255, 60, 60, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}