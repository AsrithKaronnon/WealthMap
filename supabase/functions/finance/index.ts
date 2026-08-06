import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, query, symbols } = await req.json()

    if (action === 'search') {
      if (!query) throw new Error('Missing search query')
      
      const targetUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`
      const res = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      })
      
      if (!res.ok) throw new Error(`Yahoo Search API responded with ${res.status}`)
      const data = await res.json()
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'quote') {
      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        throw new Error('Missing symbols array')
      }
      
      // v7 quote API now requires cookies/crumbs and returns 401 Unauthorized for server IPs.
      // We bypass this by fetching the v8 chart API for each symbol in parallel.
      const fetchSymbol = async (sym: string) => {
        try {
          const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!res.ok) return null;
          const data = await res.json();
          if (data.chart?.result?.[0]?.meta) {
            return {
              symbol: sym,
              regularMarketPrice: data.chart.result[0].meta.regularMarketPrice
            };
          }
          return null;
        } catch (e) {
          return null;
        }
      };

      const results = await Promise.all(symbols.map(fetchSymbol));
      const validResults = results.filter(r => r !== null);

      // Return in the format expected by the frontend
      const responseData = {
        quoteResponse: {
          result: validResults
        }
      };
      
      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    throw new Error('Invalid action specified')

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
