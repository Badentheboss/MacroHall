# CollegeMacro

CollegeMacro is a multi-school dining and nutrition platform. This repository contains a Node.js ingestion/API backend and an Expo mobile client.

**Author:** [Tomiwa Falebita on LinkedIn](https://www.linkedin.com/in/oluwatomiwa-falebita-702b493a3/)

## Backend

The backend is designed to ingest dining-hall menus from multiple schools through school-specific parser adapters and shared ingestion logic. Its data model normalizes schools, dining halls, menu items, and related nutrition data for Supabase/Postgres storage.

Highlights:

- Configuration-driven school URLs and parsing selectors
- Adapters for the University of Michigan, UT Austin, and Ohio State
- Shared normalized schema and school/hall-keyed persistence
- Fixture-based parser regression tests
- Express API endpoints for health checks, school listings, and ingestion

## Repository layout

- `CollegeMacro-backend/` — ingestion pipeline, API, database schema, and tests
- `CollegeMacro-mobile/` — Expo / React Native client

## Run the backend

From `CollegeMacro-backend/`:

```bash
npm install
npm test
npm start
``

To persist data, configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` in a local `.env` file. See [the backend README](CollegeMacro-backend/README.md) for ingestion commands and endpoint details.

## Current status

The backend contains the multi-school ingestion and normalized persistence work. The mobile client still has Michigan-specific data/query assumptions and needs integration with the normalized multi-school backend.
