# CollegeMacro

CollegeMacro is a multi-school dining and nutrition platform. This repository contains a Node.js ingestion/API backend and an Expo mobile client.

**Author:** [Tomiwa Falebita on LinkedIn](https://www.linkedin.com/in/oluwatomiwa-falebita-702b493a3/)

## Backend

The backend ingests dining-hall menus for many schools and serves the app's AI features. Its data model normalizes schools, dining halls, dated menu items, and nutrition data in Supabase/Postgres.

Highlights:

- One adapter per menu platform (Nutrislice, Dine On Campus, Purdue's API), so adding a school on a supported platform takes a few lines of config
- AI extraction (Claude) for menus published only as web pages, PDFs, or photos
- Campus-local dates: each run ingests today and tomorrow in every school's own time zone
- A campus food chatbot (`POST /chat`) grounded in the student's menus and macros
- Supabase migration for .edu-only sign-up, friends, dining-hall check-ins, and messaging, tested in PGlite

## Mobile app

- Sign up by picking your school and verifying a `.edu` email on that school's domain
- Menus for your own school's dining halls, with "Snap the menu" when a hall hasn't posted one
- **Friends:** see which friends are at a dining hall (or "Not at a dining hall") and message them
- **Ask:** the campus food chatbot

## Repository layout

- `CollegeMacro-backend/` — ingestion pipeline, API, database schema and migrations, tests
- `CollegeMacro-mobile/` — Expo / React Native client
- `.github/workflows/` — scheduled menu ingestion and daily log reset
- `docs/EXPANSION_PLAN.md` — which schools to add next, how to handle unparsable menus, launch checklist

## Run it on localhost

From the repo root on your computer (Node 20+):

```bash
npm run demo   # the app on sample data at http://localhost:8081, no keys needed
npm run setup  # one-time: connect your Supabase project and fill in both .env files
npm run dev    # the real app at http://localhost:8081, plus the backend on :3001
```

The first run installs the app's dependencies. The demo signs you in as a Michigan student with friends, menus, gym counts, a food log and a profile calendar, all made up and kept in memory (a page reload resets it). `npm run dev` falls back to the demo until `CollegeMacro-mobile/.env` has your Supabase keys, and starts the backend only when `CollegeMacro-backend/.env` has the service role key. In the Expo terminal, press `w` to reopen the browser, or scan the QR code with Expo Go to open the app on your phone (on the same Wi-Fi). Use `--port=8082` after `--` to pick another port, e.g. `npm run demo -- --port=8082`.

## Run the backend

From `CollegeMacro-backend/`:

```bash
npm install
npm test
npm start
```

Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY` in a local `.env` file (see `.env.example`). See [the backend README](CollegeMacro-backend/README.md) for ingestion commands and endpoints, and [the expansion plan](docs/EXPANSION_PLAN.md#7-launch-checklist) for the Supabase setup steps.
