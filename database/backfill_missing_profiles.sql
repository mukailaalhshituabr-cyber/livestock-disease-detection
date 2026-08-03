-- ============================================================
-- FIX: "insert or update on table farms violates foreign key
-- constraint farms_owner_id_fkey"
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
--
-- Cause: farms.owner_id references profiles.id, and profiles rows are
-- normally created by the on_auth_user_created trigger. Any account
-- created before that trigger existed (or where the trigger failed)
-- has an auth.users row but no matching profiles row, so nothing that
-- references profiles.id -- like adding a farm -- can succeed.
-- ============================================================

-- 1. See which accounts are missing a profile (safe, read-only)
select id, email, raw_user_meta_data
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2. Backfill a profile for each of them, using whatever signup
--    metadata is available and falling back to sane defaults.
insert into public.profiles (id, first_name, last_name, role, region_id, phone)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'first_name', ''), 'Unknown'),
  coalesce(nullif(u.raw_user_meta_data->>'last_name', ''), 'Unknown'),
  coalesce(u.raw_user_meta_data->>'role', 'farmer'),
  nullif(u.raw_user_meta_data->>'region_id', '')::int,
  u.raw_user_meta_data->>'phone'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
