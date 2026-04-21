import fetch from 'node-fetch';

async function testFetch() {
  try {
    const url = 'https://events-public-service-live.ol.epicgames.com/api/v1/events/Fortnite/data';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Successfully fetched events data');
    // Log a bit of the first event to see structure
    if (data.events && data.events.length > 0) {
        console.log('First event:', data.events[0].eventId);
    }
  } catch (error) {
    console.error('Error fetching:', error);
  }
}

testFetch();
