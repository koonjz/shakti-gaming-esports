'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy, Users, Award, ArrowUpRight, Zap, Play, GitBranch, Star } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

/* Mini visual bracket diagram for card 1 */
function MiniBracketDiagram() {
  return (
    <svg
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: '280px', opacity: 0.35, marginTop: '1.5rem' }}
      aria-hidden="true"
    >
      {/* Quarter finals */}
      <rect x="0"   y="10"  width="48" height="18" rx="4" fill="rgba(0,240,255,0.25)" stroke="rgba(0,240,255,0.5)" strokeWidth="1"/>
      <rect x="0"   y="36"  width="48" height="18" rx="4" fill="rgba(0,240,255,0.25)" stroke="rgba(0,240,255,0.5)" strokeWidth="1"/>
      <rect x="0"   y="66"  width="48" height="18" rx="4" fill="rgba(0,240,255,0.25)" stroke="rgba(0,240,255,0.5)" strokeWidth="1"/>
      <rect x="0"   y="92"  width="48" height="18" rx="4" fill="rgba(0,240,255,0.25)" stroke="rgba(0,240,255,0.5)" strokeWidth="1"/>
      {/* Lines */}
      <path d="M48 19 L68 19 L68 45 L80 45" stroke="rgba(0,240,255,0.4)" strokeWidth="1.2"/>
      <path d="M48 45 L68 45"               stroke="rgba(0,240,255,0.4)" strokeWidth="1.2"/>
      <path d="M48 75 L68 75 L68 101 L80 101" stroke="rgba(0,240,255,0.4)" strokeWidth="1.2"/>
      <path d="M48 101 L68 101"             stroke="rgba(0,240,255,0.4)" strokeWidth="1.2"/>
      {/* Semi finals */}
      <rect x="80"  y="36"  width="48" height="18" rx="4" fill="rgba(176,38,255,0.25)" stroke="rgba(176,38,255,0.5)" strokeWidth="1"/>
      <rect x="80"  y="66"  width="48" height="18" rx="4" fill="rgba(176,38,255,0.25)" stroke="rgba(176,38,255,0.5)" strokeWidth="1"/>
      <path d="M128 45 L148 45 L148 75 L160 75" stroke="rgba(176,38,255,0.4)" strokeWidth="1.2"/>
      <path d="M128 75 L148 75"                  stroke="rgba(176,38,255,0.4)" strokeWidth="1.2"/>
      {/* Final */}
      <rect x="160" y="66"  width="40" height="18" rx="4" fill="rgba(255,215,0,0.3)" stroke="rgba(255,215,0,0.7)" strokeWidth="1.5"/>
      <text x="180" y="79" textAnchor="middle" fill="rgba(255,215,0,0.9)" fontSize="8" fontWeight="bold">WIN</text>
    </svg>
  );
}

