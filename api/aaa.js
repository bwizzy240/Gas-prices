// /api/aaa.js
// AAA doesn't publish a public API, so this fetches their state-average page
// server-side and pulls "Today's AAA National Average $X.XXXX" out of the
// page text with a regex. Fragile in one specific sense: if AAA changes
// their page wording, this regex may need a small update — but the
// server-side fetch itself avoids the CORS problem a browser would hit.
//
// Also pulls two bellwether STATE prices the same way (California — an
// isolated CARB-spec market prone to large solo swings — and Texas, a
// Gulf Coast refining proxy for hurricane/outage risk), so the client can
// flag when a move looks like it's being driven by one region rather than
// a broad national trend. This is a deliberately small, illustrative set,
// not comprehensive state coverage.

const STATES = { US: 'US', CA: 'CA', TX: 'TX' };

async function fetchStatePrice(stateCode) {
  const response = await fetch(`https://gasprices.aaa.com/?state=${stateCode}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    return { error: `AAA site returned ${response.status}` };
  }

  const html = await response.text();
  // Same "Today's ... Average $X" pattern works for both the national page
  // and state pages, just with a different label prefix — match generically.
  const priceMatch = html.match(/Today.s\s+AAA\s+(?:National|[A-Za-z]+)\s+Average[^$]{0,40}\$?\s*([\d.]+)/i);
  const dateMatch = html.match(/Price as of\s*([\d/]+)/i);

  if (!priceMatch) {
    return { error: "Could not find the price on AAA's page — they may have changed its layout." };
  }

  return { price: parseFloat(priceMatch[1]), asOf: dateMatch ? dateMatch[1] : null };
}

export default async function handler(req, res) {
  try {
    const [us, ca, tx] = await Promise.all([
      fetchStatePrice(STATES.US),
      fetchStatePrice(STATES.CA),
      fetchStatePrice(STATES.TX)
    ]);

    if (us.error) {
      res.status(200).json({ error: us.error });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({
      price: us.price,
      asOf: us.asOf,
      states: { CA: ca, TX: tx }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error fetching AAA data' });
  }
}
