'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { tournamentService, Tournament } from '@/services/tournamentService';
import { useAppStore } from '@/store/useAppStore';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { Trophy, Gamepad2, Users, Flame, ChevronRight, Activity, Radio, Zap, ArrowDownRight, Sparkles, Shield, Star } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import GlassCard from '@/components/ui/GlassCard';
import StatsTicker from '@/components/ui/StatsTicker';
import BentoGrid from '@/components/ui/BentoGrid';
import { TournamentCountdown } from '@/components/TournamentCountdown';
import { getEffectiveTournamentStatus, autoCheckTournamentStatus, useEffectiveTournamentStatus } from '@/lib/tournamentUtils';
import { initScrollReveals } from '@/animations/scroll';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const HOME_GAME_COLORS: Record<string, string> = {
  valorant:        'linear-gradient(90deg, #FF4655, #BD3744)',
  'league of legends': 'linear-gradient(90deg, #C89B3C, #785A28)',
  'cs:go':         'linear-gradient(90deg, #F4960B, #B36B00)',
  'apex legends':  'linear-gradient(90deg, #CD3333, #7D1F1F)',
  'rocket league': 'linear-gradient(90deg, #00A3FF, #0055AA)',
  'overwatch 2':   'linear-gradient(90deg, #F99E1A, #E67E22)',
};

