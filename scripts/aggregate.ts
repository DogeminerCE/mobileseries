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

// Chapter 7 Heats Stage prizing (only for events AFTER Qualifier 11)
const HEATS_PRIZE_TABLES: Record<string, Array<{ rank: number, prize: number }>> = {
  'EU': [
    { rank: 4, prize: 0 },
    { rank: 8, prize: 200 },
    { rank: 12, prize: 150 },
    { rank: 16, prize: 100 },
  ],
  'NAC': [
    { rank: 4, prize: 0 },
    { rank: 8, prize: 200 },
    { rank: 12, prize: 150 },
    { rank: 16, prize: 100 },
  ],
  'NAW': [
    { rank: 4, prize: 0 },
    { rank: 8, prize: 150 },
    { rank: 16, prize: 100 },
  ],
  'BR': [
    { rank: 4, prize: 0 },
    { rank: 8, prize: 150 },
    { rank: 16, prize: 100 },
  ],
  'ASIA': [
    { rank: 4, prize: 0 },
    { rank: 8, prize: 150 },
    { rank: 16, prize: 100 },
  ],
  'ME': [
    { rank: 4, prize: 0 },
    { rank: 8, prize: 150 },
    { rank: 16, prize: 100 },
  ],
  'OCE': [
    { rank: 4, prize: 0 },
    { rank: 8, prize: 150 },
    { rank: 16, prize: 100 },
  ],
};

// Chapter 7 Qualifier prizing (after Heats, top 16 from each heat's top 4)
const QUALIFIER_PRIZE_TABLES: Record<string, Array<{ rank: number, prize: number }>> = {
  'EU': [
    { rank: 1, prize: 1500 }, { rank: 2, prize: 1200 }, { rank: 3, prize: 1000 },
    { rank: 4, prize: 900 }, { rank: 5, prize: 800 }, { rank: 6, prize: 750 },
    { rank: 7, prize: 700 }, { rank: 8, prize: 650 },
    { rank: 10, prize: 600 }, { rank: 12, prize: 500 },
    { rank: 14, prize: 400 }, { rank: 16, prize: 300 },
  ],
  'NAC': [
    { rank: 1, prize: 1500 }, { rank: 2, prize: 1200 }, { rank: 3, prize: 1000 },
    { rank: 4, prize: 900 }, { rank: 5, prize: 800 }, { rank: 6, prize: 750 },
    { rank: 7, prize: 700 }, { rank: 8, prize: 650 },
    { rank: 10, prize: 600 }, { rank: 12, prize: 500 },
    { rank: 14, prize: 400 }, { rank: 16, prize: 300 },
  ],
  'NAW': [
    { rank: 1, prize: 1200 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 700 }, { rank: 6, prize: 600 }, { rank: 8, prize: 500 },
    { rank: 10, prize: 400 }, { rank: 12, prize: 300 },
    { rank: 14, prize: 250 }, { rank: 16, prize: 200 },
  ],
  'BR': [
    { rank: 1, prize: 1200 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 700 }, { rank: 6, prize: 600 }, { rank: 8, prize: 500 },
    { rank: 10, prize: 400 }, { rank: 12, prize: 300 },
    { rank: 14, prize: 250 }, { rank: 16, prize: 200 },
  ],
  'ASIA': [
    { rank: 1, prize: 1200 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 700 }, { rank: 6, prize: 600 }, { rank: 8, prize: 500 },
    { rank: 10, prize: 400 }, { rank: 12, prize: 300 },
    { rank: 14, prize: 250 }, { rank: 16, prize: 200 },
  ],
  'ME': [
    { rank: 1, prize: 1200 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 700 }, { rank: 6, prize: 600 }, { rank: 8, prize: 500 },
    { rank: 10, prize: 400 }, { rank: 12, prize: 300 },
    { rank: 14, prize: 250 }, { rank: 16, prize: 200 },
  ],
  'OCE': [
    { rank: 1, prize: 1200 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 700 }, { rank: 6, prize: 600 }, { rank: 8, prize: 500 },
    { rank: 10, prize: 400 }, { rank: 12, prize: 300 },
    { rank: 14, prize: 250 }, { rank: 16, prize: 200 },
  ],
};

