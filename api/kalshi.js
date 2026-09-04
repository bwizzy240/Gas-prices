// /api/kalshi.js
// Proxies Kalshi's public (no-auth) market data API server-side.
// Doing this server-side sidesteps browser CORS entirely — the browser
// only ever talks to your own domain, and Vercel talks to Kalshi.

export default async function handler(req, res) {
  try {
    const url = 'https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=KXAAAGASD&status=open';
    const response = await fetch(url);

    if (!response.ok) {
      res.status(response.status).json({ error: `Kalshi API returned ${response.status}` });
      return;
    }

    const data = await response.json();

    // Cache for 60s at the edge so repeated clicks don't hammer Kalshi
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error fetching Kalshi data' });
  }
}
