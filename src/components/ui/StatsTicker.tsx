'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface StatItem {
  label: string;
  value: string;
  color?: string;
  icon?: string;
}

export interface StatsTickerProps {
  stats?: StatItem[];
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_STATS: StatItem[] = [
  { label: 'Active Arenas',  value: '12+',   color: 'var(--accent-cyan)',   icon: '🎮' },
  { label: 'Prize Pools',    value: '$50K+', color: 'var(--accent-violet)', icon: '🏆' },
  { label: 'Pro Players',    value: '1.4K+', color: 'var(--accent-gold)',   icon: '⚡' },
  { label: 'Real-time Sync', value: '99.9%', color: 'var(--accent-green)',  icon: '🔴' },
  { label: 'Tournaments Run',value: '300+',  color: 'var(--accent-cyan)',   icon: '🎯' },
  { label: 'Matches Played', value: '8.2K+', color: 'var(--accent-violet)', icon: '🎲' },
];

export const StatsTicker: React.FC<StatsTickerProps> = ({
  stats,
  className = '',
  style = {}
}) => {
  const [tickerItems, setTickerItems] = useState<StatItem[]>(stats || DEFAULT_STATS);

  useEffect(() => {
    const q = query(
      collection(db, 'matchHistory'),
      orderBy('resolvedAt', 'desc'),
      limit(4)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setTickerItems(stats || DEFAULT_STATS);
        return;
      }
      // Keep DEFAULT_STATS-style format when we have match history
      const matchItems: StatItem[] = snap.docs.map((doc) => {
        const d = doc.data();
        const winner = d.winnerId === d.team1Id ? d.team1Name : d.team2Name;
        return {
          label: `${d.team1Name} vs ${d.team2Name}`,
          value: `🏆 ${winner}`,
          color: 'var(--accent-green)',
          icon: '🎮',
        };
      });
      // Merge with defaults to keep 6+ items for smooth loop
      setTickerItems([...DEFAULT_STATS.slice(0, 3), ...matchItems]);
    }, () => {
      setTickerItems(stats || DEFAULT_STATS);
    });

    return () => unsub();
  }, [stats]);

  // Duplicate items for seamless infinite loop
  const loopItems = [...tickerItems, ...tickerItems];

  return (
    <div className={`stats-ticker-outer ${className}`} style={{ ...style }}>
      {/* LIVE badge — floats over the left fade */}
      <div className="stats-ticker-live-badge">
        <span className="live-dot" />
        LIVE
      </div>

      <div className="stats-ticker-track" style={{ paddingLeft: '5rem' }}>
        {loopItems.map((item, i) => (
          <div key={i} className="stats-ticker-item">
            {/* Icon bubble */}
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: `rgba(${item.color === 'var(--accent-cyan)' ? '0,240,255' : item.color === 'var(--accent-violet)' ? '176,38,255' : item.color === 'var(--accent-gold)' ? '255,215,0' : '0,255,136'}, 0.1)`,
              border: `1px solid rgba(${item.color === 'var(--accent-cyan)' ? '0,240,255' : item.color === 'var(--accent-violet)' ? '176,38,255' : item.color === 'var(--accent-gold)' ? '255,215,0' : '0,255,136'}, 0.25)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0,
            }}>
              {item.icon}
            </div>

            <div>
              <div className="stats-ticker-value stat-number-pop" style={{ color: item.color }}>
                {item.value}
              </div>
              <div className="stats-ticker-label">{item.label}</div>
            </div>

            {/* Separator dot */}
            <div style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: 'var(--border-color)',
              flexShrink: 0,
              marginLeft: '1.5rem',
            }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsTicker;
