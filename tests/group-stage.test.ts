import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupRoster, normalizePlayerName, playerSessions, sessionPlayers, routedSpots, destinationSession, mapClaims, type GroupRoster } from '../src/groupStage';
import { remainingTime, SERIES_END } from '../src/SeriesCountdown';

const roster: GroupRoster = { regions: { EU: { groups: { '1': [{player: 'Seeded'}], '2': [{player: 'Other'}] }, lcq: [{player: 'LCQ', accountId: 'lcq-id', rank: 12}] } } };
const spot = (name: string, session = 'Group Stage', id = name) => ({ id, playerName: name, epicAccountId: name, region: 'EU', mapSession: session, createdAt: {seconds: 1} });
test('all seven regions have official groups and exactly ranks 1–12 from LCQ round 2', () => {
  assert.equal(Object.keys(groupRoster.regions).length, 7);
  for (const region of Object.values(groupRoster.regions)) {
    assert.ok(region.groups['1'].length >= 10);
    assert.ok(region.groups['2'].length >= 10);
    assert.deepEqual(region.lcq.map(p => p.rank), Array.from({length: 12}, (_, i) => i + 1));
    assert.equal(new Set(region.lcq.map(p => p.accountId)).size, 12);
    assert.match(region.lcqWindow!, /LCQ_Round2_/);
  }
});
test('identity retains non-Latin names, punctuation and distinct characters', () => {
  assert.notEqual(normalizePlayerName('軍神 心湊 一希'), normalizePlayerName('不组队就赢不了的猴子们'));
  assert.notEqual(normalizePlayerName('mtrx riseѕ'), normalizePlayerName('mtrx rises'));
  assert.notEqual(normalizePlayerName('name.'), normalizePlayerName('name'));
  assert.equal(normalizePlayerName(' gents\u00a0 あくりあハンバーガー '), normalizePlayerName('gents あくりあハンバーガー'));
  assert.equal(normalizePlayerName('MalinaCR7 ÎµÃ¯Ð·'), normalizePlayerName('MalinaCR7 εïз'));
});
test('seeded players can only mark their own regional group', () => {
  assert.deepEqual(playerSessions('EU', 'Seeded', 'id', roster), ['Group Stage 1']);
  assert.deepEqual(playerSessions('ASIA', 'Seeded', 'id', roster), []);
  assert.deepEqual(playerSessions('EU', 'Incorrect inferred qualifier', 'id', roster), []);
});
test('LCQ matches account ID even after a name change and rejects same-name impostors', () => {
  assert.deepEqual(playerSessions('EU', 'Changed', 'lcq-id', roster), ['Group Stage LCQ']);
  assert.deepEqual(playerSessions('EU', 'LCQ', 'impostor', roster), []);
});
test('new seeding moves an LCQ drop to its group without changing its geometry', () => {
  const updated = structuredClone(roster);
  updated.regions.EU.groups['2'].push({player: 'LCQ', accountId: 'lcq-id'});
  const drop = {...spot('LCQ', 'Group Stage LCQ'), epicAccountId: 'lcq-id', path: [{x: 1, y: 2}]};
  assert.deepEqual(routedSpots([drop], 'Group Stage LCQ', updated), []);
  assert.deepEqual(routedSpots([drop], 'Group Stage 2', updated), [drop]);
  assert.deepEqual(sessionPlayers('EU', 'Group Stage LCQ', updated), []);
});
test('migrate qualified historical marks and exclude incorrect group-stage players', () => {
  assert.equal(destinationSession(spot('Seeded', 'August Heat 1'), roster), 'Group Stage 1');
  assert.equal(destinationSession(spot('Unqualified'), roster), null);
});
test('existing destination mark wins over newer legacy marks; otherwise use newest', () => {
  const old = {...spot('Seeded', 'Group Stage', 'old'), createdAt: {seconds: 20}};
  const canonical = spot('Seeded', 'Group Stage 1', 'canonical');
  assert.deepEqual(routedSpots([old, canonical], 'Group Stage 1', roster), [canonical]);
  const newer = {...old, id: 'new', createdAt: {seconds: 30}};
  assert.deepEqual(routedSpots([old, newer], 'Group Stage 1', roster), [newer]);
});
test('ambiguous official assignments never silently relocate legacy marks', () => {
  const ambiguous = structuredClone(roster);
  ambiguous.regions.EU.groups['2'].push({player: 'Seeded'});
  assert.equal(destinationSession(spot('Seeded'), ambiguous), null);
  assert.equal(destinationSession(spot('Seeded', 'Group Stage 2'), ambiguous), 'Group Stage 2');
});
test('signed authorization claims only include verified maps', () => {
  assert.deepEqual(mapClaims('Not qualified', 'unknown'), []);
  assert.ok(mapClaims('Ololo Zinedine', 'id').includes('EUROPE|Group Stage 1'));
  assert.ok(!mapClaims('Ololo Zinedine', 'id').includes('EUROPE|Group Stage 2'));
});
test('countdown includes October 25 and stops cleanly', () => {
  assert.deepEqual(remainingTime(SERIES_END - 90061000), {days: 1, hours: 1, minutes: 1, seconds: 1});
  assert.equal(remainingTime(Date.parse('2026-10-25T00:00:00Z')).days, 1);
  assert.deepEqual(remainingTime(SERIES_END + 1000), {days: 0, hours: 0, minutes: 0, seconds: 0});
});