export function BentoGrid() {
  return (
    <section className="section-padding" style={{ position: 'relative', zIndex: 2 }}>
      <div className="container">

        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div className="page-hero-eyebrow" style={{ justifyContent: 'center' }}>
            <Zap size={14} style={{ marginLeft: '0.5rem' }} />
            THE METAGAME ARCHITECTURE
          </div>
          <h2 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 900,
            textTransform: 'uppercase',
            fontFamily: 'var(--font-title)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}>
            POWERING THE{' '}
            <span className="text-gradient-cyan">FUTURE OF ESPORTS</span>
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            maxWidth: '560px',
            margin: '1rem auto 0',
            fontSize: '0.95rem',
            lineHeight: 1.65,
          }}>
            Every tool pro teams need — brackets, squads, rankings, and spectator feeds — unified in one arena.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="bento-grid">

          {/* Card 1: Live Bracket Engine (Span 8) */}
          <article
            className="bento-card bento-col-8"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.07) 0%, var(--bg-tertiary) 100%)',
              borderTop: '3px solid var(--accent-cyan)',
              minHeight: '320px',
            }}
          >
            {/* Decorative overlays */}
            <div className="bento-circuit-overlay" />
            <div className="bento-corner-glow" />

            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <Badge variant="live" style={{ marginBottom: '1rem' }}>
                      <span style={{ marginRight: '0.3rem' }}>⚡</span> REAL-TIME SYNC
                    </Badge>
                    <h3 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                      AUTOMATED<br />BRACKET ENGINE
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', fontSize: '0.95rem', lineHeight: 1.6 }}>
                      Instant match resolution, single &amp; double elimination brackets, automated score validation, and live tournament seeding.
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: 'rgba(0, 240, 255, 0.1)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-cyan)',
                    }}>
                      <GitBranch size={24} />
                    </div>
                  </div>
                </div>
                <MiniBracketDiagram />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <Link href="/tournaments">
                  <Button variant="primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '10px' }}>
                    <Trophy size={16} />
                    EXPLORE BRACKETS
                    <ArrowUpRight size={16} />
                  </Button>
                </Link>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  300+ tournaments hosted
                </span>
              </div>
            </div>
          </article>

          {/* Card 2: Squad Builder (Span 4) */}
          <article
            className="bento-card bento-col-4"
            style={{
              borderTop: '3px solid var(--accent-violet)',
              minHeight: '320px',
              background: 'linear-gradient(135deg, rgba(176, 38, 255, 0.07) 0%, var(--bg-tertiary) 100%)',
            }}
          >
            <div className="bento-circuit-overlay" />
            <div className="bento-corner-glow" style={{
              background: 'radial-gradient(ellipse at top left, rgba(176, 38, 255, 0.14) 0%, transparent 70%)',
            }} />

            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{
                  background: 'rgba(176, 38, 255, 0.1)',
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-violet)',
                  border: '1px solid rgba(176, 38, 255, 0.3)',
                  marginBottom: '1.25rem',
                }}>
                  <Users size={24} />
                </div>
                <h3 style={{ fontSize: 'clamp(1.25rem, 2vw, 1.6rem)', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                  PRO SQUAD BUILDER
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Assemble your roster, recruit top gamertags by role preference, and manage team captains with invite notifications.
                </p>

                {/* Role tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '1.25rem' }}>
                  {['Duelist', 'Support', 'AWPer', 'IGL', 'Entry'].map(role => (
                    <span key={role} style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.3rem 0.7rem',
                      borderRadius: '9999px',
                      background: 'rgba(176, 38, 255, 0.12)',
                      border: '1px solid rgba(176, 38, 255, 0.25)',
                      color: 'var(--accent-violet)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <Link href="/teams" style={{ marginTop: '2rem' }}>
                <Button variant="outline" style={{ width: '100%', justifyContent: 'center', borderRadius: '10px' }}>
                  BUILD ROSTER
                </Button>
              </Link>
            </div>
          </article>

          {/* Card 3: Spectator Arena (Span 4) */}
          <article
            className="bento-card bento-col-4"
            style={{
              borderTop: '3px solid var(--accent-gold)',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.07) 0%, var(--bg-tertiary) 100%)',
              minHeight: '300px',
            }}
          >
            <div className="bento-circuit-overlay" />
            <div className="bento-corner-glow" style={{
              background: 'radial-gradient(ellipse at top left, rgba(255, 215, 0, 0.12) 0%, transparent 70%)',
            }} />

            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <Badge variant="gold" style={{ marginBottom: '1rem' }}>
                  <span className="live-dot" style={{ marginRight: '0.35rem' }} />
                  LIVE STREAM
                </Badge>
                <h3 style={{ fontSize: 'clamp(1.25rem, 2vw, 1.6rem)', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                  SPECTATOR<br />ARENA
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Watch tournament matches unfold live with real-time updates and commentary feeds.
                </p>

                {/* Fake "viewers online" stat */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '1rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  background: 'rgba(255, 215, 0, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.25)',
                }}>
                  <Star size={12} style={{ color: 'var(--accent-gold)' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '0.06em' }}>
                    248 WATCHING NOW
                  </span>
                </div>
              </div>

              <Link href="/tournaments" style={{ marginTop: '2rem' }}>
                <Button variant="outline" style={{ width: '100%', justifyContent: 'center', borderRadius: '10px' }}>
                  <Play size={14} fill="currentColor" /> SPECTATE NOW
                </Button>
              </Link>
            </div>
          </article>

          {/* Card 4: Hall of Fame Leaderboard (Span 8) */}
          <article
            className="bento-card bento-col-8"
            style={{ minHeight: '300px' }}
          >
            <div className="bento-circuit-overlay" />
            <div className="bento-corner-glow" />

            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <Badge variant="cyan">HALL OF FAME</Badge>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    REAL-TIME XP STREAM
                  </span>
                </div>

                <h3 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                  GLOBAL PLAYER<br />&amp; TEAM RANKINGS
                </h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Track performance XP points, tournament victories, and individual gamertag skill rankings updated live from Cloud Firestore.
                </p>

                {/* Fake mini-leaderboard rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', maxWidth: '400px' }}>
                  {[
                    { rank: 1, name: 'ShadowKnight', xp: '12,480', color: 'var(--accent-gold)' },
                    { rank: 2, name: 'NightReaper',  xp: '11,250', color: 'hsl(210,20%,80%)' },
                    { rank: 3, name: 'PixelStrike',  xp: '10,890', color: 'hsl(25,80%,60%)' },
                  ].map(p => (
                    <div key={p.rank} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                    }}>
                      <span style={{ fontFamily: 'var(--font-title)', fontWeight: 900, fontSize: '0.85rem', color: p.color, width: '20px', textAlign: 'center' }}>
                        #{p.rank}
                      </span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.name}</span>
                      <span style={{ fontFamily: 'var(--font-title)', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{p.xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <Link href="/leaderboard">
                  <Button variant="primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '10px' }}>
                    <Award size={16} />
                    VIEW LEADERBOARD
                    <ArrowUpRight size={16} />
                  </Button>
                </Link>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  1,400+ ranked players
                </span>
              </div>
            </div>
          </article>

        </div>
      </div>
    </section>
  );
}

export default BentoGrid;
