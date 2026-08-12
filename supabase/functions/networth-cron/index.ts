import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INCOME_TYPE = 't0000000-0000-0000-0000-000000000001';
const EXPENSE_TYPE = 't0000000-0000-0000-0000-000000000002';

async function fetchLivePrice(symbol: string): Promise<number> {
  try {
    if (/^[0-9]{5,6}$/.test(symbol)) {
      // Mutual Fund
      const res = await fetch(`https://api.mfapi.in/mf/${symbol}`);
      const data = await res.json();
      return data.data?.[0]?.nav ? parseFloat(data.data[0].nav) : 0;
    } else {
      // Stock - Yahoo Finance
      const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const data = await res.json();
      return data.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
    }
  } catch (e) {
    console.error(`Failed to fetch price for ${symbol}:`, e);
    return 0;
  }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let logId = null;
    try {
      const { data: log } = await supabase
        .from("automation_logs")
        .insert({ process_name: "networth_history_cron", status: "started", message: "Started networth history processing" })
        .select()
        .single();
      if (log) logId = log.id;
    } catch(e) {}


    // Get all users from user_settings (or just query users directly if auth schema is exposed)
    // using user_settings as a proxy for active users, and get their hidden account settings
    const { data: users, error: usersErr } = await supabase.from('user_settings').select('created_by, hidden_asset_account_ids');
    if (usersErr) throw usersErr;
    
    // Create a map of userId -> hidden_asset_account_ids
    const userSettingsMap = new Map();
    for (const u of users) {
      if (u.created_by) {
        userSettingsMap.set(u.created_by, u.hidden_asset_account_ids || []);
      }
    }
    
    const userIds = [...userSettingsMap.keys()];
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let processed = 0;

    for (const userId of userIds) {
      // 1. Calculate Cash (Accounts)
      const hiddenIds = userSettingsMap.get(userId) || [];
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, balance, account_type')
        .eq('created_by', userId)
        .eq('is_deleted', false);
        
      const cash = (accounts || [])
        .filter(a => !hiddenIds.includes(a.id) && a.account_type !== 'Credit Card')
        .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

      // 2. Calculate Assets
      const { data: assets } = await supabase
        .from('assets')
        .select('current_value')
        .eq('created_by', userId)
        .eq('is_deleted', false);
        
      const totalAssets = (assets || []).reduce((sum, a) => sum + parseFloat(a.current_value || 0), 0);

      // 3. Calculate Investments
      const { data: investments } = await supabase
        .from('investments')
        .select('symbol, quantity')
        .eq('user_id', userId);

      let totalInvestments = 0;
      if (investments && investments.length > 0) {
        // Dedup symbols to fetch price once
        const symbols = [...new Set(investments.map(i => i.symbol))];
        const prices: Record<string, number> = {};
        for (const sym of symbols) {
          prices[sym] = await fetchLivePrice(sym);
        }
        totalInvestments = investments.reduce((sum, inv) => {
          return sum + (parseFloat(inv.quantity || 0) * (prices[inv.symbol] || 0));
        }, 0);
      }

      const networth = cash + totalAssets + totalInvestments;

      // 4. Calculate Income & Spent for the current month
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, transaction_type_id, date')
        .eq('created_by', userId)
        .eq('is_deleted', false);

      let income = 0;
      let spent = 0;

      if (transactions) {
        for (const t of transactions) {
          const tDate = new Date(t.date);
          if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            const amt = parseFloat(t.amount || 0);
            if (t.transaction_type_id === INCOME_TYPE) income += amt;
            else if (t.transaction_type_id === EXPENSE_TYPE) spent += amt;
          }
        }
      }

      // 5. Insert or Update into networth_history
      await supabase
        .from('networth_history')
        .upsert({
          date: todayStr,
          user_id: userId,
          networth: networth,
          cash: cash,
          income: income,
          spent: spent
        }, {
          onConflict: 'date, user_id'
        });

      processed++;
    }

    if (logId) {
      try {
        await supabase.from("automation_logs").update({
          status: "completed",
          records_processed: processed,
          message: `Successfully processed networth for ${processed} users`
        }).eq("id", logId);
      } catch(e) {}
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error("Process Failed:", error.message);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseKey) {
        await createClient(supabaseUrl, supabaseKey).from("automation_logs").insert({
          process_name: "networth_history_cron",
          status: "failed",
          message: `Error: ${error.message}`
        });
      }
    } catch(e) {}

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
