# MacroHall expansion plan

Answers to the six expansion questions, what was built for each, and what still needs a human. Research done October 2026.

**Contents**
1. [Scaling to public universities](#1-scaling-to-public-universities)
2. [Schools whose menus can't be parsed](#2-schools-whose-menus-cant-be-parsed)
3. [Friends at the dining hall](#3-friends-at-the-dining-hall)
4. [Campus food chatbot](#4-campus-food-chatbot)
5. [.edu-only accounts with a school picker](#5-edu-only-accounts-with-a-school-picker)
6. [More ideas](#6-more-ideas)
7. [Launch checklist](#7-launch-checklist)
8. [What could not be verified](#8-what-could-not-be-verified)

---

## 1. Scaling to public universities

### The key insight: scale by menu platform, not by school

Almost every big school publishes menus through a handful of vendor platforms. One adapter per platform covers every school on it, and adding a school becomes a few lines of config. The backend now has these adapters:

| Platform | Adapter | Format | Verified public schools |
|---|---|---|---|
| **Nutrislice** | `nutrislice` ✅ | Public JSON API, no key | Ohio State, Wisconsin, Georgia Tech, Virginia Tech, Indiana, CU Boulder, UNLV |
| **Dine On Campus** (Chartwells) | `dineoncampus` ✅ | JSON API behind bot protection (fetched with a real browser) | Texas A&M, Pitt, Houston, Michigan Tech |
| **Purdue HFS** | `purdue-hfs` ✅ | Official public JSON API | Purdue |
| **FoodPro** (Aurora) | not yet; use `ai-extract` | HTML (`shortmenu.aspx` / `label.aspx`) | Penn State, Rutgers, UConn, UT Austin, UC Riverside |
| **CBORD NetNutrition** | not yet; use `ai-extract` | ASP.NET pages | Colorado State, Oklahoma State |
| School-built sites | `css-selectors` or a custom adapter | HTML | Michigan (live), Michigan State, Maryland, UCLA |
| PDFs, images, anything else | `ai-extract` ✅ | Claude reads it | Fresno State (weekly PDF menus) |

### Rollout order

"Big gym culture" has no dataset behind it, so these tiers combine engineering readiness with proxies: large residential public flagships with major rec centers and Power-4 athletics. After launch, the strongest signal is your own waitlist (`select school_name, count(*) from school_requests group by 1 order by 2 desc`).

| Tier | Schools | What's left |
|---|---|---|
| **1. Configured, just run it** | Ohio State, Purdue, Texas A&M, Pitt, Houston, Fresno State | Run ingestion once with open network, look at the data, set `status = 'live'` |
| **2. Platform verified, add config** | Wisconsin, Georgia Tech, Virginia Tech, Indiana, CU Boulder, UNLV, Michigan Tech | Find the Nutrislice district (the subdomain in the school's menu link) or Dine On Campus site slug, copy `src/config/schools/ohioState.js`, run `npm run discover` |
| **3. Native FoodPro adapter** | Penn State, Rutgers, UConn, UT Austin, UC Riverside | Save one real `shortmenu.aspx` + `label.aspx` page as fixtures, build the adapter. Until then, `ai-extract` can read the menu pages |
| **4. Custom adapters** | Michigan State, Maryland, UCLA, Colorado State, Oklahoma State | Michigan State's URL pattern is clean: `eatatstate.msu.edu/menu/{Hall}/all/{YYYY-MM-DD}` |
| **5. Identify the platform** | Minnesota, Illinois, Iowa, Nebraska, Florida, Georgia, Alabama, Auburn, LSU, Tennessee, Arizona State, Arizona, Utah, Florida State, UCF, Clemson, UNC, NC State, UVA, Iowa State, Texas Tech, Kentucky, Mizzou, Arkansas, South Carolina, Oklahoma, K-State, Cincinnati, WVU, Cal, UCSD, UC Davis, UMass, Oregon | Open the school's dining menu page and see where the data comes from (see below) |

All of these schools are already in the sign-up picker (`src/config/catalog.js`) as **coming soon**, so students can join the waitlist today.

### How to identify a school's platform in 2 minutes

Open the dining menu page, then open the browser's developer tools (Network tab) and reload:

- Requests to `*.api.nutrislice.com` → Nutrislice. The subdomain is the district.
- Requests to `api.dineoncampus.com` → Dine On Campus. The site slug is in `dineoncampus.com/<slug>`.
- Requests to `*.campusdish.com/api/...` → Aramark CampusDish. No adapter yet. It's worth building one after you capture a real response, because many Aramark schools use it.
- Page names like `shortmenu.aspx` or `longmenu.aspx` → FoodPro.
- `NetNutrition` in the URL → CBORD.
- A PDF link → `ai-extract`.

### Adding a school (checklist)

1. Add or confirm its entry in `src/config/catalog.js` (domains, time zone, platform), then run `npm run db:seed-sql` and apply `src/db/seed/schools.sql`.
2. Add `src/config/schools/<school>.js` and register it in `src/config/schools/index.js`.
3. `npm run discover -- --school=<slug>` to list its locations; pin the dining halls you want.
4. `npm run capture -- --school=<slug>` saves real responses into `tests/fixtures/captured/` for regression tests.
5. `npm run ingest -- --school=<slug> --persist=true`, then spot-check a few dishes against the school's site.
6. Add hall coordinates for check-ins (see [section 7](#7-launch-checklist)).
7. `update schools set status = 'live' where slug = '<slug>';` The school is now selectable at sign-up.

---

## 2. Schools whose menus can't be parsed

**Yes, there are several ways to get them daily.** From most to least reliable:

1. **Look for the hidden API first.** Many "unparsable" sites are JavaScript apps fed by a JSON API, which is *more* parsable than HTML. The Network-tab check above finds it.
2. **AI extraction (built).** The `ai-extract` adapter fetches a web page, PDF or image on schedule and has Claude turn it into structured dishes (station, meals, allergens, macros). Dishes are tagged `ai_extracted` (numbers printed on the source) or `ai_estimated` (Claude estimated a standard serving), and the app shows an "Estimated nutrition" label. URL templates handle dated files, e.g. Fresno State's `menu-{yyyy}-{m}-{d}.pdf`.
3. **Crowdsourced photos (built).** When a hall has no menu for a meal, AddFood shows **Snap the menu**. A student photographs the menu board, Claude reads it, and the dishes appear for everyone at that school, labeled as estimated. It never overwrites official data, and it counts against the student's daily AI quota.
4. **Ask the dining department.** They already pay for CBORD, Nutrislice or FoodPro, and many will share an export or an API key. A student-built app that helps people eat well is an easy yes for a dining director.
5. **Menu emails.** Some halls email a daily menu. An inbound-email webhook (Postmark or SendGrid) can feed the same AI extractor.
6. **Rotation prediction.** Many halls run 3–5 week cycle menus. Once you've seen a full cycle, you can show a "likely menu" when today's hasn't been posted.

---

## 3. Friends at the dining hall

**Built:** a Friends tab. Each friend shows **At Bursley · 12m ago** or **Not at a dining hall**, with a message button beside them.

How it works and why:

- **Check-in is explicit.** Tapping **Check in** reads location once (when-in-use permission). The `check_in()` database function turns the coordinates into a dining hall using each hall's geofence. Coordinates are never stored; only the hall id is kept, and it expires after 90 minutes. **Pick hall** works without location.
- **Only accepted friends** see your hall. Strangers and classmates see nothing.
- **Ghost mode** makes you look exactly like "Not at a dining hall". Hidden and absent are indistinguishable on purpose.
- **Messaging stays in the app** instead of SMS, so nobody has to share a phone number. Messages only go between accepted friends who haven't blocked each other, and they arrive live through Supabase Realtime. Quick replies: "Save me a seat", "On my way!", "Which hall?", "Want to grab food?".
- **Block and report** are built in. The App Store requires both for apps with user-generated content (Guideline 1.2).

**Before this works:** each dining hall needs coordinates. Ingestion fills them in automatically for Purdue (its API publishes them). For Michigan and the others, add them once (see [section 7](#7-launch-checklist)).

**Next steps:**
- Opt-in automatic check-in using background geofencing (`expo-location` + `expo-task-manager`). It needs "Always" location permission, which Apple reviews closely and many students decline, so keep it optional.
- Push notifications for new messages (`expo-notifications`).
- Anonymous crowd levels per hall from check-in counts, e.g. "South Quad: busy". Only show them when at least 5 people are checked in.

### Profiles

Each student has a profile page (Friends tab → **Your profile**, or tap anyone):

- **Customizable:** emoji avatar, accent color, name, `@username`, bio, goal (bulking, cutting, maintaining, recomp), class year, favorite dining hall.
- **Stats:** day streak, days logged in the last 30, 7-day calorie and protein averages, friend count.
- **"Usually eats":** their most-logged foods over 30 days.
- **Food calendar:** a month view, shaded by how much they ate each day; tap a day for every item and its macros, grouped by meal.
- **Privacy, MyFitnessPal-style:** the food log is visible to friends by default, and each student can switch to everyone at their school or only me. Blocked people can't find or see you.
- **Finding people:** search classmates by name or `@username`, then add them from their profile.

Food history is new: the app clears the log every night, so migration 003 copies every log change into a `daily_logs` table for the campus-local day. Calendars therefore start filling in from the day the migration runs.

---

## 4. Campus food chatbot

**Built:** an **Ask** tab backed by `POST /chat` on the backend.

- **Grounded in real data.** The bot's tools search today's and tomorrow's menus at the student's school (filtering out their saved allergens and flagging estimated nutrition), and read the student's targets, what they've logged, and what remains, using the same math as the Dashboard. It never invents dishes or numbers.
- **"Anything campus."** For hours, the rec center, events and so on, it uses web search restricted to the school's own domains (e.g. `umich.edu`), so answers come from official pages.
- **Guardrails:** requests are authenticated, capped at 40 per student per day (`AI_DAILY_LIMIT`), and the API key stays on the server. It redirects eating-disorder or medical questions to campus dietitians and health services instead of coaching restriction.
- **Model:** defaults to Claude Opus 5.5 at low effort, with server-side refusal fallbacks enabled. Set `CLAUDE_MODEL=claude-sonnet-5-5` or `claude-haiku-4-5` to cut cost.

**Rough cost** (estimate; measure with `response.usage` once live): a typical question takes 2–3 model calls, because the tool loop resends the context each time. That's about 9–15K input tokens and ~1K output tokens, or roughly **$0.05–0.08 per question on Opus 5.5** ($4/$20 per million tokens), about half on Sonnet 5.5 ($2/$10), and about a quarter on Haiku 4.5 ($1/$5). Each web search adds $0.01. A student who hits the 40/day cap costs about $2–3/day on Opus; typical use is a few questions a day. Lower `AI_DAILY_LIMIT` or switch `CLAUDE_MODEL` if that's too much.

---

## 5. .edu-only accounts with a school picker

**Built**, and enforced in the database, not just in the app:

- **Sign-up:** pick your school → email must be on that school's domain (subdomains count, so `name.1@buckeyemail.osu.edu` works for Ohio State) → enter the 6-digit code from your inbox.
- **Database:** a trigger on `auth.users` rejects any new account without a `.edu` email. A second trigger only lets a profile join a **live** school whose domains match the account's email.
- **Unsupported schools:** "coming soon" schools and a "Don't see your school?" form both feed `school_requests`, your demand signal for what to launch next.
- **Existing users:** accounts created before this change, including non-.edu emails, are grandfathered: moved to Michigan and still able to sign in. New accounts must be .edu.

**Required Supabase settings** (otherwise anyone can claim any .edu address):

1. Authentication → Providers → Email: turn **Confirm email** on.
2. Authentication → Email Templates → Confirm signup: include `{{ .Token }}` so the email contains the code.

---

## 6. More ideas

Ordered by how well they fit a nutrition app for students who lift.

**Highest leverage**
1. **"Hit my macros" plate builder.** "I have 60g protein and 700 cal left. What do I eat at South Quad tonight?" It's a small optimization over today's menu. The chatbot already has the data; a one-tap button that builds a plate and logs it in one go is the killer feature.
2. **Live gym crowd meter.** Many rec centers publish live occupancy through Connect2Concepts counters. Purdue's is public, and the purdue-mcp project reads it. "CoRec is 35% full, and Wiley has 4 high-protein dinners" connects gym and food in one screen.
3. **Favorite-dish alerts.** "Chicken tikka is at East Quad tonight." Students love this ([TerpAlert](https://github.com/THuitema/TerpAlert) exists only for this), and it drives daily opens.
4. **Training-day targets.** Pull workouts from Apple Health / Google Fit and raise calorie and carb targets on lifting days.

**Social and growth**

5. **Dinner plans:** "South Quad at 6:30?" Invite friends, RSVP, and see who's going. It builds on Friends and messaging.
6. **Dish ratings:** thumbs up or down per dish per day, plus a "best dish on campus today" list. That data is valuable to dining services, which also makes it a partnership pitch.
7. **Opt-in streaks and challenges:** hit protein 5 days in a row, or dorm vs. dorm. Club sports and intramural teams are natural cohorts.
8. **Campus ambassadors:** one student per school who recruits a club team or Greek house. The waitlist tells you where to hire next.

**Coverage**

9. **Barcode scanning** for protein bars and shakes via Open Food Facts (free API).
10. **Off-campus favorites** near campus (Chipotle, Raising Cane's) via a restaurant nutrition API. Students who lift eat out a lot.
11. **Quick-add supplements** (protein shake, creatine) with saved servings.
12. **Weekly AI recap:** "You averaged 142g protein, 81% of target. Your best days were the ones you ate at Bursley." It needs a log history table, which today's daily-reset log doesn't keep.

**Monetization (later)**

Freemium with a higher AI limit plus the plate builder for Pro; anonymous, aggregated dish-preference insights for dining services; local gym and supplement partners (carefully).

---

## 7. Launch checklist

**Fastest path:** on your computer, from the repo root, run `npm run setup`. It walks through the steps below one at a time: it creates and opens both `.env` files, copies the database SQL and the email template to your clipboard, and opens each Supabase and GitHub page. Use `npm run env` to just open the `.env` files.

**Database (Supabase SQL editor):** paste `CollegeMacro-backend/src/db/setup.sql` and run it. It bundles `schema.sql`, migrations `002` and `003`, and the school seed, and it's safe to re-run. It expects the app's existing `public.users` table.

**Supabase settings**
- Email confirmation on, plus a `{{ .Token }}` code in the Confirm signup template ([section 5](#5-edu-only-accounts-with-a-school-picker)).
- Realtime: the migration adds `messages` to the `supabase_realtime` publication. Confirm under Database → Publications.

**GitHub Actions secrets** (repo Settings → Secrets → Actions)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (ingestion now writes with the service role key; menu tables are read-only to the anon key after the migration)
- `ANTHROPIC_API_KEY` (AI extraction)

The workflows now live in the repo-root `.github/workflows/`. The old copies inside `CollegeMacro-backend/.github` and `CollegeMacro-mobile/.github` never ran in this monorepo. **If the original standalone repos still have their cron jobs enabled, turn them off**, or the old 05:00 UTC job will still wipe every user's log at once.

**Backend host env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `INGEST_SECRET`. See `CollegeMacro-backend/.env.example`.

**Mobile env:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BACKEND_URL`. The new build needs `expo-location` (already in package.json), so make a new native build. An OTA update isn't enough.

**Roll out in this order**
1. Apply the migration and seed, then run ingestion for Michigan (`npm run ingest -- --school=umich --persist=true`) and confirm `menu_items_flat` has today's menu.
2. Keep whatever fills the legacy per-hall tables (`Bursley`, `Markley`, ...) running until users have updated, because the current App Store build still reads them.
3. Ship the new app build.

**Hall coordinates for check-ins.** In Google Maps, right-click each dining hall entrance and copy the coordinates:

```sql
update dining_halls set latitude = <lat>, longitude = <lng>, geofence_radius_m = 75
where slug = 'bursley' and school_id = (select id from schools where slug = 'umich');
-- repeat for east-quad, markley, mosher-jordan, north-quad, south-quad, twigs-at-oxford
```

Use a larger radius (100–150 m) for big buildings. GPS accuracy adds up to 50 m of slack automatically.

---

## 8. What could not be verified

The build environment's network policy blocked university and vendor sites, so:

- **The adapters were not run against live sites.** Nutrislice, Dine On Campus and Purdue fixtures were hand-built from the field names used by working open-source clients ([ha-nutrislice](https://github.com/The-Croz/ha-nutrislice), [MMM-Nutrislice](https://github.com/vees/MMM-Nutrislice), [DISH](https://github.com/D-I-S-H/DISH-API), [purdue-api](https://github.com/albert-sun/purdue-api), [purdue-mcp](https://github.com/sharziki/purdue-mcp)). Run `npm run capture` on the first live run and commit the real responses as fixtures.
- **Dine On Campus location discovery** (`/v1/sites/{slug}/info`, `/v1/locations/all_locations`) follows the dineoncampus.com web app and is unverified; the menu endpoints are verified. If discovery fails, pin location ids in the school config.
- **Tier 5 platforms** need the 2-minute Network-tab check.
- **The mobile app** was type-checked and bundled for iOS and Android, and the database logic is covered by 12 PGlite tests. Run it on a device before release.

### Sources

- Nutrislice API: [MMM-Nutrislice](https://github.com/vees/MMM-Nutrislice), [ha-nutrislice](https://github.com/The-Croz/ha-nutrislice), [Nutrislice Go types](https://pkg.go.dev/code.jhot.me/jhot/hats/pkg/nutrislice), [trmnl-nutrislice issue #1](https://github.com/oreillymonitor/trmnl-nutrislice-plugin/issues/1)
- Nutrislice schools: [CU Boulder](https://www.colorado.edu/dining/menus), [Indiana](https://dining.indiana.edu/nutrition/index.html), [UW–Madison](https://www.housing.wisc.edu/dining/nutrition/), [Georgia Tech](https://dining.gatech.edu), [Virginia Tech](https://nutrislice.com/virginia-tech/), [UNLV](https://nutrislice.com/testimonial-unlv-dining-uses-nutrislice-to-improve-menu-accuracy/), Ohio State (`osu.nutrislice.com`, via [Spokin's OSU guide](https://www.spokin.com/the-ohio-state-university-allergy-friendly-college-campus-guide))
- Dine On Campus: [DISH-API](https://github.com/D-I-S-H/DISH-API) (`chartwells_query.py`), [Houston](https://dineoncampus.com/uh), Texas A&M (`dineoncampus.com/tamu`), Pitt (`dineoncampus.com/pitt`)
- Purdue: [purdue-api](https://pkg.go.dev/github.com/albert-sun/purdue-api), [purdue-mcp](https://github.com/sharziki/purdue-mcp)
- FoodPro: [Penn State](https://www.psu.edu/news/campus-life/story/whats-menu-foodpro-software-helps-feed-thousands-students), [RU-Food-Scraper](https://github.com/revan/RU-Food-Scraper), [UConn](https://poslabels.dds.uconn.edu/), [UC Riverside](https://foodpro.ucr.edu/)
- NetNutrition: [Oklahoma State](https://dining.okstate.edu/nutrition/resources.html), [Colorado State (Collegian)](https://collegian.com/?p=175749)
- Michigan State: [eatatstate.msu.edu](https://eatatstate.msu.edu); Maryland: [TerpAlert](https://github.com/THuitema/TerpAlert); Fresno State PDFs: [auxiliary.fresnostate.edu](https://auxiliary.fresnostate.edu/association/dining/documents/rdh_menus/menu-2025-10-5.pdf)
