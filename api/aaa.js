// /api/aaa.js
// AAA doesn't publish a public API, so this fetches their state-average page
// server-side and pulls the "Today's AAA National Average $X.XXXX" figure
// out of the page text with a regex. Fragile in one specific sense: if AAA
// changes their page wording, this regex may need a small update — but the
// server-side fetch itself avoids the CORS problem a browser would hit.

export default async function handler(req, res) {
  try {
    const response = await fetch('https://gasprices.aaa.com/?state=US', {
      headers: {
        // A normal browser User-Agent — some sites block obvious bot requests.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `AAA site returned ${response.status}` });
      return;
    }

    const html = await response.text();

    // Match "Today's AAA National Average $4.1474" allowing for curly quotes
    // and any markup between the label and the dollar figure.
    const priceMatch = html.match(/Today.s\s+AAA\s+National\s+Average[^$]{0,40}\$?\s*([\d.]+)/i);
    const dateMatch = html.match(/Price as of\s*([\d/]+)/i);

    if (!priceMatch) {
      res.status(200).json({ error: 'Could not find the price on AAA\'s page — they may have changed its layout.' });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({
      price: parseFloat(priceMatch[1]),
      asOf: dateMatch ? dateMatch[1] : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error fetching AAA data' });
  }
}
