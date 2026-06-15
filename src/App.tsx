/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Globe, DollarSign, Activity, Smartphone, Loader2, AlertCircle, RefreshCcw, Youtube, Twitter, MessageSquare, ChevronDown, MapPin } from "lucide-react";
import { Link } from 'react-router-dom';

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

interface Qualification {
  player: string;
  countryCode: string;
  qualifier: string;
  qualifierDate: string;
  originalWinner: boolean;
  rolledDownFrom: string | null;
}

interface HeatSeed {
  player: string;
  countryCode: string;
  rank: number;
  points: number;
}

interface QualifierEligible {
  player: string;
  countryCode: string;
  fromHeat: string;
}

interface LeaderboardData {
  players: Player[];
  qualifications?: Record<string, Qualification[]>;
  heatsSeeding?: Record<string, Record<number, HeatSeed[]>>;
  qualifierEligible?: Record<string, QualifierEligible[]>;
  lastUpdated?: string;
  source?: string;
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
  'Rowans Revenge': 'Ololo',
  'Ololo KillerX': 'Ololo',
  'Ololo Cousfishyy': 'Ololo',
  'Ololo キャットアップル': 'Ololo',
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

  const [qualifications, setQualifications] = useState<Record<string, Qualification[]>>({});
  const [heatsSeeding, setHeatsSeeding] = useState<Record<string, Record<number, HeatSeed[]>>>({});
  const [qualifierEligible, setQualifierEligible] = useState<Record<string, QualifierEligible[]>>({});
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'qualifications' | 'heats'>('leaderboard');

