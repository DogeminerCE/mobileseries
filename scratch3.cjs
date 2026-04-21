const fs = require('fs');

const test = async () => {
    const r = await fetch('https://fnapi.osirion.gg/v1/tournaments?includeHistoricData=true&region=EU');
    const d = await r.json();
    const tList = d.tournaments.filter(x => x.eventId.includes('MobileSeries'));
    
    let output = "";
    tList.forEach(t => {
        t.eventWindows.forEach(w => {
            if (w.scoreLocations) {
                w.scoreLocations.forEach(loc => {
                    if (loc.payoutTables && loc.payoutTables.length > 0) {
                        const hasCash = JSON.stringify(loc.payoutTables).includes('money') || JSON.stringify(loc.payoutTables).includes('cash');
                        if (hasCash) {
                            output += `FOUND CASH in ${w.eventWindowId}:\n` + JSON.stringify(loc.payoutTables, null, 2) + "\n\n";
                        }
                    }
                });
            }
        });
    });
    fs.writeFileSync('eu_cash.txt', output);
    console.log('done', output.length);
};
test();
