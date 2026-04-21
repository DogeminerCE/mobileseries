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
    { rank: 1, prize: 2500 }, { rank: 2, prize: 1500 }, { rank: 3, prize: 1000 },
    { rank: 4, prize: 800 }, ...Array.from({ length: 6 }, (_, i) => ({ rank: 5 + i, prize: 400 })),
    ...Array.from({ length: 5 }, (_, i) => ({ rank: 11 + i, prize: 250 }))
  ],
  'NAC': [
    { rank: 1, prize: 1500 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 400 }, ...Array.from({ length: 6 }, (_, i) => ({ rank: 5 + i, prize: 250 })),
    ...Array.from({ length: 5 }, (_, i) => ({ rank: 11 + i, prize: 200 }))
  ],
  'NAW': [
    { rank: 1, prize: 1500 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 400 }, ...Array.from({ length: 6 }, (_, i) => ({ rank: 5 + i, prize: 250 })),
    ...Array.from({ length: 5 }, (_, i) => ({ rank: 11 + i, prize: 200 }))
  ],
  'DEFAULT': [
    { rank: 1, prize: 1000 }, { rank: 2, prize: 800 }, { rank: 3, prize: 400 },
    ...Array.from({ length: 7 }, (_, i) => ({ rank: 4 + i, prize: 250 }))
  ]
};

function calculatePrize(rank: number, region: string): number {
  const table = PRIZE_TABLES[region] || PRIZE_TABLES['DEFAULT'];
  const entry = table.find(e => e.rank === rank);
  return entry ? entry.prize : 0;
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
      
      if (eventId.includes('blitz') || title1.includes('blitz')) return false;
      
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

            const prizeMoney = calculatePrize(entry.rank, region);
            playerMap[username].earningsUSD += prizeMoney;

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
