-- WealthMap UI no longer uses the bills table (recurring transactions replace it).
-- Do NOT run this against production until you have migrated any remaining bill data
-- and confirmed nothing else reads from bills.

-- DROP TABLE IF EXISTS public.bills;
