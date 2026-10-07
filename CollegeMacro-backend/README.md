# CollegeMacro Backend

Multi-school dining ingestion, plus the API behind the app's AI features.

## How it works

- **Platform adapters** (`src/adapters/`): one per menu platform, not per school.
  - `nutrislice`: Nutrislice JSON API (Ohio State, Wisconsin, Georgia Tech, ...)
  - `dineoncampus`: Dine On Campus API (Texas A&M, Pitt, Houston); fetched with a real browser because of bot protection
  - `purdue-hfs`: Purdue's public menus API
  - `umich`: University of Michigan's dining site
  - `css-selectors`: generic selector-driven HTML parser
  - `ai-extract`: Claude reads a web page, PDF, or image into structured dishes (fallback for anything else)
- **School catalog** (`src/config/catalog.js`): every school the sign-up picker shows, with email domains, time zone, platform, and live/coming-soon status. `src/config/schools/*.js` holds ingestion settings for the schools being ingested.
- **Ingestion** (`src/ingest/`): ingests today and tomorrow in each school's time zone and writes dated menus with bulk inserts. The canonical nutrition units are documented in `src/adapters/shared/nutrition.js`.
- **Database** (`src/db/`): `schema.sql`, then `migrations/002_multi_school_social.sql`, then `seed/schools.sql`.
- **Chatbot** (`src/chat/`): `POST /chat` runs Claude with tools over the student's menus and food log, plus web search limited to their school's domains.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `INGEST_SECRET`.
3. In the Supabase SQL editor, apply `src/db/schema.sql`, `src/db/migrations/002_multi_school_social.sql`, and `src/db/seed/schools.sql`.

## Commands

- Start the API: `npm start`
- Run tests (adapters, chatbot, and the migration in PGlite): `npm test`
- Ingest one school without writing to the DB: `npm run ingest -- --school=umich`
- Ingest and persist: `npm run ingest -- --school=umich --persist=true`
- Ingest every configured school: `npm run ingest:all`
- List a school's dining locations: `npm run discover -- --school=ohio-state`
- Save real API responses as test fixtures: `npm run capture -- --school=ohio-state`
- Regenerate the school seed after editing the catalog: `npm run db:seed-sql`

## API endpoints

- `GET /health`
- `GET /schools`: configured ingestion schools
- `POST /chat` (Supabase bearer token): `{ messages: [{ role, content }] }` → `{ reply }`
- `POST /menus/photo` (Supabase bearer token): `{ hallId, imageBase64, mediaType }`; reads a menu-board photo for a hall with no menu today
- `DELETE /delete-user` (Supabase bearer token)
- `POST /ingest?school=umich&persist=true` (requires `Authorization: Bearer $INGEST_SECRET`)

## Add a school

See the checklist in [docs/EXPANSION_PLAN.md](../docs/EXPANSION_PLAN.md#adding-a-school-checklist). For a school on a supported platform: add a catalog entry, add a small config file, run `npm run discover`, ingest, then set the school live.
