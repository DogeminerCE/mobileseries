import fetch from 'node-fetch';

async function testFetch() {
  const urls = [
    'https://events-public-service-live.ol.epicgames.com/api/v1/events/Fortnite/data/GLOBAL/ANDROID',
    'https://events-public-service-live.ol.epicgames.com/api/v1/events/Fortnite/data/EU/ANDROID',
    'https://events-public-service-live.ol.epicgames.com/api/v1/events/Fortnite/download/GLOBAL/ANDROID',
    'https://events-public-service-live.ol.epicgames.com/api/v1/events/Fortnite/data?region=EU&platform=ANDROID'
  ];

  for (const url of urls) {
    try {
      console.log(`\nTesting: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      console.log(`Status: ${response.status}`);
      if (response.ok) {
        console.log("SUCCESS!");
      }
    } catch (e) {
      console.log("Error: " + e.message);
    }
  }
}

testFetch();
