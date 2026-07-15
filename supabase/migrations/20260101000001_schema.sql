-- ============================================================
-- MedSync ERCS — Schema
-- ============================================================
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ROLES & USERS ------------------------------------------------
create type user_role as enum ('control', 'ambulance', 'hospital', 'super_admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null,
  hospital_id uuid,
  ambulance_id uuid,
  station text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on profiles (role);

-- HOSPITALS ----------------------------------------------------
create table hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  area text,
  address text,
  location geography(Point, 4326) not null,
  phone text,
  specialties text[] default '{}',
  ed_status text default 'open' check (ed_status in ('open','busy','diversion')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on hospitals using gist (location);
create index on hospitals (ed_status);

create table hospital_resources (
  hospital_id uuid primary key references hospitals(id) on delete cascade,
  beds int default 0 check (beds >= 0),
  icu int default 0 check (icu >= 0),
  emergency int default 0 check (emergency >= 0),
  theatres int default 0 check (theatres >= 0),
  ventilators int default 0 check (ventilators >= 0),
  blood_o int default 0,
  blood_a int default 0,
  blood_b int default 0,
  blood_ab int default 0,
  trauma_bay boolean default false,
  ct_available boolean default false,
  mri_available boolean default false,
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);

-- AMBULANCES ---------------------------------------------------
create type ambulance_status as enum
  ('available','dispatched','en_route','on_scene','transporting','at_hospital','offline','maintenance');

create table ambulances (
  id uuid primary key default gen_random_uuid(),
  call_sign text unique not null,
  vehicle_model text,
  vehicle_plate text,
  base_station text,
  capabilities text[] default '{}',
  status ambulance_status default 'offline',
  fuel_pct int default 100 check (fuel_pct between 0 and 100),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on ambulances (status);

create table ambulance_locations (
  id bigserial primary key,
  ambulance_id uuid references ambulances(id) on delete cascade,
  location geography(Point, 4326) not null,
  heading numeric,
  speed_kmh numeric,
  accuracy_m numeric,
  recorded_at timestamptz default now()
);
create index on ambulance_locations (ambulance_id, recorded_at desc);
create index on ambulance_locations using gist (location);

-- Latest-position lookup view
create or replace view v_ambulance_current as
select distinct on (ambulance_id)
  ambulance_id, location,
  st_y(location::geometry) as lat,
  st_x(location::geometry) as lng,
  heading, speed_kmh, recorded_at
from ambulance_locations
order by ambulance_id, recorded_at desc;

-- INCIDENTS ----------------------------------------------------
create type incident_priority as enum ('critical','high','medium','low');
create type incident_type as enum
  ('cardiac','trauma','stroke','obstetric','accident','respiratory','other');
create type incident_status as enum
  ('reported','dispatching','assigned','in_progress','transporting','completed','cancelled');

create table incidents (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type incident_type not null,
  priority incident_priority not null,
  location geography(Point, 4326) not null,
  address text,
  caller_name text,
  caller_phone text,
  description text,
  status incident_status default 'reported',
  reported_at timestamptz default now(),
  reported_by uuid references profiles(id),
  completed_at timestamptz,
  updated_at timestamptz default now()
);
create index on incidents using gist (location);
create index on incidents (status, reported_at desc);
create index on incidents (priority, status);

-- Auto-generate incident code
create or replace function generate_incident_code() returns trigger as $$
declare
  y text := to_char(now(), 'YYYY');
  seq int;
begin
  if new.code is null or new.code = '' then
    select coalesce(max(substring(code from 10)::int), 0) + 1 into seq
      from incidents where code like 'INC-' || y || '-%';
    new.code := 'INC-' || y || '-' || lpad(seq::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_incident_code before insert on incidents
  for each row execute function generate_incident_code();

-- DISPATCHES ---------------------------------------------------
create type mission_stage as enum
  ('pending','accepted','en_route','on_scene','transporting','at_hospital','completed','cancelled');

create table dispatches (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references incidents(id) on delete cascade,
  ambulance_id uuid references ambulances(id),
  hospital_id uuid references hospitals(id),
  stage mission_stage default 'pending',
  patient_note text,
  score jsonb,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  on_scene_at timestamptz,
  transporting_at timestamptz,
  arrived_hospital_at timestamptz,
  completed_at timestamptz,
  rejected_reason text,
  updated_at timestamptz default now()
);
create index on dispatches (ambulance_id, stage);
create index on dispatches (hospital_id, stage);
create index on dispatches (incident_id);
create index on dispatches (stage, created_at desc);

-- NOTIFICATIONS ------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) on delete cascade,
  recipient_role user_role,
  kind text,
  title text not null,
  body text,
  payload jsonb,
  read boolean default false,
  created_at timestamptz default now()
);
create index on notifications (recipient_id, read, created_at desc);
create index on notifications (recipient_role, created_at desc);

-- ACTIVITY / AUDIT LOG -----------------------------------------
create table activity_logs (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  actor_role user_role,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz default now()
);
create index on activity_logs (resource_type, resource_id);
create index on activity_logs (actor_id, created_at desc);
create index on activity_logs (action, created_at desc);

-- DISPATCH CONFIG ----------------------------------------------
create table dispatch_config (
  id int primary key default 1,
  weight_travel int default 40,
  weight_traffic int default 20,
  weight_capacity int default 15,
  weight_specialty int default 15,
  weight_priority int default 10,
  auto_dispatch boolean default false,
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id),
  check (id = 1)
);
insert into dispatch_config (id) values (1) on conflict do nothing;

-- REPORTS AGGREGATES -------------------------------------------
create or replace view v_daily_stats as
select
  date_trunc('day', reported_at) as day,
  count(*) as incident_count,
  count(*) filter (where priority = 'critical') as critical_count,
  count(*) filter (where status = 'completed') as completed_count
from incidents
group by 1;

create or replace view v_response_times as
select
  d.id,
  d.incident_id,
  i.priority,
  i.type,
  extract(epoch from (d.accepted_at - d.created_at))/60 as accept_min,
  extract(epoch from (d.on_scene_at - d.created_at))/60 as response_min,
  extract(epoch from (d.arrived_hospital_at - d.on_scene_at))/60 as transport_min,
  extract(epoch from (d.completed_at - d.created_at))/60 as total_min,
  d.created_at
from dispatches d
join incidents i on i.id = d.incident_id
where d.stage = 'completed';

-- REALTIME PUBLICATION ----------------------------------------
alter publication supabase_realtime add table
  incidents, dispatches, ambulance_locations, ambulances,
  hospital_resources, hospitals, notifications;

-- FK add-back (self references) --------------------------------
alter table profiles add constraint profiles_hospital_fk
  foreign key (hospital_id) references hospitals(id);
alter table profiles add constraint profiles_ambulance_fk
  foreign key (ambulance_id) references ambulances(id);

-- Auto-update timestamps
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

create trigger trg_incidents_updated before update on incidents
  for each row execute function set_updated_at();
create trigger trg_dispatches_updated before update on dispatches
  for each row execute function set_updated_at();
create trigger trg_ambulances_updated before update on ambulances
  for each row execute function set_updated_at();
create trigger trg_hospitals_updated before update on hospitals
  for each row execute function set_updated_at();
