-- ============================================================
-- MedSync — Lagos seed data
-- ============================================================

insert into hospitals (id, name, short_name, area, address, location, phone, specialties, ed_status) values
  ('11111111-1111-1111-1111-111111111111', 'Lagos State University Teaching Hospital', 'LASUTH', 'Ikeja', '1-5 Oba Akinjobi Way, Ikeja',
    st_point(3.3474, 6.5966)::geography, '+2340000001',
    ARRAY['trauma','cardiac','stroke','general'], 'open'),
  ('22222222-2222-2222-2222-222222222222', 'Lagos University Teaching Hospital', 'LUTH', 'Idi-Araba', 'Ishaga Road, Idi-Araba',
    st_point(3.3572, 6.5192)::geography, '+2340000002',
    ARRAY['trauma','cardiac','obstetric','general'], 'busy'),
  ('33333333-3333-3333-3333-333333333333', 'Reddington Hospital', 'REDD', 'Victoria Island', '12 Idowu Martins Street, VI',
    st_point(3.4237, 6.4321)::geography, '+2340000003',
    ARRAY['cardiac','stroke','general'], 'open'),
  ('44444444-4444-4444-4444-444444444444', 'General Hospital Lagos', 'GHL', 'Lagos Island', 'Broad Street, Lagos Island',
    st_point(3.3961, 6.4550)::geography, '+2340000004',
    ARRAY['general','obstetric'], 'open'),
  ('55555555-5555-5555-5555-555555555555', 'Eko Hospital', 'EKO', 'Ikeja GRA', '31 Mobolaji Bank Anthony Way',
    st_point(3.3607, 6.5875)::geography, '+2340000005',
    ARRAY['cardiac','general'], 'busy');

insert into hospital_resources (hospital_id, beds, icu, emergency, theatres, ventilators, blood_o, blood_a, blood_b, blood_ab, trauma_bay, ct_available, mri_available) values
  ('11111111-1111-1111-1111-111111111111', 42, 3, 8, 4, 5, 12, 8, 6, 3, true, true, true),
  ('22222222-2222-2222-2222-222222222222', 55, 2, 6, 5, 4, 15, 10, 8, 4, true, true, false),
  ('33333333-3333-3333-3333-333333333333', 22, 4, 5, 3, 3, 8, 6, 4, 2, false, true, true),
  ('44444444-4444-4444-4444-444444444444', 30, 1, 4, 2, 2, 6, 4, 3, 1, false, false, false),
  ('55555555-5555-5555-5555-555555555555', 18, 2, 3, 2, 2, 4, 3, 2, 1, false, true, false);

insert into ambulances (id, call_sign, vehicle_model, vehicle_plate, base_station, capabilities, status, fuel_pct) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'ALPHA-01', 'Mercedes Sprinter', 'LAG-001-AA', 'Ikeja Station', ARRAY['ALS','trauma'], 'available', 82),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'BRAVO-02', 'Ford Transit', 'LAG-002-BB', 'VI Station', ARRAY['ALS'], 'available', 65),
  ('aaaaaaaa-3333-3333-3333-333333333333', 'CHARLIE-03', 'Toyota Hiace', 'LAG-003-CC', 'Yaba Station', ARRAY['BLS'], 'available', 91),
  ('aaaaaaaa-4444-4444-4444-444444444444', 'DELTA-04', 'Mercedes Sprinter', 'LAG-004-DD', 'Lekki Station', ARRAY['ALS','trauma'], 'available', 74),
  ('aaaaaaaa-5555-5555-5555-555555555555', 'ECHO-05', 'Ford Transit', 'LAG-005-EE', 'Ikeja Station', ARRAY['BLS'], 'offline', 45),
  ('aaaaaaaa-6666-6666-6666-666666666666', 'FOXTROT-06', 'Toyota Hiace', 'LAG-006-FF', 'Yaba Station', ARRAY['ALS'], 'available', 88);

-- Initial GPS positions
insert into ambulance_locations (ambulance_id, location) values
  ('aaaaaaaa-1111-1111-1111-111111111111', st_point(3.3510, 6.5810)::geography),
  ('aaaaaaaa-2222-2222-2222-222222222222', st_point(3.4200, 6.4400)::geography),
  ('aaaaaaaa-3333-3333-3333-333333333333', st_point(3.3720, 6.5100)::geography),
  ('aaaaaaaa-4444-4444-4444-444444444444', st_point(3.4700, 6.4450)::geography),
  ('aaaaaaaa-5555-5555-5555-555555555555', st_point(3.3400, 6.6100)::geography),
  ('aaaaaaaa-6666-6666-6666-666666666666', st_point(3.3800, 6.5300)::geography);