function HomeTournamentCard({ tournament: t }: { tournament: Tournament }) {
  const effStatus = useEffectiveTournamentStatus(t);
  const registeredCount = t.registeredTeamIds?.length || 0;
  const fillPct = Math.min(100, (registeredCount / Math.max(t.maxTeams, 1)) * 100);
  const isFull = registeredCount >= t.maxTeams;
  const accent = HOME_GAME_COLORS[t.game.toLowerCase()] ?? 'linear-gradient(90deg, var(--accent-cyan), var(--accent-violet))';

  return (
    <article className="tournament-card-pro">
      {/* Game-colored accent bar */}
      <div className="tournament-card-accent" style={{ background: accent }} />

      <div className="tournament-card-body">
        {/* Status + game badges */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <Badge variant={effStatus === 'Active' ? 'live' : effStatus === 'Upcoming' ? 'cyan' : 'gold'}>
            {effStatus === 'Active' ? 'Live' : effStatus}
          </Badge>
          <Badge variant="cyan" style={{ fontSize: '0.72rem' }}>{t.game}</Badge>
        </div>

        <h3 className="tournament-card-title">{t.name}</h3>

        <div style={{ marginBottom: '1rem' }}>
          <TournamentCountdown tournament={t} compact={true} />
        </div>

        {/* Slot progress bar */}
        <div className="tournament-card-slots">
          <div className="slots-bar-track">
            <div
              className="slots-bar-fill"
              style={{
                width: `${fillPct}%`,
                background: isFull ? 'linear-gradient(90deg, var(--accent-red), #CC0044)' : accent,
              }}
            />
          </div>
          <span className="slots-text" style={{ color: isFull ? 'var(--accent-red)' : undefined }}>
            {registeredCount}/{t.maxTeams}{isFull ? ' FULL' : ''}
          </span>
        </div>
      </div>

      <div className="tournament-card-cta">
        <Link href={`/tournaments/${t.id}`}>
          <Button variant={effStatus === 'Active' ? 'primary' : 'outline'}>
            {effStatus === 'Active' ? 'Spectate Bracket' : effStatus === 'Completed' ? 'View Results' : 'View Details'}
          </Button>
        </Link>
      </div>
    </article>
  );
}

const SUPPORTED_GAMES = [
  {
    name: "Valorant",
    desc: "Tactical 5v5 character-based shooter where precise gunplay meets unique agent abilities.",
    roles: ["Duelist", "Sentinel", "Initiator", "Controller"],
    video: "/videos/valorant.mp4",
    bentoClass: "bento-wide"
  },
  {
    name: "League of Legends",
    desc: "A team-based strategy game where two teams of five champions face off to destroy the enemy Nexus.",
    roles: ["Top", "Jungler", "Mid", "ADC", "Support"],
    video: "/videos/lol.mp4",
    bentoClass: "bento-square"
  },
  {
    name: "CS:GO",
    desc: "The classic competitive tactical shooter focused on team strategy, economy, and precision recoil control.",
    roles: ["Entry Fragger", "AWPer", "Lurker"],
    video: "/videos/csgo.mp4",
    bentoClass: "bento-square"
  },
  {
    name: "Apex Legends",
    desc: "Fast-paced battle royale featuring legendary characters teaming up on the frontier.",
    roles: ["Scout", "Offensive", "Defensive"],
    video: "/videos/apex.mp4",
    bentoClass: "bento-square" 
  },
  {
    name: "Rocket League",
    desc: "High-flying, physics-based soccer with booster-equipped vehicles.",
    roles: ["Striker", "Defender"],
    video: "/videos/rocketleague.mp4",
    bentoClass: "bento-square" 
  },
  {
    name: "Overwatch 2",
    desc: "A vibrant team-based shooter set in an optimistic future battlefield.",
    roles: ["Tank", "Damage", "Support"],
    video: "/videos/overwatch.mp4",
    bentoClass: "bento-wide"
  }
];

const ZentryBentoCard = ({ game }: { game: typeof SUPPORTED_GAMES[0] }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <article className={`zentry-bento-card ${game.bentoClass}`}>
      <div className="zentry-bento-media">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="zentry-video"
        >
          <source src={game.video} type="video/mp4" />
        </video>
        <div className="zentry-bento-overlay" />
      </div>

      <div className="zentry-bento-content">
        <div>
          <h3 className="zentry-bento-title">{game.name}</h3>
          <p className="zentry-bento-desc">{game.desc}</p>
        </div>
        
        <div className="zentry-bento-footer">
          <div className="zentry-bento-roles">
            {game.roles.map(r => (
              <span key={r} className="zentry-role-badge">{r}</span>
            ))}
          </div>

          <Link 
            href={`/tournaments?game=${encodeURIComponent(game.name)}`} 
            style={{ 
              fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-cyan)', 
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem', 
              textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none' 
            }} 
            className="hover-cyan"
          >
            Explore Tournaments <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default function HomeView() {
  const user = useAppStore((state) => state.user);
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const heroWrapperRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = tournamentService.subscribeRecentTournaments(
      3,
      (list) => {
        setActiveTournaments(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    initScrollReveals();

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!heroWrapperRef.current) return;
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches);

    const ctx = gsap.context(() => {
      gsap.fromTo('.zentry-reveal-text', 
        { y: 30, opacity: 0 }, 
        { 
          y: 0, opacity: 1, duration: isMobile ? 0.5 : 0.8, stagger: 0.1, 
          ease: 'power2.out', 
          scrollTrigger: { trigger: sectionRef.current, start: 'top 85%' }
        }
      );
    }, heroWrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <main style={{ position: 'relative', overflowX: 'hidden', background: 'transparent' }}>
      
      {/* UNLEASH THE GAME HERO SECTION */}
      <section 
        ref={heroWrapperRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          minHeight: '85vh', 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '8rem 1.5rem 4rem 1.5rem',
          background: 'radial-gradient(ellipse at 50% 20%, rgba(0, 240, 255, 0.15) 0%, rgba(176, 38, 255, 0.08) 45%, var(--bg-primary) 85%)',
          overflow: 'hidden'
        }}
      >
        <div className="ambient-glow-cyan" style={{ top: '15%', left: '20%', opacity: 0.3 }} />

        <div className="ambient-glow-violet" style={{ bottom: '15%', right: '20%', opacity: 0.3 }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: '900px', margin: '0 auto' }}>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 240, 255, 0.08)', backdropFilter: 'blur(12px)', padding: '0.5rem 1.25rem', borderRadius: '9999px', border: '1px solid var(--border-color)', marginBottom: '1.75rem' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              ESPORTS TOURNAMENTS & BRACKETS
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.8rem, 6.5vw, 5.5rem)', lineHeight: '1.05', fontWeight: 900, letterSpacing: '0.02em', textTransform: 'uppercase', fontFamily: 'var(--font-title)', marginBottom: '1.5rem' }}>
            UNLEASH THE <span style={{ color: 'var(--neon-blue)', textShadow: '0 0 35px rgba(0, 240, 255, 0.85)' }}>GAME</span>
            <br />
            <span style={{ fontSize: '0.7em', color: 'var(--text-primary)' }}>DOMINATE THE <span style={{ color: 'var(--neon-purple)', textShadow: '0 0 35px rgba(176, 38, 255, 0.85)' }}>BRACKET</span></span>
          </h1>

          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto 2.5rem auto', lineHeight: 1.6, fontWeight: 400 }}>
            SHAKTRIX is the central hub for competitive gamers. Recruit elite teammates, manage tournament brackets in real-time, build pro rosters, and climb the live Hall of Fame.
          </p>

          <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <>
                <Link href="/tournaments" className="btn btn-primary glow-pulse" style={{ padding: '0.9rem 2.2rem', borderRadius: '12px', fontSize: '1.05rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trophy size={18} /> Enter Arena <ArrowDownRight size={18} />
                </Link>
                <Link href="/teams" className="btn btn-outline" style={{ padding: '0.9rem 2.2rem', borderRadius: '12px', fontSize: '1.05rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} /> Manage Team
                </Link>
              </>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary glow-pulse" style={{ padding: '0.9rem 2.2rem', borderRadius: '12px', fontSize: '1.05rem' }}>
                  Create Player Profile
                </Link>
                <Link href="/tournaments" className="btn btn-outline" style={{ padding: '0.9rem 2.2rem', borderRadius: '12px', fontSize: '1.05rem' }}>
                  Explore Brackets
                </Link>
              </>
            )}
          </div>

        </div>
      </section>

      {/* Stats Ticker Banner */}
      <div className="container" style={{ position: 'relative', zIndex: 10, marginTop: '2rem', marginBottom: '4rem' }}>
        <StatsTicker />
      </div>

      {/* Chapter 2: Zentry Bento Grid Feature Showcase */}
      <div data-scroll-section>
        <BentoGrid />
      </div>

      {/* ZENTRY BENTO GRID SECTION WITH RESTORED LINKS */}
      <section 
        ref={sectionRef} 
        className="section-padding"
        style={{ 
          background: 'linear-gradient(180deg, rgba(2, 4, 10, 0.40) 0%, rgba(10, 13, 24, 0.50) 50%, rgba(2, 4, 10, 0.40) 100%)', 
          position: 'relative', 
          zIndex: 2,
          borderTop: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="container">
          
          <div style={{ marginBottom: '4rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ overflow: 'hidden' }}>
              <p className="zentry-reveal-text" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-cyan)' }}>
                Explore SHAKTRIX's Integrated Arenas
              </p>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p className="zentry-reveal-text" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', maxWidth: '600px', lineHeight: 1.6, fontWeight: 500 }}>
                Select your battleground, customize your roles, and experience high-stakes esports matchmaking built for the modern competitive player.
              </p>
            </div>
          </div>

          {/* The Bento Grid */}
          <div className="zentry-bento-grid">
            {SUPPORTED_GAMES.map(game => (
              <ZentryBentoCard key={game.name} game={game} />
            ))}
          </div>

        </div>
      </section>

      {/* Chapter 4: Active Championship Arenas Section */}
      <section data-scroll-section className="section-padding" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '3rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-violet)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                <Flame size={16} /> Active Arenas
              </div>
              <h2 style={{ fontSize: '2.25rem', textTransform: 'uppercase', fontWeight: 900 }}>Championship Clashes</h2>
            </div>
            <Link href="/tournaments" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600, color: 'var(--accent-cyan)' }} className="hover-cyan">
              View All Brackets <ChevronRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="grid-responsive">
              {[1, 2, 3].map((n) => (
                <div key={n} className="glass-panel skeleton-pulse" style={{ padding: '2rem', height: '220px' }} />
              ))}
            </div>
          ) : activeTournaments.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {activeTournaments.map((t) => (
                <HomeTournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          ) : (
            <GlassCard variant="panel" style={{ 
              textAlign: 'center', 
              padding: '3rem 2rem', 
              border: '1px solid rgba(0, 240, 255, 0.25)',
              background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.05) 0%, rgba(6, 12, 28, 0.9) 100%)' 
            }}>
              <Trophy size={40} style={{ color: 'var(--accent-cyan)', margin: '0 auto 1rem auto', opacity: 0.8 }} />
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                No Active Championship Arenas Listed
              </h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
                Tournament organizers have not scheduled live clashes for this timeslot. Create a roster or host the first tournament.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/tournaments">
                  <Button variant="primary" style={{ borderRadius: '9999px', padding: '0.75rem 1.75rem' }}>
                    Explore All Arenas
                  </Button>
                </Link>
              </div>
            </GlassCard>
          )}
        </div>
      </section>

      {/* BENTO STYLES */}
      <style jsx global>{`
        .zentry-bento-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        
        @media (min-width: 768px) {
          .zentry-bento-grid {
            grid-template-columns: repeat(3, 1fr);
            grid-auto-rows: 420px;
          }
          .bento-wide {
            grid-column: span 2;
          }
          .bento-square {
            grid-column: span 1;
          }
        }

        .zentry-bento-card {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .zentry-bento-card:hover {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 30px var(--border-glow), inset 0 0 15px var(--border-glow);
          transform: translateY(-6px);
        }

        .zentry-bento-media {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .zentry-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.7;
          transform: scale(1);
          transition: transform 0.8s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.8s ease;
        }

        .zentry-bento-card:hover .zentry-video {
          transform: scale(1.08);
          opacity: 0.95;
        }

        .zentry-bento-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(6, 11, 25, 0.2) 0%, rgba(6, 11, 25, 0.9) 100%);
          transition: opacity 0.4s ease;
        }

        .zentry-bento-card:hover .zentry-bento-overlay {
          opacity: 0.4;
        }

        .zentry-bento-content {
          position: relative;
          z-index: 10;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2.5rem;
        }

        .zentry-bento-title {
          font-family: var(--font-title);
          font-size: clamp(2.2rem, 4vw, 3.5rem);
          font-weight: 900;
          text-transform: uppercase;
          line-height: 0.9;
          letter-spacing: -0.02em;
          color: #FFFFFF !important;
          text-shadow: 0 2px 20px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8);
          margin-bottom: 0.75rem;
          transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .zentry-bento-desc {
          font-size: 0.95rem;
          color: rgba(237, 244, 255, 0.92) !important;
          line-height: 1.5;
          max-width: 420px;
          margin-bottom: 1rem;
          text-shadow: 0 1px 8px rgba(0,0,0,0.95);
        }

        .zentry-bento-footer {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .zentry-bento-roles {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          opacity: 0;
          transform: translateY(12px);
          transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .zentry-bento-card:hover .zentry-bento-roles {
          opacity: 1;
          transform: translateY(0);
        }

        .zentry-role-badge {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 0.4rem 0.85rem;
          background: rgba(0, 240, 255, 0.18) !important;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(0, 240, 255, 0.4) !important;
          border-radius: 9999px;
          color: #FFFFFF !important;
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.25);
        }
      `}</style>
    </main>
  );
}