  const fetchLeaderboard = async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError(null);
    try {
      // Check frontend cache first (30 min TTL — matches GitHub Actions cron frequency)
      const cached = localStorage.getItem('leaderboard_cache_v2');
      if (cached && !isRetry) {
        const { players: cachedPlayers, qualifications: cachedQuals, heatsSeeding: cachedHeats, qualifierEligible: cachedEligible, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          setPlayers(cachedPlayers);
          if (cachedQuals) setQualifications(cachedQuals);
          if (cachedHeats) setHeatsSeeding(cachedHeats);
          if (cachedEligible) setQualifierEligible(cachedEligible);
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
        if (data.qualifications) setQualifications(data.qualifications);
        if (data.heatsSeeding) setHeatsSeeding(data.heatsSeeding);
        if (data.qualifierEligible) setQualifierEligible(data.qualifierEligible);
        
        setLastUpdated(new Date(data.lastUpdated || Date.now()).toLocaleTimeString());
        setDataSource(data.source || 'osirion-aggregated');
        setLoading(false);

        // Cache locally
        localStorage.setItem('leaderboard_cache_v2', JSON.stringify({
          players: data.players,
          qualifications: data.qualifications || {},
          heatsSeeding: data.heatsSeeding || {},
          qualifierEligible: data.qualifierEligible || {},
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
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col font-sans selection:bg-[#FCE14B] selection:text-black overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#FCE14B] rounded-full mix-blend-screen filter blur-[150px] opacity-[0.03] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-white rounded-full mix-blend-screen filter blur-[150px] opacity-[0.02] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-[#FCE14B] rounded-full mix-blend-screen filter blur-[150px] opacity-[0.03] animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.015] mix-blend-overlay"></div>
      </div>

      {/* Main Content wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-white/10 pb-8 relative">
            {/* Header Content */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 opacity-60">
                <Trophy size={16} className="text-[#FCE14B]" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-black font-mono">Mobile Series Leaderboard</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black italic uppercase leading-[0.85] tracking-tighter title-glow">
                Mobile<br/>
                <span className="text-transparent stroke-text relative">
                  Earnings
                  <div className="absolute inset-0 bg-gradient-to-r from-[#FCE14B] to-transparent opacity-20 blur-xl mix-blend-overlay"></div>
                </span>
              </h1>
              <p className="mt-4 text-xs font-mono uppercase tracking-widest opacity-40 max-w-xl leading-relaxed">
                Aggregated lifetime tournament earnings for Fortnite Mobile Series. Tracking top players across all regions. 
                Group Stage qualifications are actively updated.
              </p>
              
              <div className="mt-6 flex flex-wrap gap-3">
                <Link 
                  to="/dropmap"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#FCE14B] text-black font-black italic uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(252,225,75,0.3)] hover:shadow-[0_0_30px_rgba(252,225,75,0.5)]"
                >
                  <MapPin size={16} />
                  Interactive Drop Map
                </Link>
                <button 
                  onClick={() => fetchLeaderboard(true)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors font-black italic uppercase text-xs tracking-widest disabled:opacity-50"
                >
                  <RefreshCcw size={14} className={loading ? 'animate-spin text-[#FCE14B]' : 'text-white/40'} />
                  Sync Latest Data
                </button>
              </div>
            </div>

            {/* Filter Controls block */}
            <div className="w-full md:w-auto bg-[#141416]/50 p-5 border border-white/10 backdrop-blur-xl shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#FCE14B]">Search Player/Clan</label>
                  <input
                    type="text"
                    placeholder="ENTER NAME..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-white/10 px-4 py-3 text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-[#FCE14B]/50 transition-colors uppercase tracking-wider"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#FCE14B]">Region Select</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-white/10 pl-9 pr-4 py-3 text-xs font-mono uppercase tracking-wider appearance-none focus:outline-none focus:border-[#FCE14B]/50 transition-colors cursor-pointer"
                    >
                      {REGIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center justify-between mb-2">
            <div className="flex gap-2 text-[10px] font-mono tracking-widest uppercase opacity-40">
              <span>Sort by:</span>
              <button onClick={() => setSortBy('earnings')} className={`hover:text-[#FCE14B] transition-colors ${sortBy === 'earnings' ? 'text-[#FCE14B]' : ''}`}>[Earnings]</button>
              <button onClick={() => setSortBy('date')} className={`hover:text-[#FCE14B] transition-colors ${sortBy === 'date' ? 'text-[#FCE14B]' : ''}`}>[Recent]</button>
              <button onClick={() => setSortBy('name')} className={`hover:text-[#FCE14B] transition-colors ${sortBy === 'name' ? 'text-[#FCE14B]' : ''}`}>[A-Z]</button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
               <span className="text-[10px] font-mono tracking-widest uppercase opacity-40 mr-1">Include:</span>
               <label className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                 includeBlitz ? 'bg-[#FCE14B]/10 border-[#FCE14B]/40 text-[#FCE14B]' : 'bg-transparent border-white/10 text-white/30 hover:border-white/20'
               }`}>
                 <input type="checkbox" checked={includeBlitz} onChange={e => setIncludeBlitz(e.target.checked)} className="sr-only" />
                 <div className={`w-2.5 h-2.5 border flex items-center justify-center transition-all ${
                   includeBlitz ? 'border-[#FCE14B] bg-[#FCE14B]' : 'bg-transparent border-white/30'
                 }`}>{includeBlitz && <span className="text-black text-[7px] font-black">✓</span>}</div>
                 + Blitz Cups
               </label>
               <label className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                 includeTestCup ? 'bg-[#FCE14B]/10 border-[#FCE14B]/40 text-[#FCE14B]' : 'bg-transparent border-white/10 text-white/30 hover:border-white/20'
               }`}>
                 <input type="checkbox" checked={includeTestCup} onChange={e => setIncludeTestCup(e.target.checked)} className="sr-only" />
                 <div className={`w-2.5 h-2.5 border flex items-center justify-center transition-all ${
                   includeTestCup ? 'border-[#FCE14B] bg-[#FCE14B]' : 'bg-transparent border-white/30'
                 }`}>{includeTestCup && <span className="text-black text-[7px] font-black">✓</span>}</div>
                 + Touch-Only Test Cups
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
              className="flex-grow flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative mb-12">
                <div className="w-24 h-24 border-t-4 border-l-4 border-[#FCE14B] animate-spin rounded-full"></div>
              </div>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-[#FCE14B] animate-pulse">
                INITIALIZING...
              </h2>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex-grow flex flex-col items-center justify-center py-20 text-center space-y-6"
            >
              <AlertCircle size={48} className="text-red-500" />
              <div className="max-w-md">
                <h2 className="text-3xl font-black italic uppercase">Sync Failure</h2>
                <p className="opacity-60 font-mono text-sm">{error}</p>
              </div>
              <button 
                onClick={() => fetchLeaderboard(true)}
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
              {/* Main Content Area */}
              <div className="md:col-span-8 flex flex-col gap-6">
                
                {/* Navigation Tabs */}
                <div className="flex gap-6 border-b border-white/10 pb-2 mb-6">
                  <button onClick={() => setActiveTab('leaderboard')} className={`pb-2 font-black italic uppercase tracking-widest text-sm transition-all border-b-2 ${activeTab === 'leaderboard' ? 'text-[#FCE14B] border-[#FCE14B]' : 'text-white/40 border-transparent hover:text-white'}`}>
                    Earnings Leaderboard
                  </button>
                  <button onClick={() => setActiveTab('heats')} className={`pb-2 font-black italic uppercase tracking-widest text-sm transition-all border-b-2 ${activeTab === 'heats' ? 'text-[#FCE14B] border-[#FCE14B]' : 'text-white/40 border-transparent hover:text-white'}`}>
                    Heats Seeding
                  </button>
                  <button onClick={() => setActiveTab('qualifications')} className={`pb-2 font-black italic uppercase tracking-widest text-sm transition-all border-b-2 ${activeTab === 'qualifications' ? 'text-[#FCE14B] border-[#FCE14B]' : 'text-white/40 border-transparent hover:text-white'}`}>
                    Group Stage Quals
                  </button>
                </div>

                {activeTab === 'leaderboard' ? (
                  <>
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
                </>
                ) : activeTab === 'heats' ? (
                  <div className="border border-white/10 bg-[#141416]/50">
                    <div className="p-5 border-b border-white/5">
                      <div className="flex items-center gap-3 mb-1">
                        <Trophy size={18} className="text-[#FCE14B]" />
                        <h3 className="text-lg font-black italic uppercase tracking-tighter text-[#FCE14B]">Heats Seeding</h3>
                      </div>
                      <p className="text-[10px] uppercase tracking-widest font-mono opacity-30 mt-1">
                        Snake-draft seeding for the top 64 players into 4 Heats based on cumilative points.
                      </p>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map(heatNum => {
                        const regionHeats = heatsSeeding[selectedRegion === 'GLOBAL' ? 'EUROPE' : selectedRegion] || {};
                        const heatPlayers = regionHeats[heatNum] || [];
                        return (
                          <div key={heatNum} className="border border-white/10 bg-[#0A0A0B]">
                            <div className="bg-white/5 py-2 text-center text-xs font-black uppercase italic tracking-widest border-b border-white/10 text-[#FCE14B]">
                              Heat {heatNum}
                            </div>
                            <div className="p-2 space-y-1">
                              {heatPlayers.length > 0 ? heatPlayers.map((hp, i) => (
                                <div key={hp.player} className="flex items-center justify-between px-2 py-1.5 bg-[#141416] hover:bg-white/5 text-xs font-mono border-b border-white/5 last:border-0">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-[9px] text-[#FCE14B] opacity-80 min-w-[14px]">#{hp.rank}</span>
                                    <img
                                      src={`https://flagcdn.com/w20/${hp.countryCode.toLowerCase()}.png`}
                                      alt={hp.countryCode}
                                      className="w-3 h-auto opacity-80"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                    <span className="truncate uppercase font-bold italic">{hp.player}</span>
                                  </div>
                                  <span className="text-[10px] text-white/40">{hp.points}pts</span>
                                </div>
                              )) : (
                                <div className="py-4 text-center text-white/20 text-[9px] italic uppercase">Pending</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                <div className="border border-white/10 bg-[#141416]/50">
                  {/* Group Stage Qualifications */}
                  <div className="p-5 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-1">
                      <Trophy size={18} className="text-[#FCE14B]" />
                      <h3 className="text-lg font-black italic uppercase tracking-tighter text-[#FCE14B]">Group Stage Qualifications</h3>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest font-mono opacity-30 mt-1">
                      Winners of each Qualifier Round earn a Group Stage slot. If already qualified, slot rolls down.
                    </p>
                  </div>
                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-12 px-3 py-2 text-[9px] uppercase tracking-widest font-bold opacity-30 border-b border-white/10">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Player</div>
                        <div className="col-span-4">Qualifier</div>
                        <div className="col-span-2 text-right">Status</div>
                      </div>
                      <div className="space-y-0.5">
                        {(qualifications[selectedRegion === 'GLOBAL' ? 'EUROPE' : selectedRegion] || []).map((q, i) => (
                          <div key={`${q.player}-${q.qualifier}`} className="grid grid-cols-12 px-3 py-2.5 items-center bg-[#0f0f11] hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                            <div className="col-span-1 font-mono text-[#FCE14B] text-sm">{i + 1}</div>
                            <div className="col-span-5 flex items-center gap-2">
                              {getClanIcon(q.player) && (
                                <ClanBadge clan={getClanIcon(q.player)!} className="w-4 h-auto object-contain" />
                              )}
                              <img
                                src={`https://flagcdn.com/w20/${q.countryCode.toLowerCase()}.png`}
                                alt={q.countryCode}
                                className="w-4 h-auto opacity-80"
                                referrerPolicy="no-referrer"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                              <span className="font-bold uppercase italic text-sm truncate">{q.player}</span>
                            </div>
                            <div className="col-span-4 font-mono text-xs text-white/50">{q.qualifier}</div>
                            <div className="col-span-2 text-right">
                              {q.originalWinner ? (
                                <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-[#FCE14B]/10 text-[#FCE14B] border border-[#FCE14B]/20">Winner</span>
                              ) : (
                                <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-white/5 text-white/40 border border-white/10" title={`Rolled down from ${q.rolledDownFrom}`}>Roll-down</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {(!qualifications[selectedRegion === 'GLOBAL' ? 'EUROPE' : selectedRegion] || qualifications[selectedRegion === 'GLOBAL' ? 'EUROPE' : selectedRegion]?.length === 0) && (
                          <div className="py-8 text-center font-mono text-xs text-white/20 italic uppercase">No qualifications recorded for this region</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                  
                  {/* Latest Video Mini Player */}
                  <div className="mb-4">
                    <div className="text-[9px] uppercase tracking-widest font-bold opacity-50 mb-2">
                      Latest Video
                    </div>
                    <div className="relative w-full overflow-hidden border-2 border-black" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src="https://www.youtube.com/embed/p06dgvbmA_4?start=6"
                        title="Latest Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>

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
                
                <div className="border border-white/10 p-5 bg-[#141416]/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone size={16} className="text-[#FCE14B]" />
                    <h3 className="text-xs font-black italic uppercase tracking-tighter text-[#FCE14B]">Mobile Creators</h3>
                  </div>
                  <p className="text-[9px] uppercase tracking-widest font-mono opacity-30 mb-4">
                    Download creator assets
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <a
                        key={i}
                        href={`/creator-assets/Icon${i}.png`}
                        download={`Icon${i}.png`}
                        className="aspect-square bg-[#0f0f11] border border-white/10 flex items-center justify-center hover:border-[#FCE14B]/30 transition-colors cursor-pointer group overflow-hidden"
                        title={`Download Icon ${i}`}
                      >
                        <img 
                          src={`/creator-assets/Icon${i}.png`} 
                          alt={`Creator Asset ${i}`}
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                        />
                      </a>
                    ))}
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
