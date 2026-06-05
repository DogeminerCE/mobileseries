import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'public', 'leaderboard.json');
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
  let clean = token.replace(/flag_/i, '').replace(/GROUPIDENTITY_GEOIDENTITY_/i, '').toUpperCase();
  const mapped = COUNTRY_MAP[clean];
  if (mapped) return mapped;
  if (clean.length === 2) return clean.toLowerCase();
  return clean.toLowerCase().substring(0, 2);
}


async function fetchWithRetry(url: string, retries = 5): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.success !== false || data.errorCode !== 'RATELIMITED') return data;
      const backoff = Math.min(5000 * Math.pow(2, i), 30000);
      console.log(`[WARN] Rate limited on ${url}, retrying in ${backoff / 1000}s... (attempt ${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, backoff));
    } catch (err) {
      const backoff = Math.min(5000 * Math.pow(2, i), 30000);
      console.error(`[WARN] Fetch error on ${url}, retrying in ${backoff / 1000}s...`, err);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  return { success: false, entries: [] };
}

const SERIES_PRIZE_TABLES: Record<string, Array<{ rank: number, prize: number }>> = {
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
  'NAW': [
    { rank: 1, prize: 700 },
    { rank: 2, prize: 600 },
    { rank: 3, prize: 500 },
    { rank: 4, prize: 400 },
    { rank: 8, prize: 250 },
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

// Blitz Mobile Cup Finals prizing
const BLITZ_PRIZE_TABLES: Record<string, Array<{ rank: number, prize: number }>> = {
  'EU': [
    { rank: 1, prize: 1500 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 600 }, { rank: 5, prize: 500 }, { rank: 6, prize: 450 },
    { rank: 7, prize: 400 }, { rank: 8, prize: 350 }, { rank: 9, prize: 325 },
    { rank: 10, prize: 300 }, { rank: 11, prize: 275 }, { rank: 12, prize: 250 },
    { rank: 13, prize: 225 }, { rank: 14, prize: 200 }, { rank: 15, prize: 175 },
    { rank: 16, prize: 150 },
  ],
  'NAC': [
    { rank: 1, prize: 1500 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 600 }, { rank: 5, prize: 500 }, { rank: 6, prize: 450 },
    { rank: 7, prize: 400 }, { rank: 8, prize: 350 }, { rank: 9, prize: 325 },
    { rank: 10, prize: 300 }, { rank: 11, prize: 275 }, { rank: 12, prize: 250 },
    { rank: 13, prize: 225 }, { rank: 14, prize: 200 }, { rank: 15, prize: 175 },
    { rank: 16, prize: 150 },
  ],
  'NAW': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'BR': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'ASIA': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'ME': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'OCE': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
};

// Touch-Only Test Cup / Blitz Test Cup prizing (same for all regions)
const TESTCUP_PRIZE_TABLES: Record<string, Array<{ rank: number, prize: number }>> = {
  'EU': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'NAC': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'NAW': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'BR': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'ASIA': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'ME': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
  'OCE': [
    { rank: 1, prize: 375 }, { rank: 2, prize: 250 }, { rank: 3, prize: 200 },
    { rank: 4, prize: 150 }, { rank: 5, prize: 125 }, { rank: 16, prize: 100 },
  ],
};

// Reload Duos Cash Cup Mobile prizing (using test cup structure)
const RELOAD_PRIZE_TABLES = TESTCUP_PRIZE_TABLES;

const DEFAULT_PRIZE_TABLE = [
  { rank: 1, prize: 100 },
  { rank: 16, prize: 100 },
];

function calculatePrize(rank: number, region: string, category: EventCategory = 'series'): number {
  const categoryTables: Record<EventCategory, Record<string, Array<{ rank: number, prize: number }>>> = {
    series: SERIES_PRIZE_TABLES,
    blitz: BLITZ_PRIZE_TABLES,
    testcup: TESTCUP_PRIZE_TABLES,
    reload: RELOAD_PRIZE_TABLES,
  };
  const table = (categoryTables[category] || categoryTables.series)[region] || DEFAULT_PRIZE_TABLE;
  const match = [...table].sort((a, b) => a.rank - b.rank).find(t => rank <= t.rank);
  return match ? match.prize : 0;
}

const REGION_LABEL_MAP: Record<string, string> = {
  'EU': 'EUROPE', 'NAC': 'NA-CENTRAL', 'NAW': 'NA-WEST',
  'BR': 'BRAZIL', 'ASIA': 'ASIA', 'OCE': 'OCEANIA', 'ME': 'MIDDLE EAST'
};

type EventCategory = 'series' | 'blitz' | 'testcup' | 'reload';

async function aggregateMobileEarnings() {
  console.log("Starting verified global series aggregation (Sept 2023 - Present)...");
  const regions = ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'];
  const playerMap: Record<string, any> = {};
  const playerRegionEarnings: Record<string, Record<string, number>> = {};
  const playerEvents: Record<string, Array<{ event: string, region: string, placement: number, earnings: number, date: string, category: string }>> = {};
  const processedTourneys = new Set<string>();

  // Qualification tracking: 1st place per qualifier per region
  const qualifications: Record<string, Array<{
    player: string;
    countryCode: string;
    qualifier: string;
    qualifierDate: string;
    originalWinner: boolean;
    rolledDownFrom: string | null;
  }>> = {};
  const qualifiedPlayers: Record<string, Set<string>> = {}; // region -> set of qualified player keys

  for (const region of regions) {
    console.log(`[REGION] Processing: ${region}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const regionQualifiers: Array<{
      qualLabel: string;
      qualNum: number;
      eventDate: string;
      entries: any[];
    }> = [];

    let tourneyData: any;
    let tournaments: any[] = [];
    let retryCount = 0;
    while (retryCount < 5) {
      const tourneyUrl = `${OSIRION_API}/tournaments?includeHistoricData=true&region=${region}`;
      tourneyData = await fetchWithRetry(tourneyUrl);

      if (Array.isArray(tourneyData)) {
        tournaments = tourneyData;
        break;
      } else if (tourneyData && tourneyData.success && tourneyData.tournaments) {
        tournaments = tourneyData.tournaments;
        break;
      } else {
        console.error(`[WARN] API rejected tournament list for region ${region}, retrying...`, tourneyData);
        retryCount++;
        const backoff = Math.min(5000 * Math.pow(2, retryCount), 30000);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    if (tournaments.length === 0) {
      console.error(`[ERROR] Failed to fetch tournament list for region ${region} after 5 retries.`);
      continue;
    }

    // Classify each tournament into a category
    function classifyTourney(t: any): EventCategory | null {
      if (processedTourneys.has(region + '_' + t.eventId)) return null;
      const title = t.displayData?.titleLine1?.toLowerCase() || '';
      const eid = t.eventId?.toLowerCase() || '';
      
      // Filter out skin/cosmetic cups which have no real money prize pool
      if (
        title.includes('skin') || eid.includes('skin') || 
        title.includes('champion') || eid.includes('champion') || 
        title.includes('surf witch') || eid.includes('surfwitch') || 
        eid.includes('axeofchamps') ||
        eid.includes('s37_blitzmobilecup') ||
        title.includes('stranger things') || eid.includes('strangerthings')
      ) {
        return null;
      }

      // Mobile Series (including Dec blitz qualifiers titled "Mobile Series")
      if (title.includes('mobile series') || eid.includes('mobileseries')) return 'series';
      // Blitz Mobile Cup (but NOT the ones already matched as series above)
      if (eid.includes('blitzmobilecup') || (title.includes('blitz') && title.includes('mobile'))) return 'blitz';
      // Touch-Only Test Cup / Mobile Test Cup
      if (eid.includes('touchonlymobilecup') || eid.includes('mobiletestcup')) return 'testcup';
      // Platform Reload Duos Cash Cup (Mobile)
      if (eid.includes('platformreloadduoscashcupmobile')) return 'reload';
      
      return null;
    }

    const categorizedTourneys = tournaments
      .map((t: any) => ({ tourney: t, category: classifyTourney(t) }))
      .filter((x: any) => x.category !== null);

    const counts = { series: 0, blitz: 0, testcup: 0, reload: 0 };
    categorizedTourneys.forEach((x: any) => counts[x.category as EventCategory]++);
    console.log(`[DATA] Found ${categorizedTourneys.length} mobile events in ${region} (series: ${counts.series}, blitz: ${counts.blitz}, testcup: ${counts.testcup}, reload: ${counts.reload})`);
    
    const processedLeaderboards = new Set<string>();

    for (const { tourney, category } of categorizedTourneys) {
      processedTourneys.add(region + '_' + tourney.eventId);
      const windows = tourney.eventWindows || [];
      
      for (const window of windows) {
        const winId = window.eventWindowId?.toLowerCase() || '';
        
        // For Mobile Series: only process qualifier windows (existing logic)
        if (category === 'series') {
          if (!winId.includes('qualifier') || winId.endsWith('_series')) {
            continue;
          }
        } else {
          // For other categories: skip series aggregate windows
          if (winId.endsWith('_series')) continue;
          
          // Skip qualifiers and early rounds if there is a subsequent round for the same event
          const match = winId.match(/^(.*?)(qualifier\d*|round\d+|event\d+)(.*)$/);
          if (match && !winId.includes('final')) {
            const prefix = match[1];
            const currentRound = match[2];
            
            const hasHigherRound = windows.some((w: any) => {
              const id = w.eventWindowId?.toLowerCase() || '';
              if (!id.startsWith(prefix) || id === winId) return false;
              
              if (currentRound.startsWith('qualifier') || currentRound.startsWith('event')) {
                return id.includes('final') || id.includes('round');
              }
              
              if (currentRound.startsWith('round')) {
                const currentNum = parseInt(currentRound.replace('round', ''), 10) || 1;
                const otherRoundMatch = id.match(/round(\d+)/);
                if (otherRoundMatch) {
                  const otherNum = parseInt(otherRoundMatch[1], 10);
                  return otherNum > currentNum;
                }
                return id.includes('final');
              }
              return false;
            });

            if (hasHigherRound) {
              continue;
            }
          }
        }

        let processedValidLeaderboard = false;
        for (const loc of (window.scoreLocations || [])) {
          if (processedValidLeaderboard) break;
          
          const lbEventWindowId = loc.leaderboardEventWindowId;
          const normalizedId = lbEventWindowId.replace(/_2$|_alt$|_alt\d+$/i, '');
          
          if (
            processedLeaderboards.has(lbEventWindowId) ||
            processedLeaderboards.has(normalizedId) ||
            lbEventWindowId.toLowerCase().includes('_series')
          ) {
             continue;
          }
          
          processedLeaderboards.add(lbEventWindowId);
          processedLeaderboards.add(normalizedId);
          processedValidLeaderboard = true;

          const lbUrl = `${OSIRION_API}/tournaments/leaderboard?leaderboardEventId=${loc.leaderboardEventId}&leaderboardEventWindowId=${lbEventWindowId}`;
          console.log(`[CRAWL][${category}] ${lbUrl}`);
          await new Promise(resolve => setTimeout(resolve, 1500)); // Delay between fetches to avoid rate limiting
          const lbData = await fetchWithRetry(lbUrl);
          
          if (!lbData.success || !lbData.leaderboard?.entries) continue;

          const eventTitle = tourney.displayData?.titleLine1 || 'Unknown Event';
          const eventDate = lbData.leaderboard.updatedAt || new Date().toISOString();
          // Build a human-readable event name from the window ID
          const winIdParts = lbEventWindowId.match(/(?:Qualifier|Round|Final|Week|Event)\d*/i);
          const windowLabel = winIdParts ? winIdParts[0] : '';
          const fullEventName = windowLabel 
            ? `${eventTitle} — ${windowLabel} (${REGION_LABEL_MAP[region] || region})`
            : `${eventTitle} (${REGION_LABEL_MAP[region] || region})`;

          lbData.leaderboard.entries.forEach((entry: any) => {
            const prizeMoney = calculatePrize(entry.rank, region, category as EventCategory);
            
            (entry.players || []).forEach((player: any) => {
              const username = player.username;
              if (!username) return;
              const key = username.toLowerCase();

              if (!playerMap[key]) {
                playerMap[key] = {
                  name: username,
                  earningsUSD: 0,
                  countryCode: resolveCountryCode(player.flagToken),
                  lastActiveTournament: tourney.displayData?.titleLine1,
                  lastActiveDate: eventDate,
                };
              }

              // Only count Mobile Series earnings towards the base total
              if (category === 'series') {
                playerMap[key].earningsUSD += prizeMoney;
              }

              if (!playerRegionEarnings[key]) playerRegionEarnings[key] = {};
              if (category === 'series') {
                playerRegionEarnings[key][region] = (playerRegionEarnings[key][region] || 0) + prizeMoney;
              }

              // Track individual event results with category
              if (!playerEvents[key]) playerEvents[key] = [];
              playerEvents[key].push({
                event: fullEventName,
                region: REGION_LABEL_MAP[region] || region,
                placement: entry.rank,
                earnings: prizeMoney,
                date: eventDate,
                category: category as string,
              });
              
              const entryDate = new Date(eventDate).getTime();
              const existingDate = new Date(playerMap[key].lastActiveDate).getTime();
              if (entryDate > existingDate) {
                playerMap[key].name = username;
                playerMap[key].lastActiveTournament = tourney.displayData?.titleLine1;
                playerMap[key].lastActiveDate = eventDate;
                playerMap[key].countryCode = resolveCountryCode(player.flagToken);
              }
            });
          });

          // --- Qualification Tracking Collection (series qualifiers only) ---
          if (category === 'series' && lbData.leaderboard.entries && lbData.leaderboard.entries.length > 0) {
            const qualMatch = lbEventWindowId.match(/Qualifier(\d+)/i);
            const qualLabel = qualMatch ? `Qualifier ${qualMatch[1]}` : lbEventWindowId;
            const qualNum = qualMatch ? parseInt(qualMatch[1], 10) : 999;
            regionQualifiers.push({
              qualLabel,
              qualNum,
              eventDate,
              entries: lbData.leaderboard.entries
            });
          }
        }
      }
    }

    // --- Evaluate Qualifications Chronologically ---
    const regionLabel = REGION_LABEL_MAP[region] || region;
    if (!qualifications[regionLabel]) qualifications[regionLabel] = [];
    if (!qualifiedPlayers[regionLabel]) qualifiedPlayers[regionLabel] = new Set();

    regionQualifiers.sort((a, b) => a.qualNum - b.qualNum);

    for (const qual of regionQualifiers) {
      const sortedEntries = [...qual.entries].sort((a: any, b: any) => a.rank - b.rank);
      let qualifiedPlayer = null;
      let originalWinner: string | null = null;
      
      for (const entry of sortedEntries) {
        const username = (entry.players || [])[0]?.username;
        if (!username) continue;
        const playerKey = username.replace(/[\sㅤ\u3164\u200B-\u200D\uFEFF]+/g, '').toLowerCase();
        
        if (entry.rank === 1) {
          originalWinner = username;
        }
        
        if (!qualifiedPlayers[regionLabel].has(playerKey)) {
          qualifiedPlayers[regionLabel].add(playerKey);
          const cc = resolveCountryCode((entry.players || [])[0]?.flagToken);
          qualifiedPlayer = {
            player: username,
            countryCode: cc,
            qualifier: qual.qualLabel,
            qualifierDate: qual.eventDate,
            originalWinner: entry.rank === 1,
            rolledDownFrom: entry.rank === 1 ? null : (originalWinner || null),
          };
          break;
        }
      }
      
      if (qualifiedPlayer) {
        qualifications[regionLabel].push(qualifiedPlayer);
      }
    }
  }

  const aggregatedPlayers = Object.values(playerMap)
    .filter((p: any) => {
      // Include if they have series earnings
      if (p.earningsUSD > 0) return true;
      // Include if they earned money in any non-series event
      const events = playerEvents[p.name?.toLowerCase()] || [];
      return events.some(e => e.earnings > 0);
    })
    .sort((a: any, b: any) => b.earningsUSD - a.earningsUSD)
    .map((p: any, idx: number) => {
      const key = p.name.toLowerCase();
      const regionMap = playerRegionEarnings[key] || {};
      const topRegionKey = Object.entries(regionMap).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'EU';
      // Sort events by date descending (most recent first), exclude $0 events
      const events = (playerEvents[key] || []).filter(e => e.earnings > 0).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { ...p, rank: idx + 1, primaryRegion: REGION_LABEL_MAP[topRegionKey] || 'GLOBAL', events };
    });

  const payload = {
    players: aggregatedPlayers,
    qualifications,
    lastUpdated: new Date().toISOString(),
    source: 'github-actions'
  };

  // Ensure public directory exists
  const publicDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Safety check: don't overwrite good data with incomplete data
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      const existingCount = existing.players?.length || 0;
      const newCount = aggregatedPlayers.length;
      if (existingCount > 0 && newCount < existingCount * 0.7) {
        console.error(`[SAFETY] New data has ${newCount} players vs existing ${existingCount}. Likely rate-limited. Skipping overwrite.`);
        console.error(`[SAFETY] Delete public/leaderboard.json manually and re-run if you want to force a fresh build.`);
        return;
      }
    } catch (e) {
      // If existing file is corrupt, proceed with overwrite
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  console.log(`!!! Aggregation complete — ${aggregatedPlayers.length} players written to public/leaderboard.json !!!`);
}

aggregateMobileEarnings().catch(err => {
    console.error("Scraper Failed:", err);
    process.exit(1);
});
