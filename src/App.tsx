/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Globe, DollarSign, Activity, Smartphone, Loader2, AlertCircle, RefreshCcw, Youtube, Twitter, MessageSquare, ChevronDown } from "lucide-react";

interface PlayerEvent {
  event: string;
  region: string;
  placement: number;
  earnings: number;
  date: string;
  category?: string;
}

interface Player {
  rank: number;
  name: string;
  earningsUSD: number;
  countryCode: string;
  primaryRegion: string;
  lastActiveTournament: string;
  lastActiveDate: string;
  events?: PlayerEvent[];
}

const REGIONS = ["GLOBAL", "EUROPE", "NA-CENTRAL", "NA-WEST", "MIDDLE EAST", "OCEANIA", "ASIA", "BRAZIL"];

const CLAN_MAPPINGS: Record<string, string> = {
  'mtb andreshter-': 'MTB',
  'MTB Assad': 'MTB',
  'MTB Dizzy': 'MTB',
  'MTB Frz': 'MTB',
  'MTB H': 'MTB',
  'MTB Keyxity ǃ': 'MTB',
  'MTB Hashim': 'MTB',
  'MTB Duy': 'MTB',
  'MTB Hardman': 'MTB',
  'Fear MTB Adniq': 'MTB',
  'FNX IAMNOOB.': 'MTB',
  'DC Greifer': 'DC',
  'DC Ultra': 'DC',
  'DC kunzite': 'DC',
  'DC rayderr': 'DC',
  'dogeeedagoon': 'DC',
  'kals ngumoha': 'DC',
  'revertaimassist': 'DC',
  'HWP Mohanad': 'DC',
  'DC Griefer': 'DC',
  'defaultdagoon': 'DC',
  'Yuan Khan': 'DC',
  'qual arc papier!': 'DC',
  'Ololo Lostytard7': 'Ololo',
  'Ololo Ali': 'Ololo',
  'Ololo ZizNtmFdp': 'Ololo',
  'Ololo Chatpomme': 'Ololo',
  'XSET Losty': 'Ololo',
  'Evil Rowan Ψ': 'Ololo',
  'み Nikito Android': 'Origin',
  'Origin EaeGui': 'Origin'
};

function getClanIcon(playerName: string) {
  const lowerName = playerName.toLowerCase();
  for (const [name, clan] of Object.entries(CLAN_MAPPINGS)) {
    if (name.toLowerCase() === lowerName) return clan;
  }
  return null;
}

