# CollegeMacro Backend

Multi-school dining and nutrition ingestion backend.

## What changed

This backend was refactored from single-school (UMich-only, one table per hall) to a scalable model:

- Shared normalized schema (`schools`, `dining_halls`, `menu_items`, and child tables)
- Per-school parser adapters (`umich`, `ut-austin`, `ohio-state`)
- URLs and selectors moved to school config files
- Shared storage keyed by `school_id` and `hall_id`
- Fixture-based parser tests to catch selector drift

## Project layout

- `src/config/schools/` - per-school URLs, fetch mode, and selectors
- `src/adapters/` - parser adapters per school
- `src/ingest/` - ingestion orchestration + fetchers
- `src/db/schema.sql` - normalized Supabase/Postgres schema
- `src/db/supabaseRepository.js` - persistence into normalized tables
- `tests/fixtures/` - saved HTML fixtures
- `tests/adapters.test.js` - parser regression tests

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

3. Apply schema in Supabase SQL editor:

- `/Users/tomiwafalebita/CollegeMacro/CollegeMacro-backend/src/db/schema.sql`

## Commands

- Start API server: `npm start`
- Ingest one school (no DB write): `npm run ingest -- --school=umich`
- Ingest one school and persist: `npm run ingest -- --school=umich --persist=true`
- Ingest all schools and persist: `npm run ingest:all`
- Run parser tests: `npm test`

## API endpoints

- `GET /health`
- `GET /schools`
- `POST /ingest?school=umich&persist=true`

## Add a new school

1. Add `src/config/schools/<school>.js` with listing URL and selectors.
2. Add `src/adapters/<school>.js` that exports `listHalls` and `parseHall`.
3. Register adapter in `src/adapters/index.js`.
4. Register school in `src/config/schools/index.js`.
5. Add fixtures under `tests/fixtures/<school>/` and extend `tests/adapters.test.js`.

## Note on the mobile app

The copied mobile project is still using Michigan-specific hardcoded hall names and one-table-per-hall queries.
To fully use this backend, update mobile queries to read from normalized tables by selected `school` and `hall`.
