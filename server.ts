import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs';

const CACHE_FILE = path.join(process.cwd(), 'leaderboard_cache.json');
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const OSIRION_API = 'https://fnapi.osirion.gg/v1';

const COUNTRY_MAP: Record<string, string> = {
  'FRANCE': 'fr', 'GERMANY': 'de', 'ITALY': 'it', 'IRELAND': 'ie',
  'CZECHREPUBLIC': 'cz', 'MEXICO': 'mx', 'BELGIUM': 'be', 'NETHERLANDS': 'nl',
  'UNITEDSTATES': 'us', 'CANADA': 'ca', 'JAPAN': 'jp', 'ARGENTINA': 'ar',
  'ICELAND': 'is', 'PORTUGAL': 'pt', 'UNITEDKINGDOM': 'gb', 'EGYPT': 'eg',
  'BRAZIL': 'br', 'SPAIN': 'es', 'POLAND': 'pl', 'SAUDIARABIA': 'sa',
  'SWITZERLAND': 'ch', 'NORWAY': 'no', 'SWEDEN': 'se', 'DENMARK': 'dk',
  'FINLAND': 'fi', 'AUSTRALIA': 'au', 'NEWZEALAND': 'nz', 'CHILE': 'cl',
  'COLOMBIA': 'co', 'PERU': 'pe', 'SOUTHAFRICA': 'za', 'UKRAINE': 'ua',
  'GLOBAL': 'un', 'EU': 'eu'
};

function resolveCountryCode(token: string): string {
  if (!token) return 'un';
  // Use regex for more robust cleaning of known prefixes
  let clean = token.replace(/flag_/i, '').replace(/GROUPIDENTITY_GEOIDENTITY_/i, '').toUpperCase();
  
  const mapped = COUNTRY_MAP[clean];
  if (mapped) return mapped;

  // Fallback for codes like "EU" or "US" that might be returned directly
  if (clean.length === 2) return clean.toLowerCase();
  
  // Generic fallback: first 2 chars
  return clean.toLowerCase().substring(0, 2);
}

