import fs from 'fs';
const data = JSON.parse(fs.readFileSync('temp_lb.json', 'utf8'));

// Copy tables from aggregate.ts
const DEFAULT_PRIZE_TABLE = [{ rank: 1, prize: 100 }, { rank: 16, prize: 100 }];
const BLITZ_PRIZE_TABLES = {
  'NAC': [
    { rank: 1, prize: 1500 }, { rank: 2, prize: 1000 }, { rank: 3, prize: 800 },
    { rank: 4, prize: 600 }, { rank: 5, prize: 500 }, { rank: 6, prize: 450 },
    { rank: 7, prize: 400 }, { rank: 8, prize: 350 }, { rank: 9, prize: 325 },
    { rank: 10, prize: 300 }, { rank: 11, prize: 275 }, { rank: 12, prize: 250 },
    { rank: 13, prize: 225 }, { rank: 14, prize: 200 }, { rank: 15, prize: 175 },
    { rank: 16, prize: 150 },
  ]
};

function calculatePrize(rank: number, region: string, category: string) {
  const table = BLITZ_PRIZE_TABLES[region] || DEFAULT_PRIZE_TABLE;
  const tier = table.find(t => t.rank === rank);
  return tier ? tier.prize : 0;
}

data.leaderboard.entries.forEach(entry => {
   if (entry.rank <= 3) {
      console.log(`Rank: ${entry.rank}, Type: ${typeof entry.rank}, Prize: ${calculatePrize(entry.rank, 'NAC', 'blitz')}`);
   }
});
