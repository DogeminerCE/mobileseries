/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, Globe, MapPin, Users, ChevronLeft, LogIn, LogOut, 
  ZoomIn, ZoomOut, RotateCcw, Crosshair, Trash2, Eye, EyeOff, Info, PenTool
} from "lucide-react";
import pc from 'polygon-clipping';
import { auth, db } from './firebase';
import { 
  collection, addDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, serverTimestamp 
} from 'firebase/firestore';
import { signInWithPopup, OAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DropSpot {
  id?: string;
  x: number; // percentage 0-100 (centroid)
  y: number; // percentage 0-100 (centroid)
  path?: {x: number, y: number}[]; // Polygon vertices
  playerName: string;
  epicAccountId: string;
  region: string;
  mapSession: string;
  color: string;
  heatNumber?: number;
  createdAt?: any;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DROP_MAP_REGIONS = ["EUROPE", "NA-CENTRAL", "NA-WEST", "MIDDLE EAST", "OCEANIA", "ASIA", "BRAZIL"];

// A session's `key` is what gets written to Firestore. Heats repeat every month, so the
// key is namespaced by period ("July Heat 1") to keep each month's map a clean slate,
// while the tab itself just reads "Heat 1".
interface MapSession {
  key: string;
  label: string;
  heatNumber: number | null;
}

const GROUP_STAGE_SESSION: MapSession = { key: 'Group Stage', label: 'Group Stage', heatNumber: null };

const HEAT_COLORS: Record<number, string> = {
  1: '#FF4444', // Red
  2: '#44AAFF', // Blue
  3: '#44FF88', // Green
  4: '#FFAA44', // Orange
};

// Epic display names carry glyphs that don't survive a naive comparison — the admin
// account's name uses U+02BC (ʼ), not an ASCII apostrophe — so every identity check
// runs against an alphanumeric-only form of the name.
const normalizeName = (name: string) => (name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const ADMIN_ACCOUNT = normalizeName('Blitzʼd Babylion');
const isAdminName = (name: string) => normalizeName(name) === ADMIN_ACCOUNT;

const PLAYER_COLORS = [
  '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#82E0AA', '#F8C471',
  '#85929E', '#AED6F1', '#A3E4D7', '#FAD7A0', '#D2B4DE',
];

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function DropMap() {
  const navigate = useNavigate();
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [epicName, setEpicName] = useState<string>('');
  const [isQualified, setIsQualified] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [authError, setAuthError] = useState<string | null>(null);
  
  // Map state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('EUROPE');
  const [selectedSession, setSelectedSession] = useState(GROUP_STAGE_SESSION.key);
  const [dropSpots, setDropSpots] = useState<DropSpot[]>([]);
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredSpot, setHoveredSpot] = useState<string | null>(null);
  
  // Map zoom/pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);

  // Leaderboard data for Auth
  const [leaderboardData, setLeaderboardData] = useState<any>(null);

  // ─── Firebase Auth State Listener ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setEpicName(currentUser.displayName || '');
        setAuthLoading(false);
      } else {
        setEpicName('');
        setIsQualified(false);
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // ─── Fetch Leaderboard Data ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/leaderboard.json')
      .then(res => res.json())
      .then(data => setLeaderboardData(data))
      .catch(err => console.error('Failed to load leaderboard data', err));
  }, []);

  // ─── Available Sessions for the Current Heats Period ────────────────────────
  // The aggregator resolves whichever Heats Stage the latest completed Round Stages
  // feed into (e.g. July Heats → Qualifier 13), so the tabs roll over on their own.
  const heatsMeta = leaderboardData?.heatsMeta;
  const regionMeta = heatsMeta?.regions?.[selectedRegion];
  const heatsPeriod: string | null = regionMeta?.period || heatsMeta?.period || null;
  const qualifierLabel: string | null = regionMeta?.qualifierLabel || heatsMeta?.qualifierLabel || null;

  const mapSessions = useMemo<MapSession[]>(() => {
    const sessions: MapSession[] = [];
    if (heatsPeriod) {
      for (const heatNumber of [1, 2, 3, 4]) {
        sessions.push({
          key: `${heatsPeriod} Heat ${heatNumber}`,
          label: `Heat ${heatNumber}`,
          heatNumber,
        });
      }
    }
    if (qualifierLabel) {
      sessions.push({ key: qualifierLabel, label: qualifierLabel, heatNumber: null });
    }
    sessions.push(GROUP_STAGE_SESSION);
    return sessions;
  }, [heatsPeriod, qualifierLabel]);

  const activeSession = useMemo(
    () => mapSessions.find(s => s.key === selectedSession) || GROUP_STAGE_SESSION,
    [mapSessions, selectedSession]
  );

  // Once a Heats Stage session has finished its maps are frozen as a record of the day.
  const isHeatsLocked = useMemo(() => {
    if (activeSession.heatNumber === null || !regionMeta?.heatsEndTime) return false;
    return Date.now() > new Date(regionMeta.heatsEndTime).getTime();
  }, [activeSession, regionMeta]);

  // Land on Qualifier if Heats have concluded or eligibility exists, otherwise land on Heat 1.
  useEffect(() => {
    if (!heatsPeriod) return;
    const heatsConcluded = regionMeta?.heatsEndTime ? Date.now() > new Date(regionMeta.heatsEndTime).getTime() : false;
    const hasQualifierEligible = (leaderboardData?.qualifierEligible?.[selectedRegion] || []).length > 0;
    if ((heatsConcluded || hasQualifierEligible) && qualifierLabel) {
      setSelectedSession(prev => (prev === GROUP_STAGE_SESSION.key || prev.includes('Heat') ? qualifierLabel : prev));
    } else {
      setSelectedSession(prev => (prev === GROUP_STAGE_SESSION.key ? `${heatsPeriod} Heat 1` : prev));
    }
  }, [heatsPeriod, qualifierLabel, regionMeta, selectedRegion, leaderboardData]);

  // ─── Session Authorization ──────────────────────────────────────────────────
  useEffect(() => {
    if (!epicName) {
      setIsQualified(false);
      return;
    }

    const lowerName = normalizeName(epicName);

    // Admin bypass
    if (isAdminName(epicName)) {
      setIsQualified(true);
      return;
    }

    if (!leaderboardData) {
      setIsQualified(false);
      return;
    }

    let qualified = false;

    if (activeSession.heatNumber !== null) {
      const seeded = leaderboardData.heatsSeeding?.[selectedRegion]?.[activeSession.heatNumber] || [];
      qualified = !isHeatsLocked && seeded.some((p: any) => normalizeName(p.player) === lowerName);
    } else if (activeSession.key === GROUP_STAGE_SESSION.key) {
      const quals = leaderboardData.qualifications?.[selectedRegion] || [];
      qualified = quals.some((q: any) => normalizeName(q.player) === lowerName);
    } else {
      const eligible = leaderboardData.qualifierEligible?.[selectedRegion] || [];
      qualified = eligible.some((p: any) => normalizeName(p.player) === lowerName);
    }

    setIsQualified(qualified);
  }, [epicName, selectedRegion, activeSession, isHeatsLocked, leaderboardData]);

  // ─── Compute Expected Players for Current Session ─────────────────────────────
  const expectedPlayers = useMemo(() => {
    if (!leaderboardData) return [];

    if (activeSession.heatNumber !== null) {
      return (leaderboardData.heatsSeeding?.[selectedRegion]?.[activeSession.heatNumber] || []).map((p: any) => p.player);
    } else if (activeSession.key === GROUP_STAGE_SESSION.key) {
      return (leaderboardData.qualifications?.[selectedRegion] || []).map((q: any) => q.player);
    }
    return (leaderboardData.qualifierEligible?.[selectedRegion] || []).map((p: any) => p.player);
  }, [leaderboardData, activeSession, selectedRegion]);

  // Which Heat each player was seeded into, so drops on the Qualifier and Group Stage
  // maps can still be tagged with where the player came from.
  const heatByPlayer = useMemo(() => {
    const map: Record<string, number> = {};
    const regionSeeding = leaderboardData?.heatsSeeding?.[selectedRegion] || {};
    for (const heatNumber of [1, 2, 3, 4]) {
      for (const p of (regionSeeding[heatNumber] || [])) {
        map[normalizeName(p.player)] = heatNumber;
      }
    }
    return map;
  }, [leaderboardData, selectedRegion]);

  // ─── Firestore Real-time Listener ───────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'dropSpots'),
      where('region', '==', selectedRegion),
      where('mapSession', '==', selectedSession)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const spots: DropSpot[] = [];
      snapshot.forEach(docSnap => {
        spots.push({ id: docSnap.id, ...docSnap.data() } as DropSpot);
      });
      setDropSpots(spots);
    });
    return () => unsub();
  }, [selectedRegion, selectedSession]);

  // ─── Login with Epic Games (OAuth) ──────────────────────────────────────────
  const handleLogin = () => {
    setAuthError(null);
    try {
      const clientId = 'xyza7891WTyGsPLoyAH6ArhFryzcNpKu';
      const redirectUri = encodeURIComponent(window.location.origin + '/drop-map');
      const epicAuthUrl = `https://www.epicgames.com/id/authorize?client_id=${clientId}&response_type=code&scope=basic_profile&redirect_uri=${redirectUri}`;
      window.location.href = epicAuthUrl;
    } catch (err: any) {
      console.error('Login redirect error:', err);
      setAuthError('Failed to initiate login');
    }
  };

  // ─── Process OAuth Callback ─────────────────────────────────────────────────
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      setAuthError(null);
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const authenticateWithCode = async () => {
        try {
          const redirectUri = window.location.origin + '/drop-map';
          const res = await fetch('/api/epic-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri })
          });
          
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            let errMsg = 'Failed to authenticate with Epic Games server';
            try {
              const errData = JSON.parse(errText);
              errMsg = errData.message || errData.error || errData.details || errMsg;
            } catch (e) {
              errMsg = `Server error ${res.status}: ${errText.substring(0, 50)}`;
            }
            throw new Error(errMsg);
          }
          
          const { token, displayName } = await res.json();
          const { signInWithCustomToken, updateProfile } = await import('firebase/auth');
          const cred = await signInWithCustomToken(auth, token);
          await updateProfile(cred.user, { displayName });
          
          setEpicName(displayName);

        } catch (err: any) {
          console.error('OAuth processing error:', err);
          setAuthError(err.message || 'Failed to finish sign in');
        }
      };
      
      authenticateWithCode();
    }
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setEpicName('');
    setIsQualified(false);
  };

  // ─── Place a Drop Spot ──────────────────────────────────────────────────────
  const handleMapClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !user || !isQualified) return;
    
    const container = mapContainerRef.current;
    const img = mapImageRef.current;
    if (!container || !img) return;

    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    setCurrentPath(prev => [...prev, { x, y }]);
  }, [isDrawing, user, isQualified]);

  const handleConfirmArea = async () => {
    if (currentPath.length < 3 || !user) return;

    const isAdmin = isAdminName(epicName);
    let spotPlayerName = epicName;

    if (isAdmin) {
      const overrideName = window.prompt("Admin: Enter player name to place spot for (leave blank for yourself):", "");
      if (overrideName && overrideName.trim() !== '') {
        spotPlayerName = overrideName.trim();
      }
    }

    // Calculate centroid
    let sumX = 0;
    let sumY = 0;
    for (const p of currentPath) {
      sumX += p.x;
      sumY += p.y;
    }
    const centroidX = sumX / currentPath.length;
    const centroidY = sumY / currentPath.length;

    const seededHeat = heatByPlayer[spotPlayerName.replace(/[^a-z0-9]/gi, '').toLowerCase()];

    // Optimistic: show spot immediately
    const optimisticSpot: DropSpot = {
      id: '__optimistic__',
      x: centroidX,
      y: centroidY,
      path: [...currentPath],
      playerName: spotPlayerName,
      epicAccountId: user.uid,
      region: selectedRegion,
      mapSession: selectedSession,
      color: '#4ade80',
      ...(seededHeat ? { heatNumber: seededHeat } : {}),
    };
    
    // Admin placing for someone else shouldn't replace their own spot optimistically
    if (spotPlayerName === epicName) {
      setDropSpots(prev => [...prev.filter(s => s.epicAccountId !== user.uid || s.playerName === spotPlayerName), optimisticSpot]);
    } else {
      setDropSpots(prev => [...prev.filter(s => s.playerName !== spotPlayerName), optimisticSpot]);
    }
    
    setIsDrawing(false);
    setCurrentPath([]);

    try {
      // Delete any existing spots for this player/region/session
      const existingQuery = query(
        collection(db, 'dropSpots'),
        where('playerName', '==', spotPlayerName),
        where('region', '==', selectedRegion),
        where('mapSession', '==', selectedSession)
      );
      const existing = await getDocs(existingQuery);
      for (const docSnap of existing.docs) {
        await deleteDoc(doc(db, 'dropSpots', docSnap.id));
      }

      // Save to Firestore (the onSnapshot listener will replace the optimistic spot with the real one)
      await addDoc(collection(db, 'dropSpots'), {
        x: centroidX,
        y: centroidY,
        path: optimisticSpot.path,
        playerName: spotPlayerName,
        epicAccountId: user.uid,
        region: selectedRegion,
        mapSession: selectedSession,
        color: '#4ade80',
        ...(seededHeat ? { heatNumber: seededHeat } : {}),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to place drop spot:', err);
      // Rollback optimistic update on error
      setDropSpots(prev => prev.filter(s => s.id !== '__optimistic__'));
    }
  };

  // ─── Remove My Drop Spot ───────────────────────────────────────────────────
  const handleRemoveMySpot = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'dropSpots'),
        where('epicAccountId', '==', user.uid),
        where('region', '==', selectedRegion),
        where('mapSession', '==', selectedSession)
      );
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        await deleteDoc(doc(db, 'dropSpots', docSnap.id));
      }
    } catch (err) {
      console.error('Failed to remove drop spot:', err);
    }
  };

  // ─── Admin: Remove Any Drop Spot ─────────────────────────────────────────────
  const handleAdminDelete = async (spotId: string) => {
    if (!user || !isAdminName(epicName)) return;
    try {
      await deleteDoc(doc(db, 'dropSpots', spotId));
      setDropSpots(prev => prev.filter(s => s.id !== spotId));
    } catch (err) {
      console.error('Failed to admin-delete drop spot:', err);
    }
  };

  // ─── Zoom/Pan Handlers ─────────────────────────────────────────────────────
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(z + delta, 0.5), 4));
  }, []);

  const pointerStartRef = useRef<{ x: number, y: number, isPan: boolean } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    pointerStartRef.current = { x: e.clientX, y: e.clientY, isPan: false };
    
    // Capture pointer to track movements outside the element if needed
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    
    if (pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      // If moved more than 5px, it's a pan, not a click
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        pointerStartRef.current.isPan = true;
      }
    }
  }, [isPanning, panStart]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsPanning(false);
    
    if (isDrawing && pointerStartRef.current && !pointerStartRef.current.isPan) {
      // Cast the pointer event to mouse event for handleMapClick
      handleMapClick(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
    pointerStartRef.current = null;
  }, [isDrawing, handleMapClick]);

  const mySpot = dropSpots.find(s => s.epicAccountId === user?.uid);
  const isAdmin = isAdminName(epicName);

  // ─── Calculate Overlapping Polygons & Per-Spot Overlap Status ───────────────
  const { overlappingPolygons, spotHasOverlap } = useMemo(() => {
    let overlaps: pc.Polygon[] = [];
    const overlapSet = new Set<string>();
    
    // Extract valid polygons
    const validSpots = dropSpots.filter(s => s.path && s.path.length >= 3);
    
    // Check every pair for intersections
    for (let i = 0; i < validSpots.length; i++) {
      for (let j = i + 1; j < validSpots.length; j++) {
        try {
          const p1: pc.Polygon = [[validSpots[i].path!.map(p => [p.x, p.y] as pc.Pair)]];
          const p2: pc.Polygon = [[validSpots[j].path!.map(p => [p.x, p.y] as pc.Pair)]];
          
          const intersection = pc.intersection(p1, p2);
          if (intersection.length > 0) {
            overlaps = pc.union(overlaps, intersection);
            if (validSpots[i].id) overlapSet.add(validSpots[i].id!);
            if (validSpots[j].id) overlapSet.add(validSpots[j].id!);
          }
        } catch (e) {
          console.warn('Polygon intersection failed', e);
        }
      }
    }
    return { overlappingPolygons: overlaps, spotHasOverlap: overlapSet };
  }, [dropSpots]);

  // Get spot color: green if solo, red if overlapping
  const getSpotColor = (spot: DropSpot) => {
    return spotHasOverlap.has(spot.id || '') ? '#ef4444' : '#4ade80';
  };

  // Get bounding box of a polygon path (in percentages)
  const getPathBounds = (path: {x: number, y: number}[]) => {
    let minX = 100, maxX = 0, minY = 100, maxY = 0;
    for (const p of path) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#0A0A0B]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-white/40 hover:text-[#FCE14B] transition-colors text-xs font-bold uppercase tracking-wider"
              >
                <ChevronLeft size={16} />
                Leaderboard
              </button>
              <div className="h-5 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#FCE14B]" />
                <h1 className="text-sm font-black italic uppercase tracking-tighter">
                  Drop Map
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {authLoading ? (
                <div className="text-xs text-white/30 uppercase tracking-wider">Loading...</div>
              ) : user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isQualified ? '#4ade80' : '#ef4444' }} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {epicName}
                    </span>
                    {isQualified && (
                      <span className="text-[8px] font-black uppercase tracking-widest bg-[#FCE14B]/10 text-[#FCE14B] px-2 py-0.5 border border-[#FCE14B]/30">
                        QUALIFIED
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-white/30 hover:text-red-400 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FCE14B] text-black font-black italic uppercase text-xs tracking-tighter hover:bg-[#FCE14B]/80 transition-colors"
                >
                  <LogIn size={14} />
                  Sign In with Epic Games
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {DROP_MAP_REGIONS.map(region => (
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
          
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
            {mapSessions.map(session => {
              let disabledReason = '';
              if (session.heatNumber !== null) {
                const seeded = leaderboardData?.heatsSeeding?.[selectedRegion]?.[session.heatNumber] || [];
                if (seeded.length === 0) disabledReason = 'Heats seeding not yet determined for this region';
              } else if (session.key !== GROUP_STAGE_SESSION.key) {
                const qualEligible = leaderboardData?.qualifierEligible?.[selectedRegion] || [];
                if (qualEligible.length === 0) disabledReason = 'Qualifier eligibility not yet determined (Heats not finished)';
              }
              const isDisabled = disabledReason !== '';

              return (
                <button
                  key={session.key}
                  onClick={() => !isDisabled && setSelectedSession(session.key)}
                  disabled={isDisabled}
                  className={`px-3 py-1 text-[9px] font-black tracking-tighter transition-all italic uppercase border ${
                    selectedSession === session.key
                    ? 'bg-white text-black border-white'
                    : isDisabled
                      ? 'bg-transparent text-white/10 border-white/5 cursor-not-allowed'
                      : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                  }`}
                  title={disabledReason}
                >
                  {session.label}
                </button>
              );
            })}
            {heatsPeriod && (
              <span className="self-center ml-1 text-[9px] font-mono uppercase tracking-widest text-white/20">
                {heatsPeriod} Heats
              </span>
            )}
          </div>
        </div>
      </header>

      {authError && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-red-400 text-xs text-center font-bold uppercase tracking-wider">
          {authError}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 relative overflow-hidden bg-[#0f0f11]">
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
            <button 
              onClick={handleZoomIn}
              className="w-9 h-9 bg-[#141416]/90 border border-white/10 flex items-center justify-center hover:border-[#FCE14B]/30 transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={14} className="text-white/60" />
            </button>
            <button 
              onClick={handleZoomOut}
              className="w-9 h-9 bg-[#141416]/90 border border-white/10 flex items-center justify-center hover:border-[#FCE14B]/30 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={14} className="text-white/60" />
            </button>
            <button 
              onClick={handleResetView}
              className="w-9 h-9 bg-[#141416]/90 border border-white/10 flex items-center justify-center hover:border-[#FCE14B]/30 transition-colors"
              title="Reset View"
            >
              <RotateCcw size={14} className="text-white/60" />
            </button>
            <div className="h-px bg-white/10" />
            <button 
              onClick={() => setShowLabels(!showLabels)}
              className={`w-9 h-9 bg-[#141416]/90 border flex items-center justify-center transition-colors ${
                showLabels ? 'border-[#FCE14B]/30 text-[#FCE14B]' : 'border-white/10 text-white/40'
              }`}
              title={showLabels ? "Hide Labels" : "Show Labels"}
            >
              {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>

          <div className="absolute bottom-4 right-4 z-20 text-[9px] uppercase tracking-widest font-mono text-white/20">
            {Math.round(zoom * 100)}%
          </div>

          <div
            ref={mapContainerRef}
            className={`w-full h-full min-h-[500px] lg:min-h-0 ${isDrawing ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{ touchAction: 'none' }}
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              <div className="relative inline-flex">
                <img
                  ref={mapImageRef}
                  src="/venture-blitz-map.webp"
                  alt="Venture (Blitz) Island Map"
                  className="max-w-full max-h-[calc(100vh-140px)] object-contain select-none pointer-events-none"
                  draggable={false}
                />
                
                {/* SVG Overlay for polygons */}
                <svg 
                  viewBox="0 0 100 100" 
                  preserveAspectRatio="none" 
                  className="absolute inset-0 w-full h-full pointer-events-none" 
                  style={{ zIndex: 5, overflow: 'visible' }}
                >
                  {/* Live Drawing Polygon */}
                  {isDrawing && currentPath.length > 0 && (
                    <polygon
                      points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(74, 222, 128, 0.3)"
                      stroke="#4ade80"
                      strokeWidth="0.5"
                      strokeDasharray="1 1"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {/* Saved Polygons */}
                  {dropSpots.map(spot => {
                    if (!spot.path || spot.path.length === 0) return null;
                    const color = getSpotColor(spot);
                    return (
                      <polygon
                        key={`poly-${spot.id}`}
                        points={spot.path.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={`${color}4D`}
                        stroke={color}
                        strokeWidth={hoveredSpot === spot.id ? "1" : "0.5"}
                        vectorEffect="non-scaling-stroke"
                        className="transition-all"
                      />
                    );
                  })}
                  
                  {/* Overlap Highlights (RED) */}
                  {overlappingPolygons.map((multiPoly, i) => 
                    multiPoly.map((poly, j) => (
                      <polygon
                        key={`overlap-${i}-${j}`}
                        points={poly[0].map(p => `${p[0]},${p[1]}`).join(' ')}
                        fill="rgba(255, 0, 0, 0.6)"
                        stroke="#FF0000"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        className="animate-pulse pointer-events-none"
                      />
                    ))
                  )}
                </svg>

                {/* Drop Spot Markers & Labels */}
                {dropSpots.map((spot) => (
                  <div
                    key={spot.id}
                    className="absolute group"
                    style={{
                      left: `${spot.x}%`,
                      top: `${spot.y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: hoveredSpot === spot.id ? 30 : 10,
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={() => setHoveredSpot(spot.id || null)}
                    onMouseLeave={() => setHoveredSpot(null)}
                  >
                    {(() => {
                      const color = getSpotColor(spot);
                      return (!spot.path || spot.path.length === 0) ? (
                        <div className="relative transform translate-y-[-50%]">
                          <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                            <path 
                              d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" 
                              fill={color}
                              stroke="rgba(0,0,0,0.5)"
                              strokeWidth="1"
                            />
                            <circle cx="12" cy="12" r="5" fill="rgba(0,0,0,0.3)" />
                          </svg>
                          {spot.epicAccountId === user?.uid && (
                            <div 
                              className="absolute -inset-2 rounded-full animate-ping opacity-30"
                              style={{ backgroundColor: color }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="w-2 h-2 rounded-full shadow-md" style={{ backgroundColor: color }} />
                          {spot.epicAccountId === user?.uid && (
                            <div 
                              className="absolute -inset-2 rounded-full animate-ping opacity-30"
                              style={{ backgroundColor: color }}
                            />
                          )}
                        </div>
                      );
                    })()}


                    {/* Contained Name Label */}
                    {(showLabels || hoveredSpot === spot.id) && (() => {
                      const color = getSpotColor(spot);
                      const bounds = spot.path && spot.path.length >= 3 ? getPathBounds(spot.path) : null;
                      // Scale font and max-width based on polygon size (bounds are in % of map)
                      // A polygon spanning 10% of the map ≈ roughly 80px on a 800px wide map
                      const pxWidth = bounds ? Math.max(50, bounds.width * 8) : 80;
                      const fontSize = bounds ? Math.max(7, Math.min(12, bounds.width * 0.9)) : 11;
                      return (
                        <div 
                          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center overflow-hidden transition-all ${
                            hoveredSpot === spot.id 
                              ? 'opacity-100 z-50' 
                              : 'opacity-80'
                          }`}
                          style={{
                            color: '#FFFFFF',
                            textShadow: `0 0 6px #000000, 0 0 10px ${color}, 0 2px 4px rgba(0,0,0,0.9)`,
                            width: `${pxWidth}px`,
                            maxWidth: `${pxWidth}px`,
                            fontSize: `${fontSize}px`,
                            fontWeight: 900,
                            fontStyle: 'italic',
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.02em',
                            lineHeight: 1.2,
                            wordBreak: 'break-word' as const,
                          }}
                        >
                          {spot.playerName}
                          {spot.heatNumber && (
                            <span className="ml-0.5 opacity-70" style={{ fontSize: `${fontSize * 0.8}px` }}>H{spot.heatNumber}</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isDrawing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[#FCE14B] text-black px-6 py-3 font-black italic uppercase text-xs tracking-tighter flex items-center gap-3 shadow-[0_0_30px_rgba(252,225,75,0.3)]">
              <Crosshair size={14} className="animate-pulse" />
              <span>Draw your drop area ({currentPath.length} points)</span>
              
              <div className="flex gap-2 ml-4">
                <button 
                  onClick={() => setCurrentPath(prev => prev.slice(0, -1))}
                  disabled={currentPath.length === 0}
                  className="px-3 py-1 bg-black/10 hover:bg-black/20 disabled:opacity-30 transition-colors text-[10px]"
                >
                  Undo
                </button>
                <button 
                  onClick={handleConfirmArea}
                  disabled={currentPath.length < 3}
                  className="px-3 py-1 bg-black text-[#FCE14B] hover:bg-black/80 disabled:opacity-30 transition-colors text-[10px]"
                >
                  Confirm Area
                </button>
                <button 
                  onClick={() => { setIsDrawing(false); setCurrentPath([]); }}
                  className="px-3 py-1 bg-black/10 hover:bg-black/20 transition-colors text-[10px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-[340px] border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0A0A0B] flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Crosshair size={14} className="text-[#FCE14B]" />
              <h3 className="text-[10px] font-black italic uppercase tracking-tighter text-[#FCE14B]">Actions</h3>
            </div>

            {user && isQualified ? (
              <div className="text-center py-4">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                  Draw your drop area
                </div>
                {dropSpots.some(s => s.epicAccountId === user.uid) ? (
                  <button 
                    onClick={handleRemoveMySpot}
                    className="mt-2 px-4 py-2 border border-[#FF4444] text-[#FF4444] font-black italic uppercase text-[10px] tracking-tighter hover:bg-[#FF4444]/10 transition-colors"
                  >
                    Remove My Spot
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setCurrentPath([]);
                      setIsDrawing(true);
                    }}
                    className="mt-2 px-4 py-2 bg-[#FCE14B] text-black font-black italic uppercase text-[10px] tracking-tighter hover:bg-[#FCE14B]/80 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <PenTool size={12} />
                    Draw Area
                  </button>
                )}
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-4 text-[9px] uppercase tracking-widest font-mono text-white/30">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#4ade80]"></span> Solo drop</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]"></span> Contested</span>
                  </div>
                </div>
              </div>
            ) : user && !isQualified ? (
              <div className="text-center py-4">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                  {isHeatsLocked ? `${activeSession.label} has concluded` : `You are not qualified for ${activeSession.label}`}
                </div>
                <p className="text-[9px] text-white/20 font-mono">
                  {isHeatsLocked
                    ? 'This map is now read-only. Pick the next session to plan your drop.'
                    : `Only players seeded into ${activeSession.label} for ${selectedRegion} can place drop spots.`}
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                  Sign in to place drop spots
                </div>
                <button 
                  onClick={handleLogin}
                  className="mt-2 px-4 py-2 bg-[#FCE14B] text-black font-black italic uppercase text-[10px] tracking-tighter hover:bg-[#FCE14B]/80 transition-colors"
                >
                  Sign In with Epic Games
                </button>
              </div>
            )}
          </div>

          {/* Drop Spots List */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[#FCE14B]" />
                <h3 className="text-[10px] font-black italic uppercase tracking-tighter text-[#FCE14B]">
                  Drop Spots — {selectedRegion} — {activeSession.label}
                </h3>
              </div>
              <span className="text-[9px] font-mono text-white/20">
                {dropSpots.length} placed
              </span>
            </div>

            {expectedPlayers.length === 0 && dropSpots.length === 0 ? (
              <div className="text-center py-8">
                <MapPin size={24} className="mx-auto text-white/10 mb-3" />
                <p className="text-[10px] text-white/20 uppercase tracking-wider">
                  No players or spots yet
                </p>
                <p className="text-[9px] text-white/10 mt-1 font-mono">
                  Wait for the qualifications to be updated for this session
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {expectedPlayers.length > 0 ? (
                  <>
                    {expectedPlayers.map((playerName: string) => {
                      const spot = dropSpots.find(s => normalizeName(s.playerName) === normalizeName(playerName));
                      
                      return (
                        <div
                          key={playerName}
                          className={`flex items-center gap-3 px-3 py-2 border transition-all cursor-default ${
                            hoveredSpot === spot?.id 
                              ? 'border-white/20 bg-white/5' 
                              : 'border-transparent hover:border-white/10'
                          } ${spot && spot.epicAccountId === user?.uid ? 'bg-[#FCE14B]/5' : ''}`}
                          onMouseEnter={() => spot && setHoveredSpot(spot.id || null)}
                          onMouseLeave={() => setHoveredSpot(null)}
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] text-black font-black" 
                            style={{ backgroundColor: spot ? spot.color : 'rgba(255,255,255,0.1)' }} 
                          >
                            {spot ? '✓' : '✕'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[10px] font-bold uppercase tracking-wider truncate ${spot ? '' : 'text-white/40'}`}>
                              {playerName}
                              {spot && spot.epicAccountId === user?.uid && (
                                <span className="ml-1.5 text-[#FCE14B] opacity-60">(You)</span>
                              )}
                            </div>
                            {spot && spot.heatNumber && (
                              <div className="text-[8px] font-mono text-white/20 uppercase">
                                Heat {spot.heatNumber}
                              </div>
                            )}
                          </div>
                          {isAdmin && spot && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (spot.id) handleAdminDelete(spot.id); }}
                              className="flex-shrink-0 w-5 h-5 bg-red-600/80 hover:bg-red-500 rounded flex items-center justify-center text-white text-[9px] font-bold transition-colors"
                              title={`Delete ${playerName}'s spot`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Render any additional spots from people who might have been removed from expectedPlayers or placed a spot erroneously */}
                    {Array.from(new Map(
                      dropSpots
                        .filter(s => !expectedPlayers.some((p: string) => normalizeName(p) === normalizeName(s.playerName)))
                        .filter(s => !isAdminName(s.playerName)) // Hide admin
                        .map(s => [normalizeName(s.playerName), s]) // Deduplicate by normalized name
                    ).values()).map(spot => (
                        <div
                          key={spot.id}
                          className={`flex items-center gap-3 px-3 py-2 border transition-all cursor-default ${
                            hoveredSpot === spot.id 
                              ? 'border-white/20 bg-white/5' 
                              : 'border-transparent hover:border-white/10'
                          } ${spot.epicAccountId === user?.uid ? 'bg-[#FCE14B]/5' : 'opacity-50'}`}
                          onMouseEnter={() => setHoveredSpot(spot.id || null)}
                          onMouseLeave={() => setHoveredSpot(null)}
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] text-black font-black" 
                            style={{ backgroundColor: spot.color }} 
                          >
                            ✓
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider truncate text-[#FCE14B]">
                              {spot.playerName} <span className="text-[8px] opacity-60">(Unexpected)</span>
                              {spot.epicAccountId === user?.uid && (
                                <span className="ml-1.5 text-[#FCE14B] opacity-60">(You)</span>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (spot.id) handleAdminDelete(spot.id); }}
                              className="flex-shrink-0 w-5 h-5 bg-red-600/80 hover:bg-red-500 rounded flex items-center justify-center text-white text-[9px] font-bold transition-colors"
                              title={`Delete ${spot.playerName}'s spot`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                  </>
                ) : (
                  dropSpots
                    .filter(s => !isAdminName(s.playerName)) // Hide admin
                    .map(spot => (
                    <div
                      key={spot.id}
                      className={`flex items-center gap-3 px-3 py-2 border transition-all cursor-default ${
                        hoveredSpot === spot.id 
                          ? 'border-white/20 bg-white/5' 
                          : 'border-transparent hover:border-white/10'
                      } ${spot.epicAccountId === user?.uid ? 'bg-[#FCE14B]/5' : ''}`}
                      onMouseEnter={() => setHoveredSpot(spot.id || null)}
                      onMouseLeave={() => setHoveredSpot(null)}
                    >
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: spot.color }} 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider truncate">
                          {spot.playerName}
                          {spot.epicAccountId === user?.uid && (
                            <span className="ml-1.5 text-[#FCE14B] opacity-60">(You)</span>
                          )}
                        </div>
                        {spot.heatNumber && (
                          <div className="text-[8px] font-mono text-white/20 uppercase">
                            Heat {spot.heatNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Info Footer */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-start gap-2">
              <Info size={12} className="text-white/20 mt-0.5 flex-shrink-0" />
              <p className="text-[8px] font-mono text-white/15 leading-relaxed">
                Only players qualified for Mobile Series Heats can place drop spots. 
                Each player gets one spot per region. The communal map updates in real-time 
                for all viewers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
