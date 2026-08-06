import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.11.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Initialize Supabase Client with Service Role Key for admin privileges
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

serve(async (req) => {
  try {
    const today = new Date();
    const currentDay = today.getDate(); // 1 - 31

    let logId = null;
    
    // Log Start
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ process_name: "process_sips", status: "started", message: "Started SIP processing" })
      .select()
      .single();
      
    if (log) logId = log.id;

    // Fetch all active SIPs scheduled for today
    const { data: sips, error: sipError } = await supabase
      .from("investments")
      .select("*, accounts(id, name, balance)")
      .eq("is_sip", true)
      .eq("sip_date", currentDay);

    if (sipError) throw sipError;

    if (!sips || sips.length === 0) {
      return new Response(JSON.stringify({ message: "No SIPs scheduled for today." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = [];

    // Process each SIP
    for (const sip of sips) {
      try {
        if (!sip.sip_amount || !sip.sip_account_id) continue;

        // 1. Fetch Live NAV from mfapi.in
        const mfRes = await fetch(`https://api.mfapi.in/mf/${sip.symbol}`);
        const mfData = await mfRes.json();
        
        if (!mfData || !mfData.data || mfData.data.length === 0) {
          throw new Error(`NAV data not found for ${sip.symbol}`);
        }

        const nav = parseFloat(mfData.data[0].nav);
        if (isNaN(nav) || nav <= 0) throw new Error("Invalid NAV");

        // 2. Calculate Units
        const unitsToBuy = sip.sip_amount / nav;

        // 3. Create Transaction (deduct money)
        const { data: transaction, error: txError } = await supabase
          .from("transactions")
          .insert({
            amount: sip.sip_amount,
            date: today.toISOString().split('T')[0],
            merchant: `SIP: ${sip.name}`,
            notes: `Auto SIP of ${sip.sip_amount} at NAV ${nav} (Bought ${unitsToBuy.toFixed(4)} units)`,
            account_id: sip.sip_account_id,
            transaction_type_id: "t0000000-0000-0000-0000-000000000002", // Expense/Transfer
            payment_method_id: "m0000000-0000-0000-0000-000000000001", // Bank Transfer
            tags: ["SIP", "Auto"],
            user_id: sip.user_id,
          })
          .select()
          .single();

        if (txError) throw txError;

        // 4. Update Investment Quantity
        const newQuantity = (parseFloat(sip.quantity) || 0) + unitsToBuy;
        const { error: invError } = await supabase
          .from("investments")
          .update({ quantity: newQuantity })
          .eq("id", sip.id);

        if (invError) throw invError;

        // 5. Create Notification
        await supabase.from("notifications").insert({
          title: "Monthly SIP Deducted",
          message: `Your automated SIP for ${sip.name} was processed, buying ${unitsToBuy.toFixed(4)} units at a NAV of ${nav}.`,
          type: "automation",
          action_url: "/money",
          reference_id: transaction.id,
          reference_type: "transaction",
          user_id: sip.user_id
        });

        results.push({ id: sip.id, status: "success", unitsBought: unitsToBuy });

      } catch (e: any) {
        console.error(`Error processing SIP ${sip.id}:`, e.message);
        results.push({ id: sip.id, status: "error", error: e.message });
      }
    }

    // Log Completion
    if (logId) {
      await supabase.from("automation_logs").update({
        status: "completed",
        records_processed: results.filter(r => r.status === 'success').length,
        message: `Successfully processed ${results.filter(r => r.status === 'success').length} SIP(s)`
      }).eq("id", logId);
    }

    return new Response(JSON.stringify({ processed: sips.length, results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // Log Failure
    const errorMsg = `Error: ${error.message}`;
    console.error("Process Failed:", errorMsg);
    
    try {
      await supabase.from("automation_logs").insert({
        process_name: "process_sips",
        status: "failed",
        message: errorMsg
      });
    } catch(e) {}
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
