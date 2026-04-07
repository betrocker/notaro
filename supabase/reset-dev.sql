-- Development reset helper.
-- Run this file first to remove the current app tables.
-- Then run supabase/schema.sql to recreate the latest schema.

drop table if exists public.job_invoice_items cascade;
drop table if exists public.job_images cascade;
drop table if exists public.invoices cascade;
drop table if exists public.payments cascade;
drop table if exists public.expenses cascade;
drop table if exists public.jobs cascade;
drop table if exists public.projects cascade;
drop table if exists public.clients cascade;
drop table if exists public.users cascade;
