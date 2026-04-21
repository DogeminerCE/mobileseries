const test = async () => {
    const r = await fetch('https://fnapi.osirion.gg/v1/tournaments?includeHistoricData=true&region=EU');
    const d = await r.json();
    const t = d.tournaments.find(x => x.eventId.includes('MobileSeries'));
    const w = t.eventWindows.find(x => x.scoreLocations && x.scoreLocations[0].payoutTables);
    if (!w) return console.log('no win');
    console.log(JSON.stringify(w.scoreLocations[0].payoutTables, null, 2));
};
test();
