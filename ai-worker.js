/* ═══════════════════════════════════════════════════════════════
   RoadCommand — AI Proxy Worker
   Proxies Anthropic API calls — keeps API key server-side
   
   SETUP STEPS:
   1. Go to Cloudflare Dashboard → Workers & Pages → Create Worker
   2. Name it: roadcommand-ai
   3. Paste this entire file
   4. Click Deploy
   5. Go to Settings → Variables and Secrets → Add:
      - ANTHROPIC_API_KEY = your key from console.anthropic.com
   6. Copy the worker URL
   7. In auth.js after login, set: window._rcAIWorker = 'YOUR_WORKER_URL'
   ═══════════════════════════════════════════════════════════════ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();

      // Rate limit check — max 20 AI calls per user per day
      // (implement via KV if needed at scale)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: body.model || 'claude-sonnet-4-20250514',
          max_tokens: Math.min(body.max_tokens || 300, 1000),
          messages: body.messages,
        })
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: CORS });

    } catch(e) {
      return new Response(JSON.stringify({ error: { message: e.message } }), {
        headers: CORS,
        status: 500
      });
    }
  }
};