const DEFAULT_PRIZE_TABLE = [
  { rank: 1, prize: 100 },
  { rank: 16, prize: 100 },
];

type EventCategory = 'series' | 'blitz' | 'testcup' | 'reload' | 'heats' | 'qualifier' | 'victorycup';

function calculatePrize(rank: number, region: string, category: EventCategory = 'series'): number {
  const categoryTables: Record<EventCategory, Record<string, Array<{ rank: number, prize: number }>>> = {
    series: SERIES_PRIZE_TABLES,
    blitz: BLITZ_PRIZE_TABLES,
    testcup: TESTCUP_PRIZE_TABLES,
    reload: RELOAD_PRIZE_TABLES,
    heats: HEATS_PRIZE_TABLES,
    qualifier: QUALIFIER_PRIZE_TABLES,
  };
  const table = (categoryTables[category] || categoryTables.series)[region] || DEFAULT_PRIZE_TABLE;
  const match = [...table].sort((a, b) => a.rank - b.rank).find(t => rank <= t.rank);
  return match ? match.prize : 0;
}

const REGION_LABEL_MAP: Record<string, string> = {
  'EU': 'EUROPE', 'NAC': 'NA-CENTRAL', 'NAW': 'NA-WEST',
  'BR': 'BRAZIL', 'ASIA': 'ASIA', 'OCE': 'OCEANIA', 'ME': 'MIDDLE EAST'
};

