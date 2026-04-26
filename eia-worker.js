/* ═══════════════════════════════════════════════════════════════
   RoadCommand — EIA Diesel Price Worker
   Deploy at: Cloudflare Workers dashboard
   
   SETUP STEPS:
   1. Go to Cloudflare Dashboard → Workers & Pages → Create Worker
   2. Name it: eia-diesel-price
   3. Paste this entire file
   4. Click Deploy
   5. Go to Settings → Variables and Secrets → Add:
      - EIA_API_KEY = your EIA key from eia.gov/opendata
   6. Copy the worker URL (e.g. https://eia-diesel-price.YOUR.workers.dev)
   7. In app.js or auth.js, set: window._rcEIAWorker = 'YOUR_WORKER_URL'
   ═══════════════════════════════════════════════════════════════ */

const PADD = {
  'West Coast':     'EMD_EPD2D_PTE_R50_DPG',
  'Rocky Mountain': 'EMD_EPD2D_PTE_R40_DPG',
  'Midwest':        'EMD_EPD2D_PTE_R20_DPG',
  'Gulf Coast':     'EMD_EPD2D_PTE_R30_DPG',
  'East Coast':     'EMD_EPD2D_PTE_R10_DPG',
  'Unknown':        'EMD_EPD2D_PTE_NUS_DPG',
};

const FALLBACK = {
  'West Coast': 4.71, 'Rocky Mountain': 4.22, 'Midwest': 3.98,
  'Gulf Coast': 3.82, 'East Coast': 4.15, 'Unknown': 4.25,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const region = url.searchParams.get('region') || 'Unknown';
    const seriesId = PADD[region] || PADD['Unknown'];

    try {
      const eiaUrl = 'https://api.eia.gov/v2/petroleum/pri/gnd/data/?frequency=weekly&data[0]=value&facets[series][]=' + seriesId + '&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1&api_key=' + env.EIA_API_KEY;
      const res = await fetch(eiaUrl);
      const data = await res.json();
      const rows = data && data.response && data.response.data;

      if (rows && rows.length > 0) {
        const result = JSON.stringify({
          price: parseFloat(rows[0].value),
          period: rows[0].period,
          region: region,
          source: 'EIA Live'
        });
        return new Response(result, { headers: CORS });
      }
      throw new Error('No data');
    } catch(e) {
      return new Response(JSON.stringify({
        price: FALLBACK[region] || 4.25,
        region: region,
        source: 'Fallback',
        error: e.message
      }), { headers: CORS });
    }
  }
};
