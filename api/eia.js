// /api/eia.js
// Pulls free EIA data as proxies for two research findings:
//  - RBOB *futures* aren't free (NYMEX/CME proprietary) — this uses EIA's
//    daily New York Harbor conventional gasoline SPOT price as the closest
//    free stand-in for "which way is wholesale gasoline moving."
//  - WTI crude spot price, to approximate the crack spread (gasoline - crude).
//  - Weekly refinery utilization, from EIA's Weekly Petroleum Status Report.
//
// HONEST CAVEAT: unlike the Kalshi/AAA functions, these exact series IDs
// could not be verified against a live EIA response before shipping — I
// don't have a way to test arbitrary API calls from where this was written.
// Visit /api/eia directly after deploying; if a section shows "error"
// instead of data, that series ID needs fixing (paste the error back and
// I'll correct it).
//
// Requires an EIA_API_KEY environment variable set in Vercel — NOT hardcoded
// here, so it never ends up in your public GitHub repo.

const EIA_BASE = 'https://api.eia.gov/v2/seriesid';

const SERIES = {
  gasolineSpot: 'PET.EER_EPMRU_PF4_Y35NY_DPG.D', // NY Harbor conventional gasoline, regular, daily ($/gal)
  wtiSpot: 'PET.RWTC.D',                          // WTI Cushing spot price, daily ($/bbl)
  refineryUtilization: 'PET.WPULEUS3.W'           // Weekly % utilization of refinery operable capacity
};

async function fetchSeries(seriesId, apiKey, length) {
  const url = `${EIA_BASE}/${seriesId}?api_key=${apiKey}&length=${length}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.error) {
      return { seriesId, error: json.error || `HTTP ${res.status}` };
    }
    const rows = (json.response && json.response.data) || [];
    // Defensive: sort newest-first ourselves rather than trust the API's
    // default ordering, since that wasn't something I could confirm live.
    rows.sort((a, b) => (a.period < b.period ? 1 : -1));
    return { seriesId, rows };
  } catch (err) {
    return { seriesId, error: err.message || 'fetch failed' };
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'EIA_API_KEY environment variable is not set in Vercel yet.' });
    return;
  }

  try {
    const [gasoline, wti, utilization] = await Promise.all([
      fetchSeries(SERIES.gasolineSpot, apiKey, 10),
      fetchSeries(SERIES.wtiSpot, apiKey, 10),
      fetchSeries(SERIES.refineryUtilization, apiKey, 8)
    ]);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json({ gasoline, wti, utilization });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error fetching EIA data' });
  }
}
