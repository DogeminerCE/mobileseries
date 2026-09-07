import { currentPlayerName } from './playerNames.js';
export { currentPlayerName } from './playerNames.js';
import snapshot from './data/group-stage.json' with { type: 'json' };

export interface GroupPlayer { player: string; accountId?: string; rank?: number }
export interface GroupRegion { groups: Record<string, GroupPlayer[]>; lcq: GroupPlayer[]; lcqWindow?: string; lcqEndTime?: string }
export interface GroupRoster { regions: Record<string, GroupRegion> }
export const groupRoster: GroupRoster = snapshot;
export const GROUP_SESSIONS = [
  { key: 'Group Stage 1', label: 'Group 1' },
  { key: 'Group Stage 2', label: 'Group 2' },
  { key: 'Group Stage LCQ', label: 'LCQ · Awaiting group' },
];

// Keep punctuation and non-Latin letters. Only normalize presentation whitespace
// and the two mojibake sequences present in Epic's published seeding page.
export function normalizePlayerName(name: string) {
  return currentPlayerName(name || '').replaceAll('ÎµÃ¯Ð·', 'εïз').replaceAll('Çƒ', 'ǃ')
    .normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/gu, ' ').trim().toLowerCase();
}
export const ADMIN_NAMES = ['babylion122', 'blitzʼd babylion', "blitz'd babylion"].map(normalizePlayerName);
export function isAdminUser(name?: string | null, email?: string | null): boolean {
  if (name && ADMIN_NAMES.includes(normalizePlayerName(name))) return true;
  if (email && email.toLowerCase() === 'babylionbiz@gmail.com') return true;
  return false;
}

export function matchesPlayer(player: GroupPlayer, name: string, accountId?: string) {
  if (player.accountId && accountId) {
    if (player.accountId === accountId) return true;
    if (isAdminUser(name)) return true;
    return false;
  }
  const normalized = normalizePlayerName(name);
  return normalized.length > 0 && normalizePlayerName(player.player) === normalized;
}
export function playerSessions(region: string, name: string, accountId?: string, roster: GroupRoster = groupRoster): string[] {
  const data = roster.regions[region];
  if (!data) return [];
  const groups = ['1', '2'].filter(group => data.groups[group]?.some(p => matchesPlayer(p, name, accountId)));
  if (groups.length) return groups.map(group => `Group Stage ${group}`);
  return data.lcq.some(p => matchesPlayer(p, name, accountId)) ? ['Group Stage LCQ'] : [];
}
export function sessionPlayers(region: string, session: string, roster: GroupRoster = groupRoster): GroupPlayer[] {
  const data = roster.regions[region];
  if (!data) return [];
  const players = session === 'Group Stage LCQ'
    ? data.lcq.filter(p => playerSessions(region, p.player, p.accountId, roster).includes(session))
    : data.groups[session.replace('Group Stage ', '')] || [];
  return players.filter((p, i) => players.findIndex(other => normalizePlayerName(other.player) === normalizePlayerName(p.player)) === i)
    .map(p => ({ ...p, player: currentPlayerName(p.player).replaceAll('ÎµÃ¯Ð·', 'εïз').replaceAll('Çƒ', 'ǃ') }));
}
export function mapClaims(name: string, accountId: string) {
  if (isAdminUser(name)) {
    return Object.keys(groupRoster.regions).flatMap(region =>
      GROUP_SESSIONS.map(session => `${region}|${session.key}`)
    );
  }
  return Object.keys(groupRoster.regions).flatMap(region => playerSessions(region, name, accountId).map(session => `${region}|${session}`));
}

export interface RoutableSpot { id?: string; playerName: string; epicAccountId: string; region: string; mapSession: string; adminPlaced?: boolean; createdAt?: { seconds?: number } }
export function destinationSession(spot: RoutableSpot, roster: GroupRoster = groupRoster): string | null {
  let sessions = playerSessions(spot.region, spot.playerName, spot.epicAccountId, roster);
  if (sessions.length === 0 && spot.adminPlaced) {
    sessions = playerSessions(spot.region, spot.playerName, undefined, roster);
  }
  if (sessions.includes(spot.mapSession)) return spot.mapSession;
  // Do not guess when the official page lists the same name in both groups.
  return sessions.length === 1 ? sessions[0] : null;
}
export function routedSpots<T extends RoutableSpot>(spots: T[], session: string, roster: GroupRoster = groupRoster): T[] {
  const candidates = spots.filter(spot => destinationSession(spot, roster) === session);
  candidates.sort((a, b) => Number(b.mapSession === session) - Number(a.mapSession === session)
    || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    || (a.id || '').localeCompare(b.id || ''));
  const seen = new Set<string>();
  return candidates.filter(spot => {
    const player = sessionPlayers(spot.region, session, roster).find(p => matchesPlayer(p, spot.playerName, spot.adminPlaced ? undefined : spot.epicAccountId));
    const key = normalizePlayerName(player?.player || spot.playerName);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

