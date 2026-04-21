const url = "https://fnapi.osirion.gg/v1/tournaments?includeHistoricData=true&region=EU";
fetch(url).then(r=>r.json()).then(d=>{ 
    const t = d.tournaments.find(x=>x.eventId.includes("MobileSeries")); 
    const w=t.eventWindows.find(x=>x.scoreLocations && x.scoreLocations[0].payoutTables); 
    console.log(JSON.stringify(w.scoreLocations[0].payoutTables, null, 2)); 
});
