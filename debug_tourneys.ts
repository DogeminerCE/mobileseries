
import fetch from 'node-fetch';

async function debug() {
  const OSIRION_API = 'https://fnapi.osirion.gg/v1';
  
  try {
    console.log(`\n--- Inspecting Tournament Details for Payout Tables ---`);
    
    // Some APIs use query filters on the main endpoint to get details
    const eventId = 'epicgames_S39_MobileSeriesCupJanQual_EU';
    const url = `${OSIRION_API}/tournaments?includeHistoricData=true&eventId=${eventId}`;
    
    console.log(`Fetching: ${url}`);
    const resp = await fetch(url);
    const data: any = await resp.json();
    
    if (data.success && data.tournaments && data.tournaments.length > 0) {
      const t = data.tournaments[0];
      console.log(`\nTournament detail found: ${t.eventId}`);
      
      const windows = t.eventWindows || [];
      for (const w of windows) {
         if (w.eventWindowId.toLowerCase().includes('qualifier')) {
             console.log(`\nWindow: ${w.eventWindowId}`);
             console.log(`Keys in window object: ${Object.keys(w).join(', ')}`);
             if (w.payoutTables && w.payoutTables.length > 0) {
                console.log("PAYOUT TABLES DETECTED!");
                console.log(JSON.stringify(w.payoutTables, null, 2));
             } else {
                console.log("No payoutTables in window.");
             }
         }
      }
    } else {
      console.log("Failed to fetch tournament or tournament list empty.");
    }

  } catch (err) {
    console.error(err);
  }
}

debug();
