'use client';

import React, { useState } from 'react';
import GlassCard from '@/components/GlassCard';

export default function GlassDemoPage() {
  const [theme, setTheme] = useState<'default' | 'neon'>('neon');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState('all');

  return (
    <div data-theme={theme === 'neon' ? 'neon' : undefined} className="min-h-screen pb-24 text-slate-100 font-sans">
      
      {/* 1. FIXED NAVBAR (.navbar-glass) */}
      <header className="navbar-glass sticky top-0 z-40 w-full px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00f0ff] to-[#8b5cf6] flex items-center justify-center font-black text-black text-sm shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              SG
            </div>
            <span className="font-extrabold text-lg tracking-wider text-white">
              SHAKTI<span className="text-[#00f0ff]">.ESPORTS</span>
            </span>
            <span className="zentry-role-badge ml-2">PRO TIER</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300">
            <span className="text-[#00f0ff] hover:text-white transition-colors cursor-pointer">Tournaments</span>
            <span className="hover:text-white transition-colors cursor-pointer">Teams</span>
            <span className="hover:text-white transition-colors cursor-pointer">Leaderboards</span>
            <span className="hover:text-white transition-colors cursor-pointer">Brackets</span>
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'neon' ? 'default' : 'neon')}
              className="glass-input px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#00f0ff] hover:border-[#00f0ff] transition-all cursor-pointer"
            >
              Theme: {theme}
            </button>

            {/* Dropdown Menu Toggle */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="glass-input px-3.5 py-1.5 text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
              >
                <span>Menu</span>
                <span className="text-[#00f0ff]">▾</span>
              </button>

              {/* .zentry-dropdown-menu */}
              {isDropdownOpen && (
                <div className="zentry-dropdown-menu absolute right-0 mt-2 w-56 p-2 z-50 flex flex-col gap-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-cyan-500/20">
                    Esports Hub
                  </div>
                  <button className="text-left px-3 py-2 text-xs font-semibold hover:bg-cyan-500/10 hover:text-[#00f0ff] rounded-lg transition-colors">
                    Manage Roster
                  </button>
                  <button className="text-left px-3 py-2 text-xs font-semibold hover:bg-cyan-500/10 hover:text-[#00f0ff] rounded-lg transition-colors">
                    Bracket Seedings
                  </button>
                  <button className="text-left px-3 py-2 text-xs font-semibold hover:bg-cyan-500/10 hover:text-[#00f0ff] rounded-lg transition-colors">
                    Match Schedules
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <main className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        <div className="text-center space-y-4">
          <div className="hero-pill mx-auto">
            ⚡ Neon Glassmorphism System Live
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white">
            Dark Neon <span className="text-[#00f0ff]">Cyan</span> & <span className="text-[#8b5cf6]">Violet</span> Glass UI
          </h1>
          <p className="max-w-2xl mx-auto text-sm md:text-base text-slate-400">
            Engineered with deep alpha overlays, dual backdrop-filters, specular cyan borders, and accessible reduced-motion states.
          </p>
        </div>

        {/* 3. FILTER BAR (.glass-panel + .glass-input + .glass-select) */}
        <section>
          <GlassCard variant="panel" className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="w-full md:w-1/2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Search Tournaments & Teams
                </label>
                <input
                  type="text"
                  placeholder="Search by team tag, player Gamer ID, or tournament..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Filter Title
                </label>
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="glass-select w-full"
                >
                  <option value="all">All Disciplines</option>
                  <option value="bgmi">BGMI Invitational</option>
                  <option value="valorant">Valorant Champions</option>
                  <option value="freefire">Free Fire Max Cup</option>
                </select>
              </div>

              <div className="w-full md:w-auto pt-6">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#8b5cf6] text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-90 shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-opacity cursor-pointer"
                >
                  Open Glass Modal
                </button>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 4. GRID OF GLASSCARDS (<GlassCard variant="card" hoverable>) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-wide">
              Active Tournament Rosters & Matches
            </h2>
            <span className="text-xs text-slate-400 font-mono">3 Active Brackets</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Bracket Match Card */}
            <GlassCard variant="card" hoverable className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="zentry-role-badge">Grand Finals</span>
                <span className="text-xs font-mono text-[#00f0ff]">LIVE NOW</span>
              </div>
              <h3 className="text-lg font-bold text-white">Shakti Warriors vs Team Astra</h3>
              <p className="text-xs text-slate-400">
                Best of 5 map decider. Winner secures seed slot in national qualifiers.
              </p>
              
              {/* Nested bracket match preview */}
              <div className="bracket-match-card p-3 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-slate-200">
                  <span>SW • Warriors</span>
                  <span className="text-[#00f0ff]">2</span>
                </div>
                <div className="flex justify-between font-bold text-slate-400">
                  <span>AST • Astra</span>
                  <span>1</span>
                </div>
              </div>
            </GlassCard>

            {/* Card 2: Team Roster Card */}
            <GlassCard variant="card" hoverable className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="zentry-role-badge">Roster 5/5</span>
                <span className="text-xs font-mono text-[#8b5cf6]">Rank #1</span>
              </div>
              <h3 className="text-lg font-bold text-white">Delta Valkyries</h3>
              <p className="text-xs text-slate-400">
                Tier-1 competitive female gaming squad specializing in tactical shooters.
              </p>
              <div className="bracket-match-card p-3 flex items-center justify-between text-xs">
                <span className="text-slate-300">Win Rate</span>
                <span className="font-extrabold text-[#00f0ff]">84.6%</span>
              </div>
            </GlassCard>

            {/* Card 3: Bounty Pool Card */}
            <GlassCard variant="card" hoverable className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="zentry-role-badge">Escrow Safe</span>
                <span className="text-xs font-mono text-[#00f0ff]">₹2,50,000 Pool</span>
              </div>
              <h3 className="text-lg font-bold text-white">Spring Championship</h3>
              <p className="text-xs text-slate-400">
                Automated payout release upon match referee confirmation.
              </p>
              <div className="bracket-match-card p-3 flex items-center justify-between text-xs">
                <span className="text-slate-300">Slots Remaining</span>
                <span className="font-extrabold text-[#8b5cf6]">4 / 32</span>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* 5. LARGE STATS CONTAINER (<GlassCard variant="panel">) */}
        <section>
          <GlassCard variant="panel" className="p-8 space-y-6">
            <h2 className="text-2xl font-black text-white">Tournament Bracket Standings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-cyan-500/20 text-slate-400 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="pb-3">Team Name</th>
                    <th className="pb-3">Matches</th>
                    <th className="pb-3">W / L</th>
                    <th className="pb-3">Kill Pts</th>
                    <th className="pb-3 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/10 font-medium">
                  <tr>
                    <td className="py-3.5 font-bold text-white">Shakti Gaming Prime</td>
                    <td>12</td>
                    <td>10 - 2</td>
                    <td>142</td>
                    <td className="text-right font-extrabold text-[#00f0ff]">214</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 font-bold text-white">Cyber Vixens Esports</td>
                    <td>12</td>
                    <td>9 - 3</td>
                    <td>128</td>
                    <td className="text-right font-extrabold text-[#00f0ff]">196</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 font-bold text-white">Neon Valkyries</td>
                    <td>12</td>
                    <td>8 - 4</td>
                    <td>115</td>
                    <td className="text-right font-extrabold text-[#8b5cf6]">178</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassCard>
        </section>
      </main>

      {/* 6. MODAL OVERLAY (.modal-backdrop-glass + .glass-panel) */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="modal-backdrop-glass fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel max-w-md w-full p-6 space-y-5 text-white"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h3 className="text-lg font-bold text-white">Match Registration</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Confirm team roster entry for the upcoming qualifier match. Your squad captain will receive match lobby keys 15 minutes prior to game time.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="glass-input px-4 py-2 text-xs font-bold hover:border-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#8b5cf6] text-black font-extrabold text-xs shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer"
              >
                Confirm Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FLOATING CHAT WIDGET PANEL (.chat-widget-glass) */}
      <aside className="chat-widget-glass fixed bottom-6 right-6 w-80 p-4 hidden lg:block z-30">
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse"></span>
            <span className="text-xs font-bold text-white">Match Operations Live</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">LOBBY #1</span>
        </div>
        <p className="text-[11px] text-slate-300">
          Server 04 map veto complete. Waiting for Team Astra to ready up.
        </p>
      </aside>

    </div>
  );
}
