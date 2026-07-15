-- ============================================================
-- MedSync ERCS — Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table hospitals enable row level security;
alter table hospital_resources enable row level security;
alter table ambulances enable row level security;
alter table ambulance_locations enable row level security;
alter table incidents enable row level security;
alter table dispatches enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;
alter table dispatch_config enable row level security;

-- Helper: current user role
create or replace function current_role_type() returns user_role
language sql stable security definer
as $$ select role from profiles where id = auth.uid() $$;

create or replace function current_hospital() returns uuid
language sql stable security definer
as $$ select hospital_id from profiles where id = auth.uid() $$;

create or replace function current_ambulance() returns uuid
language sql stable security definer
as $$ select ambulance_id from profiles where id = auth.uid() $$;

-- PROFILES: read own; super_admin reads all
create policy p_profiles_read_self on profiles
  for select using (id = auth.uid() or current_role_type() = 'super_admin');
create policy p_profiles_update_self on profiles
  for update using (id = auth.uid());

-- HOSPITALS: read by any authenticated user
create policy p_hospitals_read on hospitals
  for select using (auth.role() = 'authenticated');
-- Hospitals: their own can update ED status
create policy p_hospitals_update_own on hospitals
  for update using (id = current_hospital() or current_role_type() in ('control','super_admin'));

-- HOSPITAL RESOURCES: read all authenticated; own hospital updates
create policy p_resources_read on hospital_resources
  for select using (auth.role() = 'authenticated');
create policy p_resources_update on hospital_resources
  for update using (
    hospital_id = current_hospital() or current_role_type() in ('control','super_admin')
  );

-- AMBULANCES: read all authenticated; control writes
create policy p_ambulances_read on ambulances
  for select using (auth.role() = 'authenticated');
create policy p_ambulances_update on ambulances
  for update using (
    id = current_ambulance() or current_role_type() in ('control','super_admin')
  );
create policy p_ambulances_insert on ambulances
  for insert with check (current_role_type() in ('control','super_admin'));

-- AMBULANCE LOCATIONS: read all; ambulance inserts own
create policy p_amb_loc_read on ambulance_locations
  for select using (auth.role() = 'authenticated');
create policy p_amb_loc_insert on ambulance_locations
  for insert with check (
    ambulance_id = current_ambulance() or current_role_type() in ('control','super_admin')
  );

-- INCIDENTS: read all; control writes; ambulance may update status
create policy p_incidents_read on incidents
  for select using (auth.role() = 'authenticated');
create policy p_incidents_insert on incidents
  for insert with check (current_role_type() in ('control','super_admin'));
create policy p_incidents_update on incidents
  for update using (current_role_type() in ('control','super_admin','ambulance'));

-- DISPATCHES: read all; control creates; ambulance updates own; hospital reads relevant
create policy p_dispatches_read on dispatches
  for select using (
    auth.role() = 'authenticated' and (
      current_role_type() in ('control','super_admin')
      or ambulance_id = current_ambulance()
      or hospital_id = current_hospital()
    )
  );
create policy p_dispatches_insert on dispatches
  for insert with check (current_role_type() in ('control','super_admin'));
create policy p_dispatches_update on dispatches
  for update using (
    current_role_type() in ('control','super_admin')
    or ambulance_id = current_ambulance()
  );

-- NOTIFICATIONS: recipient reads own; system inserts
create policy p_notif_read on notifications
  for select using (
    recipient_id = auth.uid() or recipient_role = current_role_type()
  );
create policy p_notif_update on notifications
  for update using (recipient_id = auth.uid());

-- DISPATCH CONFIG: read all; control/admin updates
create policy p_config_read on dispatch_config
  for select using (auth.role() = 'authenticated');
create policy p_config_update on dispatch_config
  for update using (current_role_type() in ('control','super_admin'));

-- ACTIVITY LOGS: super_admin only
create policy p_audit_read on activity_logs
  for select using (current_role_type() in ('control','super_admin'));
create policy p_audit_insert on activity_logs
  for insert with check (auth.role() = 'authenticated');
