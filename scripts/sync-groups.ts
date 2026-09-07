import { currentPlayerName } from '../src/playerNames.js';
import fs from 'node:fs';
import { load } from 'cheerio';
import type { GroupRoster } from '../src/groupStage';

const file = 'src/data/group-stage.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const regions: Record<string, string> = { EU: 'EUROPE', NAC: 'NA-CENTRAL', NAW: 'NA-WEST', ME: 'MIDDLE EAST', OCE: 'OCEANIA', ASIA: 'ASIA', BR: 'BRAZIL' };
async function get(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
// Keep the checked-in official snapshot if Epic blocks automated requests.
try {
  const $ = load(await (await get(data.source)).text());
  const groups: Record<string, Record<string, {player: string}[]>> = {};
  $('h2').each((_, heading) => {
    const match = $(heading).text().trim().match(/^(ASIA|BR|EU|ME|NAC|NAW|OCE)\s*-\s*Group\s*([12])$/);
    if (!match) return;
    const players = $(heading).nextUntil('h2').find('li').map((_, li) => ({player: currentPlayerName($(li).text().trim())})).get();
    (groups[regions[match[1]]] ||= {})[match[2]] = players;
  });
  if (!Object.values(regions).every(region => ['1', '2'].every(group => (groups[region]?.[group]?.length || 0) >= 10))) throw new Error('Incomplete official roster');
  for (const region of Object.values(regions)) data.regions[region].groups = groups[region];
  data.updatedAt = new Date().toISOString();
} catch (error) { console.warn('Keeping verified Epic snapshot:', (error as Error).message); }

let failures = 0;
for (const [code, region] of Object.entries(regions)) {
  try {
    const root = 'https://fnapi.osirion.gg/v1';
    const tournaments = await (await get(`${root}/tournaments?includeHistoricData=true&region=${code}`)).json();
    const tournament = (Array.isArray(tournaments) ? tournaments : tournaments.tournaments || [])
      .find((t: any) => t.eventId === `epicgames_S42_MobileSeriesLCQ_${code}`);
    const window = tournament?.eventWindows?.find((w: any) => w.eventWindowId === `S42_MobileSeriesLCQ_Round2_${code}`);
    if (!window || !window.endTime || Date.parse(window.endTime) > Date.now()) throw new Error('LCQ final round has not completed');
    const loc = window.scoreLocations.find((l: any) => l.isMain) || window.scoreLocations[0];
    const response = await (await get(`${root}/tournaments/leaderboard?leaderboardEventId=${loc.leaderboardEventId}&leaderboardEventWindowId=${loc.leaderboardEventWindowId}`)).json();
    const entries = (response.leaderboard?.entries || []).filter((e: any) => e.rank >= 1 && e.rank <= 12).sort((a: any, b: any) => a.rank - b.rank);
    if (!response.success || entries.length !== 12 || new Set(entries.map((e: any) => e.rank)).size !== 12 || entries.some((e: any) => !e.players?.[0]?.accountId || !e.players[0].username)) throw new Error('Incomplete LCQ top 12');
    data.regions[region].lcq = entries.map((e: any) => ({ player: currentPlayerName(e.players[0].username), accountId: e.players[0].accountId, rank: e.rank }));
    data.regions[region].lcqWindow = window.eventWindowId;
    data.regions[region].lcqEndTime = window.endTime;
    console.log(`${region}: verified 12 LCQ qualifiers`);
  } catch (error) { failures++; console.error(`${region}: keeping previous LCQ data:`, (error as Error).message); }
}
const roster: GroupRoster = data;
fs.writeFileSync(file, JSON.stringify(roster, null, 2) + '\n');
if (failures) process.exitCode = 1;