async function fetchOsirionLeaderboard(eventId: string, windowId: string) {
  try {
    const url = `${OSIRION_API}/tournaments/leaderboard?leaderboardEventId=${eventId}&leaderboardEventWindowId=${windowId}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.success) return null;
    return data.leaderboard;
  } catch (err) {
    console.error("Osirion Fetch Error:", err);
    return null;
  }
}

/** 
 * MOBILE SERIES QUALIFIER PRIZING (PER REGION) - UPDATED 2024
 * Data verified from official tournament payout summaries.
 */
const PRIZE_TABLES: Record<string, Array<{ rank: number, prize: number }>> = {
  'EU': [
    { rank: 1, prize: 1000 },
    { rank: 2, prize: 900 },
    { rank: 3, prize: 800 },
    { rank: 4, prize: 700 },
    { rank: 8, prize: 500 },
    { rank: 12, prize: 200 },
    { rank: 16, prize: 100 },
  ],
  'NAC': [
    { rank: 1, prize: 1000 },
    { rank: 2, prize: 900 },
    { rank: 3, prize: 800 },
    { rank: 4, prize: 700 },
    { rank: 8, prize: 500 },
    { rank: 12, prize: 200 },
    { rank: 16, prize: 100 },
  ],
  'BR': [
    { rank: 1, prize: 700 },
    { rank: 2, prize: 600 },
    { rank: 3, prize: 500 },
    { rank: 4, prize: 400 },
    { rank: 8, prize: 250 },
    { rank: 12, prize: 200 },
    { rank: 16, prize: 100 },
  ],
  'ASIA': [
    { rank: 1, prize: 700 },
    { rank: 2, prize: 600 },
    { rank: 3, prize: 500 },
    { rank: 4, prize: 400 },
    { rank: 8, prize: 250 },
    { rank: 12, prize: 200 },
    { rank: 16, prize: 100 },
  ],
  'ME': [
    { rank: 1, prize: 700 },
    { rank: 2, prize: 600 },
    { rank: 3, prize: 500 },
    { rank: 4, prize: 400 },
    { rank: 8, prize: 250 },
    { rank: 12, prize: 200 },
    { rank: 16, prize: 100 },
  ],
  'NAW': [
    { rank: 1, prize: 700 },
    { rank: 2, prize: 600 },
    { rank: 3, prize: 500 },
    { rank: 4, prize: 400 },
    { rank: 8, prize: 250 },
    { rank: 12, prize: 200 },
    { rank: 16, prize: 100 },
  ],
  'OCE': [
    { rank: 1, prize: 700 },
    { rank: 2, prize: 600 },
    { rank: 3, prize: 500 },
    { rank: 4, prize: 400 },
    { rank: 8, prize: 250 },
    { rank: 12, prize: 200 },
    { rank: 16, prize: 100 },
  ]
};

// Fallback for smaller/unmapped regions
const DEFAULT_PRIZE_TABLE = [
  { rank: 1, prize: 100 },
  { rank: 16, prize: 100 },
];

function calculatePrize(rank: number, region: string): number {
  const table = PRIZE_TABLES[region] || DEFAULT_PRIZE_TABLE;
  // Sort by rank ascending to find the bracket
  const match = [...table].sort((a,b) => a.rank - b.rank).find(t => rank <= t.rank);
  return match ? match.prize : 0;
}

let isAggregating = false;

// Aggregate player earnings across all tournaments
async function aggregateMobileEarnings() {
  if (isAggregating) {
    console.log("Aggregation already in progress, skipping start...");
    return;
  }

  isAggregating = true;
  try {
    console.log("Starting verified global series aggregation (Sept 2023 - Present)...");
    const regions = ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'];
    const playerMap: Record<string, any> = {};
    const playerRegionEarnings: Record<string, Record<string, number>> = {};
    // FIX: processedTourneys is now keyed by region_eventId to prevent cross-region dedup
    const processedTourneys = new Set<string>();

    for (const region of regions) {
      console.log(`[REGION] Processing: ${region}`);
      
      // Delay to prevent hitting Osirion rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const tourneyUrl = `${OSIRION_API}/tournaments?includeHistoricData=true&region=${region}`;
      const tourneyResp = await fetch(tourneyUrl);
      const tourneyData = await tourneyResp.json();
      
      if (!tourneyData.success) {
        console.error(`[ERROR] API rejected tournament list for region ${region}`);
        continue;
      }

      const mobileTourneys = tourneyData.tournaments.filter((t: any) => {
        // FIX: prefix with region to prevent cross-region event skipping
        if (processedTourneys.has(region + '_' + t.eventId)) return false;
        
        const title1 = t.displayData?.titleLine1?.toLowerCase() || '';
        const eventId = t.eventId?.toLowerCase() || '';

        // FIX: Only target official Mobile Series events.
        // Removed: 'mobile cup', 'blitzmobile', 'mobilecup' — these are pre-season/warmup events
        // that have different prize structures and would inflate earnings incorrectly.
        return (
          title1.includes('mobile series') || 
          eventId.includes('mobileseries')
        );
      });

      console.log(`[DATA] Found ${mobileTourneys.length} unique Mobile tournaments in ${region}.`);

      const processedLeaderboards = new Set<string>();

      for (const tourney of mobileTourneys) {
        // FIX: use region-prefixed key
        processedTourneys.add(region + '_' + tourney.eventId);
        const windows = tourney.eventWindows || [];
        
        for (const window of windows) {
          const winId = window.eventWindowId?.toLowerCase() || '';
          
          // CRITICAL: We only prize the "Qualifier" final round windows.
          // Skip: non-qualifier windows (Round1, Round2, etc.), and generic _series alias windows.
          // FIX: Changed from winId.includes('series') to winId.endsWith('_series').
          //      The old check incorrectly blocked valid 'MobileSeriesCup' qualifier windows
          //      because they contain the word 'series'.
          if (!winId.includes('qualifier') || winId.endsWith('_series')) {
            continue;
          }

          // Fetch leaderboard for each score location
          let processedValidLeaderboard = false;
          for (const loc of (window.scoreLocations || [])) {
            if (processedValidLeaderboard) break; // Only fetch ONE leaderboard per qualifier window
            
            const lbEventWindowId = loc.leaderboardEventWindowId;
            
            // FIX: Normalize by stripping known variant suffixes (_mg, _2, _alt, etc.) to
            // catch duplicate windows that differ only in suffix
            // e.g. DecQualifier2_NAW vs DecQualifier2_NAW_mg both map to same base
            const normalizedId = lbEventWindowId.replace(/_mg$|_2$|_alt$|_alt\d+$/i, '');
            
            // Deduplicate: Skip if we've already seen this ID or its normalized base,
            // or if it's a generic _series alias window
            if (
              processedLeaderboards.has(lbEventWindowId) ||
              processedLeaderboards.has(normalizedId) ||
              lbEventWindowId.toLowerCase().includes('_series')
            ) {
               continue;
            }
            
            processedLeaderboards.add(lbEventWindowId);
            processedLeaderboards.add(normalizedId); // also lock the normalized key
            processedValidLeaderboard = true;

            console.log(`[CRAWL] ${region}: ${tourney.displayData?.titleLine1} -> ${lbEventWindowId}`);
            
            const lbUrl = `${OSIRION_API}/tournaments/leaderboard?leaderboardEventId=${loc.leaderboardEventId}&leaderboardEventWindowId=${lbEventWindowId}`;
            const lbResp = await fetch(lbUrl);
            const lbData = await lbResp.json();
            
            if (!lbData.success || !lbData.leaderboard.entries) continue;

            lbData.leaderboard.entries.forEach((entry: any) => {
              const username = entry.players[0]?.username;
              if (!username) return;

              if (!playerMap[username]) {
                playerMap[username] = {
                  name: username,
                  earningsUSD: 0,
                  countryCode: resolveCountryCode(entry.players[0]?.flagToken),
                  lastActiveTournament: tourney.displayData?.titleLine1,
                  lastActiveDate: lbData.leaderboard.updatedAt || new Date().toISOString(),
                };
              }

              // Apply actual prize money based on rank for this specific window
              const prizeMoney = calculatePrize(entry.rank, region);
              playerMap[username].earningsUSD += prizeMoney;

              // Track per-region earnings to determine primaryRegion
              if (!playerRegionEarnings[username]) playerRegionEarnings[username] = {};
              playerRegionEarnings[username][region] = (playerRegionEarnings[username][region] || 0) + prizeMoney;
              
              const entryDate = new Date(lbData.leaderboard.updatedAt || 0).getTime();
              const existingDate = new Date(playerMap[username].lastActiveDate).getTime();
              if (entryDate > existingDate) {
                playerMap[username].lastActiveTournament = tourney.displayData?.titleLine1;
                playerMap[username].lastActiveDate = lbData.leaderboard.updatedAt;
                playerMap[username].countryCode = resolveCountryCode(entry.players[0]?.flagToken);
              }
            });
          }
        }
      }
    }

    // Map server region keys to UI region labels for frontend filtering
    const REGION_LABEL_MAP: Record<string, string> = {
      'EU': 'EUROPE', 'NAC': 'NA-CENTRAL', 'NAW': 'NA-WEST',
      'BR': 'BRAZIL', 'ASIA': 'ASIA', 'OCE': 'OCEANIA', 'ME': 'MIDDLE EAST'
    };

    const aggregatedPlayers = Object.values(playerMap)
      .filter((p: any) => p.earningsUSD > 0)
      .sort((a: any, b: any) => b.earningsUSD - a.earningsUSD)
      .map((p: any, idx: number) => {
        // Find the region where this player earned the most
        const regionMap = playerRegionEarnings[p.name] || {};
        const topRegionKey = Object.entries(regionMap).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'EU';
        return { ...p, rank: idx + 1, primaryRegion: REGION_LABEL_MAP[topRegionKey] || 'GLOBAL' };
      });

    const payload = {
      players: aggregatedPlayers,
      lastUpdated: new Date().toISOString(),
      source: 'osirion-aggregated'
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload));
    console.log("!!! Aggregation complete and cache updated !!!");
  } catch (err) {
    console.error("[CRITICAL] Aggregation Task Failure:", err);
  } finally {
    isAggregating = false;
  }
}

// Run aggregation immediately on start, then every hour
if (process.env.NODE_ENV === 'production') {
  aggregateMobileEarnings();
  setInterval(aggregateMobileEarnings, 60 * 60 * 1000);
} else {
  // In dev, run it once if cache is empty
  if (!fs.existsSync(CACHE_FILE)) {
    aggregateMobileEarnings();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Dev keybind: CTRL+\ to force a full cache reset and re-aggregate
  app.post("/api/reset-cache", async (req, res) => {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
      // Re-trigger aggregation
      aggregateMobileEarnings();
      res.json({ status: "resetting" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      // Prioritize the aggregated cache
      if (fs.existsSync(CACHE_FILE)) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        // Check if cache is non-empty (aggregation finished)
        if (cached.players && cached.players.length > 1) {
          return res.json({ ...cached, source: 'osirion-aggregated' });
        }
      }

      // Fallback: cache not ready yet, trigger aggregation if not running
      if (!isAggregating) {
        aggregateMobileEarnings();
      }
      const mockPlayers = [
        { rank: 1, name: "Initializing aggregation...", earningsUSD: 0, countryCode: "EU", primaryRegion: "EUROPE", lastActiveTournament: "System", lastActiveDate: new Date().toISOString() }
      ];
      res.json({ players: mockPlayers, source: 'loading' });

    } catch (err) {
      res.json({ players: [], source: 'error', note: (err as Error).message });
    }
  });

  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: 'URL required' });
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const text = await resp.text();
      res.json({ status: resp.status, length: text.length, body: text.substring(0, 1000) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
