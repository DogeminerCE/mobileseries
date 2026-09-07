import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GROUP_SESSIONS, routedSpots, destinationSession, type RoutableSpot } from '../src/groupStage';

const base = 'https://firestore.googleapis.com/v1/projects/mobileseriesxyz/databases/(default)/documents';
const documents: any[] = [];
let pageToken = '';
do {
  const response = await fetch(`${base}/dropSpots?pageSize=300&pageToken=${encodeURIComponent(pageToken)}`);
  if (!response.ok) throw new Error(`Read failed: ${response.status}`);
  const page = await response.json();
  documents.push(...page.documents || []);
  pageToken = page.nextPageToken || '';
} while (pageToken);
const spots = documents.map(d => ({
  id: d.name.split('/').pop(),
  playerName: d.fields.playerName?.stringValue || '',
  epicAccountId: d.fields.epicAccountId?.stringValue || '',
  region: d.fields.region?.stringValue || '',
  mapSession: d.fields.mapSession?.stringValue || '',
  createdAt: {seconds: Date.parse(d.fields.createdAt?.timestampValue || '') / 1000 || 0},
})) satisfies RoutableSpot[];
const winners = [...new Set(spots.map(s => s.region))].flatMap(region => GROUP_SESSIONS.flatMap(session => routedSpots(spots.filter(s => s.region === region), session.key)));
const moves = winners.filter(s => destinationSession(s) !== s.mapSession);
console.log(JSON.stringify({ totalDocuments: documents.length, visibleDrops: winners.length, moves: moves.map(s => ({id: s.id, player: s.playerName, region: s.region, from: s.mapSession, to: destinationSession(s)})) }, null, 2));
if (process.argv.includes('--apply')) {
  // firebase-tools refreshes this token during `firebase projects:list`.
  let token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!token) {
    const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
    token = config.tokens?.access_token;
  }
  if (!token) throw new Error('Run firebase login and firebase projects:list, or provide GOOGLE_OAUTH_ACCESS_TOKEN.');
  const backup = path.join(os.tmpdir(), `mobile-drops-backup-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(documents, null, 2), {mode: 0o600});
  console.log(`Backup: ${backup}`);
  for (const spot of moves) {
    const original = documents.find(d => d.name.endsWith(`/${spot.id}`));
    const response = await fetch(`${base}/dropSpots?documentId=${encodeURIComponent('group-' + spot.id)}`, {
      method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({fields: {...original.fields, mapSession: {stringValue: destinationSession(spot)}}}),
    });
    if (!response.ok) throw new Error(`Migration stopped at ${spot.id}: HTTP ${response.status}; no later documents changed.`);
  }
  console.log(`Copied ${moves.length} drops to their group maps. Original maps, geometry, ownership and timestamps preserved.`);
}