function ClanBadge({ clan, className }: { clan: string, className?: string }) {
  return (
    <div className="relative group flex items-center justify-center">
      <img 
        src={`/clans/${clan}.png`} 
        alt={`${clan} Clan`}
        className={className}
      />
      <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#141416] border border-[#FCE14B]/30 text-[#FCE14B] text-[10px] uppercase font-black tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-[0_0_15px_rgba(252,225,75,0.15)] z-50">
        {clan} Clan
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  // New Filter/Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'earnings' | 'name' | 'date'>('earnings');
  const [selectedRegion, setSelectedRegion] = useState('GLOBAL');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const [dataSource, setDataSource] = useState<string>('syncing');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Event category toggles (Mobile Series is always on)
  const [includeBlitz, setIncludeBlitz] = useState(false);
  const [includeTestCup, setIncludeTestCup] = useState(false);
  const [includeReload, setIncludeReload] = useState(false);

  const fetchLeaderboard = async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError(null);
    try {
      // Check frontend cache first (30 min TTL — matches GitHub Actions cron frequency)
      const cached = localStorage.getItem('leaderboard_cache_v2');
      if (cached && !isRetry) {
        const { players: cachedPlayers, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          setPlayers(cachedPlayers);
          setLastUpdated(new Date(timestamp).toLocaleTimeString());
          setDataSource('local-cache');
          setLoading(false);
          return;
        }
      }

      // Fetch the static pre-aggregated JSON (built by GitHub Actions)
      const response = await fetch('/leaderboard.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.players && data.players.length > 0) {
        setPlayers(data.players);
        setLastUpdated(new Date(data.lastUpdated || Date.now()).toLocaleTimeString());
        setDataSource(data.source || 'osirion-aggregated');
        setLoading(false);

        // Cache locally
        localStorage.setItem('leaderboard_cache_v2', JSON.stringify({
          players: data.players,
          timestamp: Date.now()
        }));
      } else {
        throw new Error('Empty leaderboard response');
      }

    } catch (err) {
      console.error("Fetch Error:", err);
      setError("Unable to load leaderboard data. Please try again.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedRegion, sortBy, includeBlitz, includeTestCup, includeReload]);

  // Build active category set based on toggles
  const activeCategories = new Set(['series']);
  if (includeBlitz) activeCategories.add('blitz');
  if (includeTestCup) activeCategories.add('testcup');
  if (includeReload) activeCategories.add('reload');

  // Filter events by active categories
  const filterByCategory = (events: PlayerEvent[] | undefined): PlayerEvent[] | undefined => {
    if (!events) return events;
    return events.filter(e => activeCategories.has(e.category || 'series'));
  };

  // Compute earnings from active categories only
  const getCategoryEarnings = (player: Player): number => {
    if (!player.events) return player.earningsUSD;
    return player.events
      .filter(e => activeCategories.has(e.category || 'series'))
      .reduce((sum, e) => sum + e.earnings, 0);
  };

  // Compute region + category filtered earnings
  const getFilteredEarnings = (player: Player, region: string): number => {
    if (!player.events) return player.earningsUSD;
    return player.events
      .filter(e => activeCategories.has(e.category || 'series') && (region === 'GLOBAL' || e.region === region))
      .reduce((sum, e) => sum + e.earnings, 0);
  };

  const getFilteredEvents = (player: Player, region: string): PlayerEvent[] | undefined => {
    if (!player.events) return player.events;
    return player.events.filter(e => activeCategories.has(e.category || 'series') && (region === 'GLOBAL' || e.region === region));
  };

  const filteredAndSortedPlayers = players
    .filter(p => {
      const clanName = getClanIcon(p.name);
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (clanName && clanName.toLowerCase().includes(searchTerm.toLowerCase()));
      const earnings = getFilteredEarnings(p, selectedRegion);
      return matchesSearch && earnings > 0;
    })
    .map(p => ({
      ...p,
      earningsUSD: getFilteredEarnings(p, selectedRegion),
      events: getFilteredEvents(p, selectedRegion),
    }))
    .sort((a, b) => {
      if (sortBy === 'earnings') return b.earningsUSD - a.earningsUSD;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return new Date(b.lastActiveDate).getTime() - new Date(a.lastActiveDate).getTime();
      return 0;
    });

  const displayedPlayers = filteredAndSortedPlayers.slice(0, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-[#FCE14B] selection:text-black">
      <div className="max-w-7xl mx-auto p-6 md:p-10 flex flex-col min-h-screen">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-8">
          <div className="relative">
            <h1 className="text-6xl md:text-8xl font-black italic uppercase leading-none tracking-tighter text-transparent stroke-text opacity-40">
              FORTNITE
            </h1>
            <h2 className="text-4xl md:text-6xl font-black italic uppercase leading-none tracking-tighter absolute top-4 left-2 text-transparent bg-clip-text bg-gradient-to-b from-[#FFF47C] to-[#EBA311] pr-2 pb-2">
              MOBILE SERIES
            </h2>
          </div>
          
          <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
             <div className="flex items-center gap-4 w-full">
               <div className="relative flex-grow md:w-64">
                 <input 
                  type="text" 
                  placeholder="SEARCH PRO PLAYER..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#141416] border border-white/10 px-4 py-2 font-mono text-xs focus:outline-none focus:border-[#FCE14B] transition-colors uppercase"
                 />
               </div>
               <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#141416] border border-white/10 px-4 py-2 font-mono text-xs focus:outline-none focus:border-[#FCE14B] text-[#FCE14B] cursor-pointer"
               >
                 <option value="earnings">SORT: EARNINGS</option>
                 <option value="name">SORT: NAME (A-Z)</option>
                 <option value="date">SORT: RECENT</option>
               </select>
               <button 
                onClick={fetchLeaderboard}
                disabled={loading}
                className="p-2.5 border-2 border-[#FCE14B]/30 text-[#FCE14B] hover:bg-[#FCE14B] hover:text-black transition-all duration-300"
              >
                <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
             </div>
             <div className="flex flex-wrap md:justify-end gap-1.5">
               {REGIONS.map(region => (
                 <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`px-3 py-1 text-[9px] font-black tracking-tighter transition-all italic uppercase border ${
                    selectedRegion === region 
                    ? 'bg-[#FCE14B] text-black border-[#FCE14B]' 
                    : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                  }`}
                 >
                   {region}
                 </button>
               ))}
             </div>
             <div className="flex flex-wrap md:justify-end gap-2 mt-1">
               <label className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                 includeBlitz ? 'bg-[#FCE14B]/10 border-[#FCE14B]/40 text-[#FCE14B]' : 'bg-transparent border-white/10 text-white/30 hover:border-white/20'
               }`}>
                 <input type="checkbox" checked={includeBlitz} onChange={e => setIncludeBlitz(e.target.checked)} className="sr-only" />
                 <div className={`w-2.5 h-2.5 border flex items-center justify-center transition-all ${
                   includeBlitz ? 'border-[#FCE14B] bg-[#FCE14B]' : 'border-white/30'
                 }`}>{includeBlitz && <span className="text-black text-[7px] font-black">✓</span>}</div>
                 + Blitz Cups
               </label>
               <label className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                 includeTestCup ? 'bg-[#FCE14B]/10 border-[#FCE14B]/40 text-[#FCE14B]' : 'bg-transparent border-white/10 text-white/30 hover:border-white/20'
               }`}>
                 <input type="checkbox" checked={includeTestCup} onChange={e => setIncludeTestCup(e.target.checked)} className="sr-only" />
                 <div className={`w-2.5 h-2.5 border flex items-center justify-center transition-all ${
                   includeTestCup ? 'border-[#FCE14B] bg-[#FCE14B]' : 'border-white/30'
                 }`}>{includeTestCup && <span className="text-black text-[7px] font-black">✓</span>}</div>
                 + Test Cups
               </label>
               <label className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                 includeReload ? 'bg-[#FCE14B]/10 border-[#FCE14B]/40 text-[#FCE14B]' : 'bg-transparent border-white/10 text-white/30 hover:border-white/20'
               }`}>
                 <input type="checkbox" checked={includeReload} onChange={e => setIncludeReload(e.target.checked)} className="sr-only" />
                 <div className={`w-2.5 h-2.5 border flex items-center justify-center transition-all ${
                   includeReload ? 'border-[#FCE14B] bg-[#FCE14B]' : 'bg-transparent border-white/30'
                 }`}>{includeReload && <span className="text-black text-[7px] font-black">✓</span>}</div>
                 + Reload Cups
               </label>
             </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {loading || dataSource === 'loading' ? (
            <motion.div 
              key="fullscreen-loader"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[#0A0A0B] flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative mb-12">
                <h1 className="text-7xl md:text-9xl font-black italic uppercase leading-none tracking-tighter text-transparent stroke-text opacity-10">
                  CONNECTING
                </h1>
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-24 h-24 border-t-4 border-l-4 border-[#FCE14B] animate-spin rounded-full"></div>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-[#FCE14B] animate-pulse">
                  INITIALIZING...
                </h2>
                <p className="max-w-md font-mono text-xs text-white/40 leading-relaxed uppercase">
                  Crawling historical qualifiers from Sept-Apr. Aggregating regional earnings. Please wait for the master leaderboard to be built.
                </p>
                <div className="w-64 h-1 bg-white/5 overflow-hidden mt-4">
                   <div className="h-full bg-[#FCE14B] animate-pulse w-full"></div>
                </div>
              </div>

              <div className="mt-20 font-mono text-[10px] text-white/20 uppercase tracking-[0.2em]">
                Source: Osirion Tournament Data API v1
              </div>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex-grow flex flex-col items-center justify-center py-40 text-center space-y-6"
            >
              <AlertCircle size={48} className="text-red-500" />
              <div className="max-w-md">
                <h2 className="text-3xl font-black italic uppercase">Sync Failure</h2>
                <p className="opacity-60 font-mono text-sm">{error}</p>
              </div>
              <button 
                onClick={fetchLeaderboard}
                className="px-10 py-4 bg-[#FCE14B] text-black font-black uppercase italic tracking-tighter hover:scale-105 transition-all"
              >
                Retry Connection
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 md:grid-cols-12 gap-8 flex-grow"
            >
              {/* Podium & Leaderboard Section */}
              <div className="md:col-span-8 flex flex-col gap-6">
                
                {/* Podium Top 3 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-fit">
                  {/* Rank 2 */}
                  {displayedPlayers[1] && (
                    <div className="podium-card bg-[#141416] border-l-4 border-[#FCE14B] h-48 group hover:bg-[#1c1c1f] cursor-pointer" onClick={() => setExpandedPlayer(expandedPlayer === displayedPlayers[1].name ? null : displayedPlayers[1].name)}>
                      <span className="podium-rank text-5xl">02</span>
                      <div className="flex items-center gap-2 mb-1">
                        {getClanIcon(displayedPlayers[1].name) && (
                          <ClanBadge clan={getClanIcon(displayedPlayers[1].name)!} className="w-5 h-auto object-contain" />
                        )}
                        <img 
                          src={`https://flagcdn.com/w40/${displayedPlayers[1].countryCode.toLowerCase()}.png`} 
                          alt={displayedPlayers[1].countryCode}
                          className="w-4 h-auto opacity-80"
                          referrerPolicy="no-referrer"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div className="text-[10px] uppercase tracking-widest text-[#FCE14B] font-bold">
                          {displayedPlayers[1].countryCode || 'GLOBAL'}
                        </div>
                      </div>
                      <div className="text-xl font-black uppercase italic leading-tight break-words">{displayedPlayers[1].name}</div>
                      <div className="text-xl font-mono opacity-80">${displayedPlayers[1].earningsUSD.toLocaleString()}</div>
                    </div>
                  )}

                  {/* Rank 1 */}
                  {displayedPlayers[0] && (
                    <div className="podium-card bg-gradient-to-b from-[#FFF47C] to-[#EBA311] text-black h-56 md:-mt-8 shadow-[0_20px_50px_rgba(252,225,75,0.2)] cursor-pointer" onClick={() => setExpandedPlayer(expandedPlayer === displayedPlayers[0].name ? null : displayedPlayers[0].name)}>
                      <span className="podium-rank text-7xl opacity-30">01</span>
                      <div className="flex items-center gap-2 mb-1">
                        {getClanIcon(displayedPlayers[0].name) && (
                          <ClanBadge clan={getClanIcon(displayedPlayers[0].name)!} className="w-6 h-auto object-contain" />
                        )}
                        <img 
                          src={`https://flagcdn.com/w40/${displayedPlayers[0].countryCode.toLowerCase()}.png`} 
                          alt={displayedPlayers[0].countryCode}
                          className="w-5 h-auto"
                          referrerPolicy="no-referrer"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div className="text-[10px] uppercase tracking-widest font-bold">
                          {displayedPlayers[0].countryCode || 'GLOBAL'}
                        </div>
                      </div>
                      <div style={{ fontSize: 'clamp(1rem, 3.5vw, 2.25rem)', lineHeight: 1.1 }} className="font-black uppercase italic w-full break-words">{displayedPlayers[0].name}</div>
                      <div className="text-2xl font-mono font-bold">${displayedPlayers[0].earningsUSD.toLocaleString()}</div>
                    </div>
                  )}

                  {/* Rank 3 */}
                  {displayedPlayers[2] && (
                    <div className="podium-card bg-[#141416] border-l-4 border-[#FCE14B] h-48 cursor-pointer" onClick={() => setExpandedPlayer(expandedPlayer === displayedPlayers[2].name ? null : displayedPlayers[2].name)}>
                      <span className="podium-rank text-5xl">03</span>
                      <div className="flex items-center gap-2 mb-1">
                        {getClanIcon(displayedPlayers[2].name) && (
                          <ClanBadge clan={getClanIcon(displayedPlayers[2].name)!} className="w-5 h-auto object-contain" />
                        )}
                        <img 
                          src={`https://flagcdn.com/w40/${displayedPlayers[2].countryCode.toLowerCase()}.png`} 
                          alt={displayedPlayers[2].countryCode}
                          className="w-4 h-auto opacity-80"
                          referrerPolicy="no-referrer"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div className="text-[10px] uppercase tracking-widest text-[#FCE14B] font-bold">
                          {displayedPlayers[2].countryCode || 'GLOBAL'}
                        </div>
                      </div>
                      <div className="text-xl font-black uppercase italic leading-tight break-words">{displayedPlayers[2].name}</div>
                      <div className="text-xl font-mono opacity-80">${displayedPlayers[2].earningsUSD.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {/* Expanded Event Breakdown for Podium Players */}
                <AnimatePresence>
                  {expandedPlayer && displayedPlayers.slice(0, 3).find(p => p.name === expandedPlayer) && (() => {
                    const player = displayedPlayers.find(p => p.name === expandedPlayer)!;
                    return (
                      <motion.div
                        key={`breakdown-${expandedPlayer}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="bg-[#0f0f11] border border-white/10 p-4 space-y-2">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] uppercase tracking-widest font-bold text-[#FCE14B]">
                              Event Breakdown — {player.name}
                            </div>
                            <button onClick={() => setExpandedPlayer(null)} className="text-white/30 hover:text-white transition-colors">
                              <ChevronDown size={14} className="rotate-180" />
                            </button>
                          </div>
                          <div className="grid grid-cols-12 px-2 py-1 text-[9px] uppercase tracking-widest font-bold opacity-30 border-b border-white/10">
                            <div className="col-span-1">#</div>
                            <div className="col-span-7">Event</div>
                            <div className="col-span-2 text-center">Place</div>
                            <div className="col-span-2 text-right">Earned</div>
                          </div>
                          {(player.events && player.events.length > 0) ? player.events.map((evt, i) => (
                            <div key={i} className="grid grid-cols-12 px-2 py-1.5 text-xs font-mono hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                              <div className="col-span-1 text-white/30">{i + 1}</div>
                              <div className="col-span-7 text-white/70 truncate pr-2" title={evt.event}>{evt.event}</div>
                              <div className="col-span-2 text-center">
                                <span className={`px-1.5 py-0.5 text-[10px] font-bold ${evt.placement <= 3 ? 'text-[#FCE14B]' : 'text-white/60'}`}>
                                  {evt.placement}{evt.placement === 1 ? 'st' : evt.placement === 2 ? 'nd' : evt.placement === 3 ? 'rd' : 'th'}
                                </span>
                              </div>
                              <div className={`col-span-2 text-right font-bold ${evt.earnings > 0 ? 'text-[#4ade80]' : 'text-white/30'}`}>
                                {evt.earnings > 0 ? `$${evt.earnings.toLocaleString()}` : '—'}
                              </div>
                            </div>
                          )) : (
                            <div className="py-4 text-center text-white/20 text-xs font-mono italic">Event data not yet available — awaiting next sync</div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* Leaderboard Table */}
                <div className="space-y-2 mt-4">
                  <div className="grid grid-cols-12 px-4 py-2 opacity-40 text-[10px] uppercase tracking-widest font-bold border-b border-white/10">
                    <div className="col-span-1">Pos</div>
                    <div className="col-span-11">Player Detail</div>
                  </div>
                  
                  <div className="space-y-1">
                    {displayedPlayers.slice(3).map((player, idx) => (
                      <div key={player.name}>
                        <div className="leaderboard-row cursor-pointer" onClick={() => setExpandedPlayer(expandedPlayer === player.name ? null : player.name)}>
                          <div className="col-span-1 font-mono text-[#FCE14B]">
                            {(idx + 4) < 10 ? `0${idx + 4}` : idx + 4}
                          </div>
                          <div className="col-span-6 font-black uppercase italic tracking-tight flex flex-col justify-center">
                            <div className="flex items-center gap-2">
                              {getClanIcon(player.name) && (
                                <ClanBadge clan={getClanIcon(player.name)!} className="w-5 h-auto object-contain" />
                              )}
                              <span>{player.name}</span>
                              <ChevronDown size={12} className={`opacity-30 transition-transform duration-200 ${expandedPlayer === player.name ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center gap-2 opacity-60 text-[10px] uppercase font-mono">
                            <img 
                              src={`https://flagcdn.com/w20/${player.countryCode.toLowerCase()}.png`} 
                              alt={player.countryCode}
                              className="w-4 h-auto"
                              referrerPolicy="no-referrer"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            {player.countryCode}
                          </div>
                          <div className="col-span-3 text-right font-mono font-bold text-sm md:text-base">
                            ${player.earningsUSD.toLocaleString()}
                          </div>
                        </div>
                        <AnimatePresence>
                          {expandedPlayer === player.name && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="bg-[#0f0f11] border border-white/10 border-t-0 px-4 py-3 ml-4 mr-1 mb-1 space-y-1">
                                <div className="grid grid-cols-12 px-1 py-1 text-[9px] uppercase tracking-widest font-bold opacity-30 border-b border-white/10">
                                  <div className="col-span-1">#</div>
                                  <div className="col-span-7">Event</div>
                                  <div className="col-span-2 text-center">Place</div>
                                  <div className="col-span-2 text-right">Earned</div>
                                </div>
                                {(player.events && player.events.length > 0) ? player.events.map((evt, i) => (
                                  <div key={i} className="grid grid-cols-12 px-1 py-1.5 text-xs font-mono hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                                    <div className="col-span-1 text-white/30">{i + 1}</div>
                                    <div className="col-span-7 text-white/70 truncate pr-2" title={evt.event}>{evt.event}</div>
                                    <div className="col-span-2 text-center">
                                      <span className={`text-[10px] font-bold ${evt.placement <= 3 ? 'text-[#FCE14B]' : 'text-white/60'}`}>
                                        {evt.placement}{evt.placement === 1 ? 'st' : evt.placement === 2 ? 'nd' : evt.placement === 3 ? 'rd' : 'th'}
                                      </span>
                                    </div>
                                    <div className={`col-span-2 text-right font-bold ${evt.earnings > 0 ? 'text-[#4ade80]' : 'text-white/30'}`}>
                                      {evt.earnings > 0 ? `$${evt.earnings.toLocaleString()}` : '—'}
                                    </div>
                                  </div>
                                )) : (
                                  <div className="py-4 text-center text-white/20 text-xs font-mono italic">Event data not yet available — awaiting next sync</div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                    
                    {displayedPlayers.length < filteredAndSortedPlayers.length && (
                      <button 
                        onClick={() => setPage(p => p + 1)}
                        className="w-full py-6 mt-4 border border-dashed border-white/10 text-white/40 font-mono text-xs uppercase tracking-widest hover:border-[#FCE14B] hover:text-[#FCE14B] transition-all"
                      >
                        Load More Players (+{Math.min(PAGE_SIZE, filteredAndSortedPlayers.length - displayedPlayers.length)})
                      </button>
                    )}

                    {filteredAndSortedPlayers.length === 0 && (
                      <div className="py-20 text-center font-mono opacity-20 uppercase tracking-widest italic border border-white/5 bg-white/5">
                        NO RESULTS MATCHING FILTERS
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Section */}
              <div className="md:col-span-4 flex flex-col gap-6">
                <div className="bg-gradient-to-b from-[#FFF47C] to-[#EBA311] p-6 text-black flex flex-col h-fit shadow-[0_10px_40px_rgba(252,225,75,0.15)]">
                  <h3 className="text-2xl font-black italic uppercase leading-none tracking-tighter mb-2">
                    MADE WITH &hearts; BY<br/>BABYLION122
                  </h3>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-6 tracking-widest">
                    Follow for updates & join the community
                  </p>
                  
                  <div className="flex flex-col gap-2 mt-auto">
                    <a href="https://youtube.com/@babylion122" target="_blank" rel="noreferrer" className="flex items-center gap-3 border-2 border-black bg-transparent p-2.5 hover:bg-black hover:text-[#FCE14B] transition-all font-black uppercase italic text-sm tracking-tighter group">
                      <Youtube size={18} className="group-hover:scale-110 transition-transform" />
                      YouTube
                    </a>
                    <a href="https://x.com/@babylion122" target="_blank" rel="noreferrer" className="flex items-center gap-3 border-2 border-black bg-transparent p-2.5 hover:bg-black hover:text-[#FCE14B] transition-all font-black uppercase italic text-sm tracking-tighter group">
                      <Twitter size={18} className="group-hover:scale-110 transition-transform" />
                      X (Twitter)
                    </a>
                    <a href="https://discord.gg/dE6JP6msHX" target="_blank" rel="noreferrer" className="flex items-center gap-3 border-2 border-black bg-black text-[#FCE14B] p-2.5 hover:bg-transparent hover:text-black transition-all font-black uppercase italic text-sm tracking-tighter group">
                      <MessageSquare size={18} className="group-hover:-rotate-12 transition-transform" />
                      Mobile Discord
                    </a>
                  </div>
                </div>
                
                <div className="border border-white/10 p-6 space-y-6 bg-[#141416]/50">
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase opacity-40 mb-3 tracking-widest font-bold">Network Status</div>
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80] shadow-[0_0_12px_#4ade80]"></div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[#4ade80]">Osirion API Cloud Sync</span>
                    </div>
                    <div className="text-[10px] uppercase opacity-40 italic font-mono">
                      Feed Update: {lastUpdated || 'SYNCING...'}
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/5 pt-6 hidden md:block">
                  <p className="text-[10px] opacity-20 uppercase font-mono leading-relaxed">
                    All player data is subject to verification by tournament officials. 
                    Earnings represent gross tournament payout before taxes and organization cuts.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Persistent Footer */}
      <footer className="w-full py-4 text-center border-t border-white/5 bg-[#0A0A0B]">
        <span className="text-[10px] font-mono opacity-20 uppercase tracking-[0.4em]">
          Real-time Data: Osirion API • Updated every 30 min
        </span>
      </footer>
    </div>
  );
}
