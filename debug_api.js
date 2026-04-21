import fetch from 'node-fetch';

async function testFetch() {
  const urls = [
    'https://www.esportsearnings.com/games/500-fortnite/top-players',
    'https://fortnite-api.com/v2/news/br',
    'https://api.sporthub.com/v1/fortnite/leaderboards'
  ];

  for (const url of urls) {
    try {
      console.log(`\nTesting: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      console.log(`Status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const text = await response.text();
        console.log(`Length: ${text.length}`);
        console.log(`Preview: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      console.error(`Fetch Error: ${error.message}`);
    }
  }
}

testFetch();