async function aggregateMobileEarnings() {
  console.log("Starting verified global series aggregation (Sept 2023 - Present)...");
  const regions = ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'];
  const playerMap: Record<string, any> = {};
  const playerRegionEarnings: Record<string, Record<string, number>> = {};
  const playerSeriesPoints: Record<string, Record<string, number>> = {};
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

  // Heat Seeding: Snake draft from cumulative Round Stages
  const heatsSeeding: Record<string, Record<number, Array<{ player: string, countryCode: string, rank: number, points: number }>>> = {};

  // Opens Round 1 + Round 2 combined points tracker (for heats seeding only)
  const opensRoundPoints: Record<string, Record<string, { name: string, countryCode: string, points: number }>> = {};

  // Qualifier Eligible: Top 4 from Heats
  const qualifierEligible: Record<string, Array<{ player: string, countryCode: string, fromHeat: string }>> = {};

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

    let maxSeason = 0;
    tournaments.forEach(t => {
      const m = t.eventId?.match(/S(\d+)_/i);
      if (m) maxSeason = Math.max(maxSeason, parseInt(m[1], 10));
    });

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

      // Chapter 7 format: Heats & Qualifiers (post-Q11 events)
      if (eid.includes('mobileseries') && (eid.includes('heat') || title.includes('heat'))) return 'heats';
      if (eid.includes('mobileseries') && eid.includes('qualifier')) return 'qualifier';
      if ((eid.includes('victorycup') || title.includes('victory cup')) && (eid.includes('mobile') || title.includes('mobile'))) return 'victorycup';

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

    const counts: Record<string, number> = { series: 0, blitz: 0, testcup: 0, reload: 0, heats: 0, qualifier: 0, victorycup: 0 };
    categorizedTourneys.forEach((x: any) => counts[x.category as string]++);
    console.log(`[DATA] Found ${categorizedTourneys.length} mobile events in ${region} (series: ${counts.series}, blitz: ${counts.blitz}, testcup: ${counts.testcup}, reload: ${counts.reload}, heats: ${counts.heats}, qualifier: ${counts.qualifier}, victorycup: ${counts.victorycup})`);
    
    const processedLeaderboards = new Set<string>();

    for (const { tourney, category } of categorizedTourneys) {
      processedTourneys.add(region + '_' + tourney.eventId);
      const windows = tourney.eventWindows || [];
      
      for (const window of windows) {
        const winId = window.eventWindowId?.toLowerCase() || '';
        
        // For Mobile Series: process qualifiers AND the cumulative _series leaderboard (for heats seeding)
        if (category === 'series') {
          if (!winId.includes('qualifier') && !winId.includes('open') && !winId.endsWith('_series') && !winId.endsWith('_cumulative')) {
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
            ((lbEventWindowId.toLowerCase().includes('_series') || lbEventWindowId.toLowerCase().includes('_cumulative')) && category !== 'series')
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

          const regionLabel = REGION_LABEL_MAP[region] || region;
          const winIdParts = lbEventWindowId.match(/(?:Qualifier|Round|Final|Week|Event)\d*/i);
          const windowLabel = winIdParts ? winIdParts[0] : '';

          // Process Heat Seeding from the cumulative series leaderboard
          if (category === 'series' && (lbEventWindowId.toLowerCase().endsWith('_series') || lbEventWindowId.toLowerCase().endsWith('_cumulative'))) {
            if (!heatsSeeding[regionLabel]) heatsSeeding[regionLabel] = { 1: [], 2: [], 3: [], 4: [] };
            
            // Only parse if empty (to avoid overwriting if multiple series boards exist)
            if (heatsSeeding[regionLabel][1].length === 0) {
              const sortedEntries = [...lbData.leaderboard.entries].sort((a: any, b: any) => a.rank - b.rank);
              for (const entry of sortedEntries) {
                if (entry.rank > 64) break; // Top 64 only
                
                const username = (entry.players || [])[0]?.username;
                if (!username) continue;
                
                const cc = resolveCountryCode((entry.players || [])[0]?.flagToken);
                const offset = (entry.rank - 1) % 8;
                let heat = 0;
                if (offset === 0 || offset === 7) heat = 1;
                else if (offset === 1 || offset === 6) heat = 2;
                else if (offset === 2 || offset === 5) heat = 3;
                else if (offset === 3 || offset === 4) heat = 4;
                
                heatsSeeding[regionLabel][heat].push({
                  player: username,
                  countryCode: cc,
                  rank: entry.rank,
                  points: entry.pointsEarned || entry.points || 0
                });
              }
            }
            continue; // Skip calculating earnings for cumulative leaderboards
          }

          // Process Qualifier Eligibility from Top 4 of each Heat
          if (category === 'heats') {
            if (!qualifierEligible[regionLabel]) qualifierEligible[regionLabel] = [];
            
            const sortedEntries = [...lbData.leaderboard.entries].sort((a: any, b: any) => a.rank - b.rank);
            const eventTitle = tourney.displayData?.titleLine1 || 'Unknown Event';
            const heatMatch = eventTitle.match(/Heat\s*(\d)/i) || lbEventWindowId.match(/Heat_?(\d)/i);
            const heatName = heatMatch ? `Heat ${heatMatch[1]}` : 'Heat';

            for (const entry of sortedEntries) {
              if (entry.rank > 4) break; // Only top 4 advance to qualifier
              
              const username = (entry.players || [])[0]?.username;
              if (!username) continue;
              
              // Only add if not already present
              if (!qualifierEligible[regionLabel].some(q => q.player === username)) {
                const cc = resolveCountryCode((entry.players || [])[0]?.flagToken);
                qualifierEligible[regionLabel].push({
                  player: username,
                  countryCode: cc,
                  fromHeat: heatName
                });
              }
            }
            // Do NOT continue here; heats DO give earnings!
          }

          const eventTitle = tourney.displayData?.titleLine1 || 'Unknown Event';
          const eventDate = lbData.leaderboard.updatedAt || new Date().toISOString();
          // Build a human-readable event name from the window ID
          const fullEventName = windowLabel 
            ? `${eventTitle} — ${windowLabel} (${REGION_LABEL_MAP[region] || region})`
            : `${eventTitle} (${REGION_LABEL_MAP[region] || region})`;

          // Detect Opens Round 1/2 windows — these have NO prize money
          const isOpensRound = lbEventWindowId.toLowerCase().includes('_round') && 
            (lbEventWindowId.toLowerCase().includes('open') || 
             tourney.eventId?.toLowerCase().includes('open'));
          const opensRoundMatch = lbEventWindowId.match(/Round(\d+)/i);
          const isOpensRound1or2 = isOpensRound && opensRoundMatch && 
            (parseInt(opensRoundMatch[1], 10) === 1 || parseInt(opensRoundMatch[1], 10) === 2);

          // Track Opens Round 1+2 points for heats seeding (current season only)
          const isCurrentSeason = tourney.eventId?.match(new RegExp(`S${maxSeason}_`, 'i'));
          if (isOpensRound1or2 && isCurrentSeason && category === 'series') {
            const regionLabel2 = REGION_LABEL_MAP[region] || region;
            if (!opensRoundPoints[regionLabel2]) opensRoundPoints[regionLabel2] = {};
            
            for (const entry of lbData.leaderboard.entries) {
              for (const player of (entry.players || [])) {
                const username = player.username;
                if (!username) continue;
                const acctId = player.accountId || username.toLowerCase();
                const pts = entry.pointsEarned || entry.points || 0;
                const cc = resolveCountryCode(player.flagToken);
                
                if (!opensRoundPoints[regionLabel2][acctId]) {
                  opensRoundPoints[regionLabel2][acctId] = { name: username, countryCode: cc, points: 0 };
                }
                opensRoundPoints[regionLabel2][acctId].points += pts;
                opensRoundPoints[regionLabel2][acctId].name = username; // use latest display name
                opensRoundPoints[regionLabel2][acctId].countryCode = cc;
              }
            }
          }

          // For Opens rounds, skip earnings calculation entirely (no prize pool)
          const prizeMoney = isOpensRound ? 0 : calculatePrize(0, region, category as EventCategory);

          lbData.leaderboard.entries.forEach((entry: any) => {
            let entryPrize = 0;
            if (category === 'victorycup') {
              const isRound2 = lbEventWindowId.toLowerCase().includes('round2') || windowLabel?.toLowerCase().includes('round 2') || lbEventWindowId.toLowerCase().includes('final');
              if (isRound2) {
                const isMiniVenture = eventTitle.toLowerCase().includes('mini venture');
                const pricePerWin = isMiniVenture ? 50 : 100;
                let wins = 0;
                if (entry.sessionHistory) {
                  entry.sessionHistory.forEach((session: any) => {
                    if (session.trackedStats && session.trackedStats.VICTORY_ROYALE_STAT) {
                      wins += session.trackedStats.VICTORY_ROYALE_STAT;
                    }
                  });
                }
                entryPrize = wins * pricePerWin;
              }
            } else {
              // Opens rounds have no prize pool — skip earnings
              entryPrize = isOpensRound ? 0 : calculatePrize(entry.rank, region, category as EventCategory);
            }
            
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

              // Only count prized series earnings towards the base total
              if (category === 'series' && !isOpensRound) {
                playerMap[key].earningsUSD += entryPrize;
              }

              if (!playerRegionEarnings[key]) playerRegionEarnings[key] = {};
              if (category === 'series' && !isOpensRound) {
                playerRegionEarnings[key][region] = (playerRegionEarnings[key][region] || 0) + entryPrize;
              }

              if (category === 'series' && isCurrentSeason && !isOpensRound && windowLabel.toLowerCase().includes('qualifier')) {
                 if (!playerSeriesPoints[key]) playerSeriesPoints[key] = {};
                 const pts = entry.pointsEarned || entry.points || 0;
                 playerSeriesPoints[key][regionLabel] = (playerSeriesPoints[key][regionLabel] || 0) + pts;
              }

              // Track individual event results with category (skip $0 Opens rounds)
              if (!playerEvents[key]) playerEvents[key] = [];
              if (!isOpensRound) {
                playerEvents[key].push({
                  event: fullEventName,
                  region: REGION_LABEL_MAP[region] || region,
                  placement: entry.rank,
                  earnings: entryPrize,
                  date: eventDate,
                  category: category as string,
                });
              }
              
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
          if (category === 'series' && !isOpensRound && windowLabel.toLowerCase().includes('qualifier') && lbData.leaderboard.entries && lbData.leaderboard.entries.length > 0) {
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

  // ─── Load official heats seeding from override file ──────────
  // The official Epic heats account for banned players being replaced,
  // which can't be derived from API data alone. Use the override file
  // if it exists; otherwise fall back to computed Round 1+2 seeding.
  const HEATS_OVERRIDE_FILE = path.join(process.cwd(), 'public', 'heats_override.json');
  const HEATS_REGIONS = ['EUROPE', 'NA-CENTRAL', 'NA-WEST', 'MIDDLE EAST', 'OCEANIA', 'ASIA', 'BRAZIL'];

  if (fs.existsSync(HEATS_OVERRIDE_FILE)) {
    try {
      const overrideData = JSON.parse(fs.readFileSync(HEATS_OVERRIDE_FILE, 'utf-8'));
      for (const region of HEATS_REGIONS) {
        const regionOverride = overrideData[region];
        if (!regionOverride) continue;

        heatsSeeding[region] = { 1: [], 2: [], 3: [], 4: [] };
        for (const heatNum of ['1', '2', '3', '4']) {
          const players = regionOverride[heatNum] || [];
          heatsSeeding[region][parseInt(heatNum, 10)] = players.map((name: string, idx: number) => {
            // Try to find country code from playerMap
            const key = name.toLowerCase();
            const cc = playerMap[key]?.countryCode || 'un';
            return {
              player: name,
              countryCode: cc,
              rank: idx + 1,
              points: 0, // Official seeding doesn't need points
            };
          });
        }
        console.log(`[HEATS] Loaded official heats for ${region} from override file (${heatsSeeding[region][1].length + heatsSeeding[region][2].length + heatsSeeding[region][3].length + heatsSeeding[region][4].length} players)`);
      }
    } catch (err) {
      console.error('[HEATS] Failed to load heats_override.json:', err);
    }
  }

  // Fallback: Compute from Opens Round 1+2 for any regions not in the override
  for (const region of HEATS_REGIONS) {
    if (heatsSeeding[region] && heatsSeeding[region][1]?.length > 0) {
      continue; // Already loaded from override or _series/_cumulative board
    }

    const regionOpens = opensRoundPoints[region] || {};
    const regionPlayers = Object.values(regionOpens)
      .filter(p => p.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 64);

    if (regionPlayers.length === 0) {
      console.log(`[HEATS] No heats data for ${region} (no override and no Opens Round 1+2 data)`);
      continue;
    }

    heatsSeeding[region] = { 1: [], 2: [], 3: [], 4: [] };
    for (let i = 0; i < regionPlayers.length; i++) {
      const p = regionPlayers[i];
      const offset = i % 8;
      let heat = 0;
      if (offset === 0 || offset === 7) heat = 1;
      else if (offset === 1 || offset === 6) heat = 2;
      else if (offset === 2 || offset === 5) heat = 3;
      else if (offset === 3 || offset === 4) heat = 4;

      heatsSeeding[region][heat].push({
        player: p.name,
        countryCode: p.countryCode || 'un',
        rank: i + 1,
        points: p.points,
      });
    }
    console.log(`[HEATS] Computed fallback heats for ${region}: ${regionPlayers.length} players from Opens Round 1+2`);
  }

  const payload = {
    players: aggregatedPlayers,
    qualifications,
    heatsSeeding,
    qualifierEligible,
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
