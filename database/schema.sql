-- ============================================================
-- AI LIVESTOCK DISEASE DETECTION SYSTEM — DATABASE SCHEMA
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
--
-- WARNING: This script starts by DROPPING every table/function/trigger
-- this project owns, if they exist. Running it WIPES ALL EXISTING DATA
-- in these tables (regions, profiles, farms, animals, diseases,
-- predictions, vet_reviews) before recreating everything from scratch.
-- It does NOT touch auth.users itself (Supabase Auth owns that table),
-- and does NOT touch Storage - run storage_setup.sql separately for that.
-- ============================================================

-- ------------------------------------------------------------
-- 0. CLEAN SLATE
-- ------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.vet_reviews cascade;
drop table if exists public.predictions cascade;
drop table if exists public.animals cascade;
drop table if exists public.farms cascade;
drop table if exists public.diseases cascade;
drop table if exists public.profiles cascade;
drop table if exists public.regions cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.get_user_role() cascade;

-- ------------------------------------------------------------
-- 1. REGIONS  (reference table — Niger's administrative regions)
-- ------------------------------------------------------------
create table public.regions (
  id serial primary key,
  name text unique not null
);

insert into public.regions (name) values
  ('Agadez'), ('Diffa'), ('Dosso'), ('Maradi'),
  ('Niamey'), ('Tahoua'), ('Tillabéri'), ('Zinder');

-- ------------------------------------------------------------
-- 2. PROFILES  (extends auth.users — this is where "role" lives)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text not null,
  last_name text not null,
  phone text,
  role text not null default 'farmer'
       check (role in ('farmer', 'veterinarian', 'admin')),
  region_id int references public.regions(id),
  preferred_language text default 'fr' check (preferred_language in ('fr','en','ha','zar')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- security definer: reads role while bypassing RLS on profiles, so
-- policies that check role (below, on profiles/farms/animals/predictions/
-- vet_reviews) don't recurse into re-evaluating the profiles policies
-- while already evaluating them. Defined before any policy uses it.
create function public.get_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "Admins view all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

-- Auto-creates a profile row whenever Supabase Auth creates a user.
-- first_name/last_name are NOT NULL above, but not every account-creation
-- path supplies raw_user_meta_data - the Dashboard's "Add user" form, for
-- instance, only takes email/password with no metadata field at all. Rather
-- than let the trigger (and the whole user creation) fail with a not-null
-- violation whenever metadata is missing, fall back to a placeholder name;
-- the person can fill in their real name later via "Users can update own
-- profile". The app's actual Sign Up screen always sends real names, so
-- this fallback only ever applies to accounts created some other way.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, role, region_id, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), 'New'),
    coalesce(nullif(new.raw_user_meta_data->>'last_name', ''), 'User'),
    coalesce(new.raw_user_meta_data->>'role', 'farmer'),
    (new.raw_user_meta_data->>'region_id')::int,
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 3. FARMS
-- ------------------------------------------------------------
create table public.farms (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id) not null,
  farm_name text not null,
  region_id int references public.regions(id),
  gps_lat numeric(9,6),
  gps_lng numeric(9,6),
  created_at timestamptz default now()
);

alter table public.farms enable row level security;

create policy "Farmers manage own farms"
  on public.farms for all
  using (auth.uid() = owner_id);

create policy "Vets and admins view all farms"
  on public.farms for select
  using (public.get_user_role() in ('veterinarian', 'admin'));

-- ------------------------------------------------------------
-- 4. ANIMALS
-- ------------------------------------------------------------
create table public.animals (
  id uuid default gen_random_uuid() primary key,
  farm_id uuid references public.farms(id) on delete cascade not null,
  tag_id text not null,
  species text not null check (species in ('goat','sheep','camel','cow')),
  breed text,
  sex text check (sex in ('male','female')),
  date_of_birth date,
  created_at timestamptz default now(),
  unique (farm_id, tag_id)
);

alter table public.animals enable row level security;

create policy "Farmers manage own animals"
  on public.animals for all
  using (
    exists (select 1 from public.farms f where f.id = farm_id and f.owner_id = auth.uid())
  );

create policy "Vets and admins view all animals"
  on public.animals for select
  using (public.get_user_role() in ('veterinarian', 'admin'));

-- ------------------------------------------------------------
-- 5. DISEASES  (reference/lookup table)
-- ------------------------------------------------------------
create table public.diseases (
  id serial primary key,
  name text unique not null,
  species_affected text[],
  symptoms text,
  recommended_action text,
  severity text check (severity in ('low','medium','high','critical'))
);

insert into public.diseases (name, species_affected, symptoms, recommended_action, severity) values
  ('Healthy', '{goat,sheep,camel,cow}', 'No visible signs of illness', 'Continue regular monitoring', 'low'),
  ('Lumpy Skin Disease', '{cow}', 'Firm skin nodules, fever, swollen lymph nodes', 'Isolate animal and contact a veterinarian immediately', 'high'),
  ('Foot and Mouth Disease', '{cow,goat,sheep}', 'Blisters on mouth/feet, lameness, fever', 'Isolate animal, restrict movement, contact veterinarian', 'critical'),
  ('Mastitis', '{cow,goat}', 'Swollen udder, abnormal milk, pain', 'Contact veterinarian; discontinue milking from affected teat', 'medium'),
  ('Bovine Respiratory Disease', '{cow}', 'Fever, coughing, nasal discharge, labored breathing, lethargy, reduced appetite', 'Isolate animal and contact a veterinarian immediately; may require antibiotic treatment', 'high');

alter table public.diseases enable row level security;
create policy "Anyone authenticated can read diseases"
  on public.diseases for select
  using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 6. PREDICTIONS
-- ------------------------------------------------------------
create table public.predictions (
  id uuid default gen_random_uuid() primary key,
  animal_id uuid references public.animals(id) on delete set null,
  user_id uuid references public.profiles(id) not null,
  image_url text not null,
  predicted_disease_id int references public.diseases(id) not null,
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  all_probabilities jsonb,
  created_at timestamptz default now()
);

alter table public.predictions enable row level security;

create policy "Users manage own predictions"
  on public.predictions for all
  using (auth.uid() = user_id);

create policy "Vets and admins view all predictions"
  on public.predictions for select
  using (public.get_user_role() in ('veterinarian', 'admin'));

-- ------------------------------------------------------------
-- 7. VET_REVIEWS
-- ------------------------------------------------------------
create table public.vet_reviews (
  id uuid default gen_random_uuid() primary key,
  prediction_id uuid references public.predictions(id) on delete cascade not null,
  veterinarian_id uuid references public.profiles(id) not null,
  agrees_with_ai boolean not null,
  confirmed_disease_id int references public.diseases(id),
  notes text,
  created_at timestamptz default now()
);

alter table public.vet_reviews enable row level security;

create policy "Vets manage own reviews"
  on public.vet_reviews for all
  using (public.get_user_role() = 'veterinarian' and veterinarian_id = auth.uid());

create policy "Farmers view reviews on their own predictions"
  on public.vet_reviews for select
  using (
    exists (
      select 1 from public.predictions pr
      where pr.id = prediction_id and pr.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index idx_animals_farm_id on public.animals(farm_id);
create index idx_predictions_animal_id on public.predictions(animal_id);
create index idx_predictions_user_id on public.predictions(user_id);
create index idx_farms_owner_id on public.farms(owner_id);
create index idx_vet_reviews_prediction_id on public.vet_reviews(prediction_id);
