# MedSync — Emergency Response Coordination System

Real-time dispatch and coordination platform for emergency control centers, ambulances, and hospitals. Built for Lagos State-scale operations.

**Stack:** React · TypeScript · Tailwind CSS · Supabase (Auth, Postgres, Realtime) · Leaflet + OpenStreetMap · Nominatim · OSRM · Netlify

**Cost to run the demo: ₦0.** No paid services, no credit cards, no API keys except Supabase (free tier).

---

## What's under the hood

| Function | Free service used | Notes |
|---|---|---|
| Auth + Database + Realtime | Supabase free tier | 500MB DB, 2GB bandwidth, generous limits |
| Map tiles | CartoDB Dark Matter (via OSM) | No key required, no attribution nag |
| Address autocomplete | Nominatim (OpenStreetMap) | 500ms debounce keeps within 1 req/sec policy |
| Road routing + ETA | OSRM public demo | Fine for demos, self-host for production |
| Turn-by-turn navigation | Google Maps universal URL | Opens Google Maps app/web, no API key needed |
| Deployment | Netlify free tier | 100GB bandwidth/month |

For production you'd swap OSRM public → self-hosted (or Mapbox Directions on a paid tier), and Nominatim public → Photon or Mapbox Geocoding. All the code paths already exist — only the URLs change.

---

## Quick start

```bash
unzip medsync.zip && cd medsync
npm install
cp .env.example .env.local     # fill in Supabase URL + anon key
npm run dev
```

Open `http://localhost:5173` and sign in with one of your Supabase test users.

### Prerequisites

- Node.js 20+
- Supabase project (free)

---

## Supabase setup (3 minutes)

1. **Create the project** at supabase.com. Copy Project URL + anon key into `.env.local`.
2. **Run migrations in order** via the SQL editor:
   - `supabase/migrations/20260101000001_schema.sql`
   - `supabase/migrations/20260101000002_rls.sql`
   - `supabase/migrations/20260101000003_seed.sql`
3. **Enable Realtime** for these tables (Database → Replication):
   `incidents`, `dispatches`, `ambulance_locations`, `ambulances`, `hospital_resources`, `hospitals`, `notifications`
4. **Create test users** — Auth → Users → Add user. Then in SQL editor:

   ```sql
   insert into profiles (id, full_name, role) values
     ('<uuid-of-control-user>', 'Amaka Dispatch', 'control');
   insert into profiles (id, full_name, role, ambulance_id) values
     ('<uuid-of-ambulance-user>', 'Segun Okafor', 'ambulance', 'aaaaaaaa-1111-1111-1111-111111111111');
   insert into profiles (id, full_name, role, hospital_id) values
     ('<uuid-of-hospital-user>', 'Dr. Ade Bello', 'hospital', '11111111-1111-1111-1111-111111111111');
   ```

That's the entire setup. No Google Cloud, no billing.

---

## Deployment (Netlify)

Push to GitHub. Connect the repo to Netlify. Build command `npm run build`, publish `dist`. Add the two Supabase env vars in Site settings → Environment variables. Deploy.

Included `netlify.toml` handles SPA redirects and security headers.

---

## Project structure

```
src/
├── main.tsx                Entry
├── index.css               Tailwind + Leaflet dark theme
├── lib/
│   ├── supabase.ts         Client + audit log
│   ├── maps.ts             Nominatim, OSRM, nav launcher
│   ├── dispatch-engine.ts  Async scoring with OSRM ETAs
│   └── utils.ts            cn, geo math, time
├── types/
│   └── index.ts
├── hooks/
│   ├── useAuth.tsx
│   ├── useTheme.ts
│   ├── useRealtimeAmbulances.ts
│   ├── useRealtimeHospitals.ts
│   ├── useRealtimeIncidents.ts
│   ├── useNotifications.ts
│   └── useGeoTracker.ts    Streams GPS to Supabase
├── components/
│   ├── ui/                 Button, Chip, Counter, Modal, Loader, PlacesAutocomplete
│   ├── map/LiveMap.tsx     Leaflet + CartoDB dark
│   ├── layout/AppShell.tsx
│   └── auth/               LoginPage, ProtectedRoute
├── features/
│   ├── control/ControlCenterPage.tsx
│   ├── ambulance/AmbulancePage.tsx
│   └── hospital/HospitalPage.tsx
└── routes/AppRoutes.tsx

supabase/
└── migrations/             Schema, RLS, Lagos seed
```

---

## Dispatch flow

1. Control clicks **New Incident** → Nominatim autocomplete resolves the Lagos address to exact coordinates
2. Client-side scoring engine calls OSRM for every candidate ambulance and hospital
3. Weighted scores computed using traffic-adjusted ETAs (rush-hour multiplier baked in)
4. Control confirms recommended pair → `dispatches` row inserted, realtime notification pushed
5. Ambulance dashboard shows pulsing pending dispatch → **Accept** or **Reject**
6. On accept: mission goes en_route, Google Maps opens in a new tab with real turn-by-turn
7. Progress buttons walk through `on_scene → transporting → at_hospital → completed`
8. Hospital dashboard shows the incoming unit with live ETA from `useGeoTracker` GPS updates
9. On completion, ambulance returns available, metrics logged

The control map shows a cyan dashed **route polyline** drawn by OSRM as the ambulance moves.

---

## Testing quickly

Open three browser windows or three profiles:
- One signed in as your control user → land on `/control`
- One signed in as your ambulance user → land on `/ambulance`
- One signed in as your hospital user → land on `/hospital`

Control creates an incident at "Third Mainland Bridge". Dispatches to ALPHA-01 → LASUTH. Within a second the ambulance window pulses amber with the dispatch. Accept. Progress through stages. The hospital window sees the ambulance approach with ETA counting down.

---

## Upgrade paths

When you're ready to spend money to remove demo-tier limits:

- **Nominatim (autocomplete)** → self-host or use [Photon](https://photon.komoot.io/) (free), [Mapbox Geocoding](https://www.mapbox.com/geocoding), or Google Places
- **OSRM (routing)** → self-host on a $5/mo VPS, or use [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/), [GraphHopper](https://www.graphhopper.com/), or Google Directions
- **Tiles** → keep CartoDB (free forever) or upgrade to [Mapbox](https://www.mapbox.com/) / [Stadia](https://stadiamaps.com/) if you want custom styling

Every swap is a one-line URL change in `src/lib/maps.ts`.

---

## Built with care for Lagos State emergency operations.
