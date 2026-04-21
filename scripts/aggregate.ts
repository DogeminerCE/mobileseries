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

const DEFAULT_PRIZE_TABLE = [
  { rank: 1, prize: 100 },
  { rank: 16, prize: 100 },
];

function calculatePrize(rank: number, region: string): number {
  // FIX: Use bracket-based lookup (rank <= t.rank) instead of exact match.
  // Exact match causes ranks 5-7, 9-11 etc. to return $0 since they aren't
  // explicitly listed in the prize table.
  const table = PRIZE_TABLES[region] || DEFAULT_PRIZE_TABLE;
  const match = [...table].sort((a, b) => a.rank - b.rank).find(t => rank <= t.rank);
  return match ? match.prize : 0;
}

async function aggregateMobileEarnings() {
  console.log("Starting verified global series aggregation (Sept 2023 - Present)...");
  const regions = ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'];
  const playerMap: Record<string, any> = {};
  const playerRegionEarnings: Record<string, Record<string, number>> = {};
  const processedTourneys = new Set<string>();

  for (const region of regions) {
    console.log(`[REGION] Processing: ${region}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const tourneyUrl = `${OSIRION_API}/tournaments?includeHistoricData=true&region=${region}`;
    const tourneyResp = await fetch(tourneyUrl);
    const tourneyData = await tourneyResp.json();
    
    if (!tourneyData.success) {
      console.error(`[ERROR] API rejected tournament list for region ${region}`);
      continue;
    }

    const mobileTourneys = tourneyData.tournaments.filter((t: any) => {
      if (processedTourneys.has(region + '_' + t.eventId)) return false;
      const title1 = t.displayData?.titleLine1?.toLowerCase() || '';
      const eventId = t.eventId?.toLowerCase() || '';
      
      // Whitelist only official Mobile Series events.
      // Note: Do NOT exclude by 'blitz' in eventId — Dec qualifiers carry
      // eventId "S39_BlitzMobileCup_DecQualifier1_*" but are still titled
      // "Mobile Series" and award full Mobile Series prize money.
      return (title1.includes('mobile series') || eventId.includes('mobileseries'));
    });

    console.log(`[DATA] Found ${mobileTourneys.length} unique Mobile tournaments in ${region}.`);
    const processedLeaderboards = new Set<string>();

    for (const tourney of mobileTourneys) {
      processedTourneys.add(region + '_' + tourney.eventId);
      const windows = tourney.eventWindows || [];
      
      for (const window of windows) {
        const winId = window.eventWindowId?.toLowerCase() || '';
        
        if (!winId.includes('qualifier') || winId.endsWith('_series')) {
          continue;
        }

        let processedValidLeaderboard = false;
        for (const loc of (window.scoreLocations || [])) {
          if (processedValidLeaderboard) break;
          
          const lbEventWindowId = loc.leaderboardEventWindowId;
          const normalizedId = lbEventWindowId.replace(/_mg$|_2$|_alt$|_alt\d+$/i, '');
          
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
          console.log(`[CRAWL] ${lbUrl}`);
          const lbResp = await fetch(lbUrl);
          const lbData = await lbResp.json();
          
          if (!lbData.success || !lbData.leaderboard.entries) continue;

          lbData.leaderboard.entries.forEach((entry: any) => {
            const prizeMoney = calculatePrize(entry.rank, region);
            
            (entry.players || []).forEach((player: any) => {
              const username = player.username;
              if (!username) return;

              if (!playerMap[username]) {
                playerMap[username] = {
                  name: username,
                  earningsUSD: 0,
                  countryCode: resolveCountryCode(player.flagToken),
                  lastActiveTournament: tourney.displayData?.titleLine1,
                  lastActiveDate: lbData.leaderboard.updatedAt || new Date().toISOString(),
                };
              }

              playerMap[username].earningsUSD += prizeMoney;

              if (!playerRegionEarnings[username]) playerRegionEarnings[username] = {};
              playerRegionEarnings[username][region] = (playerRegionEarnings[username][region] || 0) + prizeMoney;
              
              const entryDate = new Date(lbData.leaderboard.updatedAt || 0).getTime();
              const existingDate = new Date(playerMap[username].lastActiveDate).getTime();
              if (entryDate > existingDate) {
                playerMap[username].lastActiveTournament = tourney.displayData?.titleLine1;
                playerMap[username].lastActiveDate = lbData.leaderboard.updatedAt;
                playerMap[username].countryCode = resolveCountryCode(player.flagToken);
              }
            });
          });
        }
      }
    }
  }

  const REGION_LABEL_MAP: Record<string, string> = {
    'EU': 'EUROPE', 'NAC': 'NA-CENTRAL', 'NAW': 'NA-WEST',
    'BR': 'BRAZIL', 'ASIA': 'ASIA', 'OCE': 'OCEANIA', 'ME': 'MIDDLE EAST'
  };

  const aggregatedPlayers = Object.values(playerMap)
    .filter((p: any) => p.earningsUSD > 0)
    .sort((a: any, b: any) => b.earningsUSD - a.earningsUSD)
    .map((p: any, idx: number) => {
      const regionMap = playerRegionEarnings[p.name] || {};
      const topRegionKey = Object.entries(regionMap).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'EU';
      return { ...p, rank: idx + 1, primaryRegion: REGION_LABEL_MAP[topRegionKey] || 'GLOBAL' };
    });

  const payload = {
    players: aggregatedPlayers,
    lastUpdated: new Date().toISOString(),
    source: 'github-actions'
  };

  // Ensure public directory exists
  const publicDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  console.log("!!! Aggregation complete and cache written to public/leaderboard.json !!!");
}

aggregateMobileEarnings().catch(err => {
    console.error("Scraper Failed:", err);
    process.exit(1);
});
