import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.11.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  try {
    // Supabase gateway needs a real JWT in Authorization (anon/service).
    // App auth for cron is only via x-cron-secret.
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    let logId = null;
    
    // Log Start
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ process_name: "process_recurring_transactions", status: "started", message: "Started recurring processing" })
      .select()
      .single();
      
    if (log) logId = log.id;

    // Fetch recurring templates that are due (skip soft-deleted)
    const { data: recurringTxs, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("is_recurring", true)
      .eq("is_deleted", false)
      .lte("next_recurring_date", todayStr);

    if (fetchError) throw fetchError;

    if (!recurringTxs || recurringTxs.length === 0) {
      return new Response(JSON.stringify({ message: "No recurring transactions due today." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const tx of recurringTxs) {
      try {
        const ownerId = tx.created_by || tx.user_id;

        // Idempotency: skip if a child for this due date already exists
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("account_id", tx.account_id)
          .eq("amount", tx.amount)
          .eq("date", tx.next_recurring_date)
          .eq("merchant", tx.merchant)
          .eq("is_recurring", false)
          .eq("is_deleted", false)
          .ilike("notes", "%(Auto-Recurring)%")
          .limit(1);

        if (existing && existing.length > 0) {
          // Still advance next date so we don't loop forever
        } else {
          const newTx = {
            amount: tx.amount,
            date: tx.next_recurring_date,
            merchant: tx.merchant,
            notes: `${tx.notes ? tx.notes + ' ' : ''}(Auto-Recurring)`,
            account_id: tx.account_id,
            transaction_type_id: tx.transaction_type_id,
            category_id: tx.category_id,
            payment_method_id: tx.payment_method_id,
            transfer_to_account_id: tx.transfer_to_account_id,
            tags: tx.tags,
            is_recurring: false,
            created_by: ownerId,
            user_id: ownerId
          };

          const { error: insertError } = await supabase.from("transactions").insert([newTx]);
          if (insertError) throw insertError;
        }

        // Calculate the next recurring date for the parent template
        const nextDate = new Date(tx.next_recurring_date);
        const interval = tx.recurrence_interval?.toLowerCase();

        if (interval === 'daily') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (interval === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (interval === '3 months') {
          nextDate.setMonth(nextDate.getMonth() + 3);
        } else if (interval === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        const nextDateStr = nextDate.toISOString().split('T')[0];

        const { error: updateError } = await supabase
          .from("transactions")
          .update({ next_recurring_date: nextDateStr })
          .eq("id", tx.id);

        if (updateError) throw updateError;

        if (ownerId) {
          await supabase.from("notifications").insert({
            title: "Recurring Transaction Logged",
            message: `Automated transaction for ${tx.merchant} was processed.`,
            type: "automation",
            action_url: "/money",
            reference_id: tx.id,
            reference_type: "transaction",
            user_id: ownerId
          });
        }

        results.push({ id: tx.id, status: "success", generatedFor: tx.next_recurring_date, nextDate: nextDateStr });
      } catch (e: any) {
        console.error(`Error processing recurring tx ${tx.id}:`, e.message);
        results.push({ id: tx.id, status: "error", error: e.message });
      }
    }

    // Log Completion
    if (logId) {
      await supabase.from("automation_logs").update({
        status: "completed",
        records_processed: results.filter(r => r.status === 'success').length,
        message: `Successfully processed ${results.filter(r => r.status === 'success').length} transaction(s)`
      }).eq("id", logId);
    }

    return new Response(JSON.stringify({ processed: recurringTxs.length, results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // Log Failure
    const errorMsg = `Error: ${error.message}`;
    console.error("Process Failed:", errorMsg);
    
    try {
      await supabase.from("automation_logs").insert({
        process_name: "process_recurring_transactions",
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