test('historical names for the same LCQ account produce only one marker', () => {
  const first = {...spot('Old name', 'Group Stage LCQ', 'a'), epicAccountId: 'lcq-id'};
  const second = {...spot('LCQ', 'Group Stage LCQ', 'b'), epicAccountId: 'lcq-id', createdAt: {seconds: 10}};
  assert.deepEqual(routedSpots([first, second], 'Group Stage LCQ', roster), [second]);
});

test('confirmed dogeee rename preserves groups and historical drops without matching similar Chinese names', () => {
  const renamed = '不组队就赢了不的猴子们';
  const old = 'mtrx dogeee';
  assert.equal(normalizePlayerName(old), normalizePlayerName(renamed));
  assert.notEqual(normalizePlayerName(renamed), normalizePlayerName('不组队就赢不了的猴子们'));
  assert.notEqual(normalizePlayerName(renamed), normalizePlayerName('不组队就赢不了的猴子'));
  for (const region of Object.keys(groupRoster.regions)) {
    assert.deepEqual(playerSessions(region, renamed), playerSessions(region, old));
  }
  assert.ok(mapClaims(renamed, 'id').includes('EUROPE|Group Stage 1'));
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 1').some(p => p.player === old), false);
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 1').some(p => p.player === renamed), true);
  const historical = {...spot(old), region: 'EUROPE'};
  assert.equal(destinationSession(historical), 'Group Stage 1');
});

test('confirmed renames for amp, vediana, and mohanad preserve groups and drops', () => {
  // amp x misty -> hylnd amp
  assert.equal(normalizePlayerName('amp x misty'), normalizePlayerName('hylnd amp'));
  for (const region of Object.keys(groupRoster.regions)) {
    assert.deepEqual(playerSessions(region, 'hylnd amp'), playerSessions(region, 'amp x misty'));
  }
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 2').some(p => p.player === 'amp x misty'), false);
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 2').some(p => p.player === 'hylnd amp'), true);

  // vediana 19! -> HYLND SC VEDIANA
  assert.equal(normalizePlayerName('vediana 19!'), normalizePlayerName('HYLND SC VEDIANA'));
  assert.equal(normalizePlayerName('vediana 19ǃ'), normalizePlayerName('HYLND SC VEDIANA'));
  for (const region of Object.keys(groupRoster.regions)) {
    assert.deepEqual(playerSessions(region, 'HYLND SC VEDIANA'), playerSessions(region, 'vediana 19!'));
    assert.deepEqual(playerSessions(region, 'HYLND SC VEDIANA'), playerSessions(region, 'vediana 19ǃ'));
  }
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 2').some(p => p.player.includes('vediana 19')), false);
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 2').some(p => p.player === 'HYLND SC VEDIANA'), true);

  // Law Mohanad -> spk mohanad
  assert.equal(normalizePlayerName('Law Mohanad'), normalizePlayerName('spk mohanad'));
  assert.equal(normalizePlayerName('SPK Mohanad'), normalizePlayerName('spk mohanad'));
  for (const region of Object.keys(groupRoster.regions)) {
    assert.deepEqual(playerSessions(region, 'spk mohanad'), playerSessions(region, 'Law Mohanad'));
  }
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 1').some(p => p.player === 'Law Mohanad'), false);
  assert.equal(sessionPlayers('EUROPE', 'Group Stage 1').some(p => p.player === 'spk mohanad'), true);

  // MTB Keyxity / MTB Keyxity. -> 不组队就不了的猴子们
  const keyxityRenamed = '不组队就不了的猴子们';
  assert.equal(normalizePlayerName('MTB Keyxity'), normalizePlayerName(keyxityRenamed));
  assert.equal(normalizePlayerName('MTB Keyxity.'), normalizePlayerName(keyxityRenamed));
  assert.notEqual(normalizePlayerName(keyxityRenamed), normalizePlayerName('不组队就赢了不的猴子们'));
  assert.notEqual(normalizePlayerName(keyxityRenamed), normalizePlayerName('不组队就赢不了的猴子们'));
  for (const region of Object.keys(groupRoster.regions)) {
    assert.deepEqual(playerSessions(region, keyxityRenamed), playerSessions(region, 'MTB Keyxity.'));
    assert.deepEqual(playerSessions(region, keyxityRenamed), playerSessions(region, 'MTB Keyxity'));
  }
  assert.equal(sessionPlayers('BRAZIL', 'Group Stage 1').some(p => p.player.includes('Keyxity')), false);
  assert.equal(sessionPlayers('BRAZIL', 'Group Stage 1').some(p => p.player === keyxityRenamed), true);
});
