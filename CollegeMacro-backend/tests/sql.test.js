// Runs the real migrations in PGlite (Postgres compiled to WASM) against a
// Supabase-like shim, then exercises the triggers, RLS policies and RPCs the
// mobile app relies on, acting as different users.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildSeedSql } = require('../src/cli/buildSeed');
const { buildSetupSql } = require('../src/cli/buildSetupSql');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

const SHIM = read('tests', 'sql', 'supabase-shim.sql');
const SCHEMA = read('src', 'db', 'schema.sql');
const MIGRATION = read('src', 'db', 'migrations', '002_multi_school_social.sql');
const PROFILES = read('src', 'db', 'migrations', '003_profiles.sql');
const GYMS = read('src', 'db', 'migrations', '004_gyms_favorites.sql');
const PHOTOS = read('src', 'db', 'migrations', '005_school_colors_avatars.sql');
const SEED = read('src', 'db', 'seed', 'schools.sql');

const LEGACY = '00000000-0000-0000-0000-00000000000a';
const ALEX = '00000000-0000-0000-0000-000000000001'; // umich
const BLAKE = '00000000-0000-0000-0000-000000000002'; // umich
const CASEY = '00000000-0000-0000-0000-000000000003'; // umich, not a friend
const DREW = '00000000-0000-0000-0000-000000000004'; // ohio state

// Bursley Hall area, Ann Arbor (test coordinates only).
const HALL = { lat: 42.2935, lng: -83.7208 };

let db;

// Runs one statement as a signed-in user (or anon when userId is null) inside
// a transaction, the way PostgREST does for each request.
async function as(userId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId || '']);
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);
    return tx.query(sql, params);
  });
}

async function asService(sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    return tx.query(sql, params);
  });
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

async function createStudent(id, email, username, schoolSlug) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  await as(id, `insert into public.users (username, email, school_id)
                values ($1, $2, (select id from public.schools where slug = $3))`, [username, email, schoolSlug]);
}

test.before(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.exec(SHIM);

  // An account from before this migration, with a non-.edu email.
  await db.query('insert into auth.users (id, email) values ($1, $2)', [LEGACY, 'old.user@gmail.com']);
  await db.query(`insert into public.users (id, username, email, log) values ($1, 'Legacy', 'old.user@gmail.com', '[{"name":"Oatmeal"}]')`, [LEGACY]);

  await db.exec(SCHEMA);
  await db.exec(MIGRATION);
  await db.exec(PROFILES);
  await db.exec(GYMS);
  await db.exec(PHOTOS);
  await db.exec(SEED);
});

test.after(async () => {
  await db.close();
});

test('migration and seed are idempotent and the seed file is current', async () => {
  await db.exec(MIGRATION);
  await db.exec(PROFILES);
  await db.exec(GYMS);
  await db.exec(PHOTOS);
  await db.exec(SEED);
  assert.equal(SEED, buildSeedSql(), 'run `npm run db:seed-sql` after editing the catalog');
  assert.equal(read('src', 'db', 'setup.sql'), buildSetupSql(), 'run `npm run db:setup-sql` after editing any SQL');

  // The one-paste bundle applies cleanly on top of everything as well.
  await db.exec(read('src', 'db', 'setup.sql'));

  const { rows } = await db.query(`select slug, status from public.schools where slug in ('umich', 'ohio-state') order by slug`);
  assert.deepEqual(rows, [
    { slug: 'ohio-state', status: 'coming_soon' },
    { slug: 'umich', status: 'live' },
  ]);
});

test('existing accounts are moved to Michigan and keep working', async () => {
  const { rows } = await as(LEGACY, `select u.school_id = s.id as is_umich, p.display_name
    from public.users u join public.schools s on s.slug = 'umich' join public.profiles p on p.id = u.id`);
  assert.deepEqual(rows, [{ is_umich: true, display_name: 'Legacy' }]);
  await as(LEGACY, `update public.users set log = '[]' where id = auth.uid()`);
});

test('new accounts require a .edu email', async () => {
  await rejects(db.query(`insert into auth.users (email) values ('someone@gmail.com')`), /\.edu email/);
  await rejects(db.query(`insert into auth.users (email) values ('sneaky@notedu.com')`), /\.edu email/);
  await rejects(db.query(`update auth.users set email = 'switch@gmail.com' where id = $1`, [LEGACY]), /\.edu email/);
  await db.query(`insert into auth.users (email) values ('fine@buckeyemail.osu.edu')`);
});

test('students can only join a live school that matches their email', async () => {
  await createStudent(ALEX, 'alex@umich.edu', 'Alex', 'umich');
  await createStudent(BLAKE, 'blake@umich.edu', 'Blake', 'umich');
  await createStudent(CASEY, 'casey@umich.edu', 'Casey', 'umich');

  await db.query('insert into auth.users (id, email) values ($1, $2)', [DREW, 'drew.1@buckeyemail.osu.edu']);
  await rejects(
    as(DREW, `insert into public.users (username, school_id) values ('Drew', (select id from public.schools where slug = 'umich'))`),
    /does not belong to the selected school/
  );
  await rejects(
    as(DREW, `insert into public.users (username, school_id) values ('Drew', (select id from public.schools where slug = 'ohio-state'))`),
    /not live at this school/
  );

  await db.query(`update public.schools set status = 'live' where slug = 'ohio-state'`);
  await as(DREW, `insert into public.users (username, school_id) values ('Drew', (select id from public.schools where slug = 'ohio-state'))`);

  await rejects(
    as(ALEX, `update public.users set school_id = (select id from public.schools where slug = 'ohio-state') where id = auth.uid()`),
    /does not belong to the selected school/
  );
});

test('menus are public to read and only the service role can write them', async () => {
  const umich = (await db.query(`select id from public.schools where slug = 'umich'`)).rows[0].id;
  const hall = (
    await asService(
      `insert into public.dining_halls (school_id, slug, name, latitude, longitude)
       values ($1, 'bursley', 'Bursley', $2, $3) returning id`,
      [umich, HALL.lat, HALL.lng]
    )
  ).rows[0].id;
  const item = (
    await asService(
      `insert into public.menu_items (hall_id, menu_date, name, subheader) values ($1, '2026-10-07', 'Oatmeal', 'Breakfast Bar') returning id`,
      [hall]
    )
  ).rows[0].id;
  await asService(`insert into public.menu_item_meals (menu_item_id, meal) values ($1, 'breakfast'), ($1, 'brunch')`, [item]);
  await asService(
    `insert into public.menu_item_nutrition (menu_item_id, nutrient_key, nutrient_value)
     values ($1, 'calories', '183'), ($1, 'protein', '6.5'), ($1, 'note', 'n/a')`,
    [item]
  );
  await asService(`insert into public.menu_item_allergens (menu_item_id, allergen) values ($1, 'oats')`, [item]);

  const { rows } = await as(null, `select name, meals, allergens, traits, nutrition_facts, menu_date::text
    from public.menu_items_flat where hall_id = $1 and menu_date = '2026-10-07' and meals @> array['breakfast']`, [hall]);
  assert.deepEqual(rows, [
    {
      name: 'Oatmeal',
      meals: ['breakfast', 'brunch'],
      allergens: ['oats'],
      traits: [],
      nutrition_facts: { calories: 183, protein: 6.5, note: 'n/a' },
      menu_date: '2026-10-07',
    },
  ]);

  await rejects(as(null, `insert into public.menu_items (hall_id, name) values ($1, 'Fake')`, [hall]), /row-level security/);
  const deleted = await as(ALEX, `delete from public.menu_items where id = $1 returning id`, [item]);
  assert.equal(deleted.rows.length, 0, 'students cannot delete menu items');
  assert.equal((await db.query(`select count(*)::int as n from public.menu_items where id = $1`, [item])).rows[0].n, 1);
});

test('profiles are visible to classmates but not other schools', async () => {
  const { rows: classmates } = await as(ALEX, `select display_name from public.profiles order by display_name`);
  assert.deepEqual(classmates.map((r) => r.display_name), ['Alex', 'Blake', 'Casey', 'Legacy']);

  const { rows: fromOhio } = await as(DREW, `select display_name from public.profiles order by display_name`);
  assert.deepEqual(fromOhio.map((r) => r.display_name), ['Drew']);

  const { rows: search } = await as(ALEX, `select display_name, friendship from public.search_classmates('bla')`);
  assert.deepEqual(search, [{ display_name: 'Blake', friendship: 'none' }]);

  await rejects(as(DREW, `select public.send_friend_request($1)`, [ALEX]), /not at your school/);
});

test('friend requests: request, mutual request accepts, private users table stays private', async () => {
  assert.equal((await as(ALEX, `select public.send_friend_request($1) as r`, [BLAKE])).rows[0].r, 'pending');
  assert.equal((await as(BLAKE, `select friendship from public.search_classmates('alex')`)).rows[0].friendship, 'incoming');
  assert.equal((await as(BLAKE, `select public.send_friend_request($1) as r`, [ALEX])).rows[0].r, 'accepted');

  const { rows } = await as(BLAKE, `select count(*)::int as n from public.users`);
  assert.equal(rows[0].n, 1, 'friends never see each other\'s food log or body stats');
});

test('presence: friends see your hall, nobody stores coordinates, ghost mode hides it', async () => {
  const near = await as(ALEX, `select hall_name from public.check_in($1, $2, 10)`, [HALL.lat + 0.0003, HALL.lng]);
  assert.deepEqual(near.rows, [{ hall_name: 'Bursley' }]);

  const columns = (await db.query(`select column_name from information_schema.columns where table_name = 'presence'`)).rows.map((r) => r.column_name);
  assert.deepEqual(columns.sort(), ['checked_in_at', 'expires_at', 'gym_id', 'hall_id', 'user_id'], 'no coordinates');

  const seenByBlake = await as(BLAKE, `select display_name, hall_name from public.get_friends_presence()`);
  assert.deepEqual(seenByBlake.rows, [{ display_name: 'Alex', hall_name: 'Bursley' }]);

  assert.deepEqual((await as(CASEY, `select * from public.get_friends_presence()`)).rows, []);
  assert.deepEqual((await as(CASEY, `select * from public.presence`)).rows, [], 'non-friends cannot read presence rows');

  await as(ALEX, `select public.set_ghost_mode(true)`);
  assert.deepEqual((await as(BLAKE, `select hall_name from public.get_friends_presence()`)).rows, [{ hall_name: null }]);
  const ghostCheckIn = await as(ALEX, `select hall_name from public.check_in($1, $2, 10)`, [HALL.lat, HALL.lng]);
  assert.deepEqual(ghostCheckIn.rows, [{ hall_name: 'Bursley' }], 'still told where they are');
  assert.deepEqual((await as(BLAKE, `select hall_name from public.get_friends_presence()`)).rows, [{ hall_name: null }]);
  await as(ALEX, `select public.set_ghost_mode(false)`);

  const far = await as(ALEX, `select hall_name from public.check_in($1, $2, 10)`, [HALL.lat + 0.01, HALL.lng]);
  assert.deepEqual(far.rows, []);
  assert.deepEqual((await as(BLAKE, `select hall_name from public.get_friends_presence()`)).rows, [{ hall_name: null }]);

  await as(ALEX, `select public.check_in_hall((select id from public.dining_halls where slug = 'bursley'))`);
  await db.query(`update public.presence set expires_at = now() - interval '1 minute' where user_id = $1`, [ALEX]);
  assert.deepEqual((await as(BLAKE, `select hall_name from public.get_friends_presence()`)).rows, [{ hall_name: null }], 'check-ins expire');

  await rejects(as(DREW, `select public.check_in_hall((select id from public.dining_halls where slug = 'bursley'))`), /not at your school/);
});

test('messages flow only between friends who have not blocked each other', async () => {
  await as(ALEX, `insert into public.messages (recipient_id, body) values ($1, 'Save me a seat?')`, [BLAKE]);
  await rejects(as(ALEX, `insert into public.messages (recipient_id, body) values ($1, 'hi')`, [CASEY]), /row-level security/);
  await rejects(as(ALEX, `insert into public.messages (sender_id, recipient_id, body) values ($1, $2, 'spoof')`, [BLAKE, ALEX]), /row-level security/);

  const inbox = await as(BLAKE, `select body, read_at from public.messages`);
  assert.deepEqual(inbox.rows, [{ body: 'Save me a seat?', read_at: null }]);
  assert.deepEqual((await as(CASEY, `select * from public.messages`)).rows, []);

  await as(BLAKE, `select public.mark_conversation_read($1)`, [ALEX]);
  assert.notEqual((await as(ALEX, `select read_at from public.messages`)).rows[0].read_at, null);

  await as(BLAKE, `insert into public.reports (reported_user_id, reason) values ($1, 'test report')`, [ALEX]);
  await as(BLAKE, `select public.block_user($1)`, [ALEX]);
  assert.equal((await db.query(`select public.are_friends($1, $2) as f`, [ALEX, BLAKE])).rows[0].f, false);
  await rejects(as(ALEX, `insert into public.messages (recipient_id, body) values ($1, 'hello?')`, [BLAKE]), /row-level security/);
  await rejects(as(ALEX, `select public.send_friend_request($1)`, [BLAKE]), /cannot send a request/);
  assert.deepEqual((await as(ALEX, `select * from public.search_classmates('blake')`)).rows, []);
});

test('anyone can join a school waitlist but nobody can read it', async () => {
  await as(null, `insert into public.school_requests (school_name, email) values ('Iowa State', 'cy@iastate.edu')`);
  await rejects(as(null, `insert into public.school_requests (school_name, email) values ('X', 'x@gmail.com')`), /check constraint|violates/);
  assert.deepEqual((await as(null, `select * from public.school_requests`)).rows, []);
});

test('AI quota and log reset are service-role only', async () => {
  await rejects(as(ALEX, `select public.consume_ai_quota($1, 100)`, [ALEX]), /permission denied/);
  await rejects(as(ALEX, `select public.reset_daily_logs()`), /permission denied/);

  const results = [];
  for (let i = 0; i < 3; i += 1) {
    results.push((await asService(`select public.consume_ai_quota($1, 2) as ok`, [ALEX])).rows[0].ok);
  }
  assert.deepEqual(results, [true, true, false]);
});

test('daily log reset happens once per campus-local day', async () => {
  await db.query(`update public.users set log = '[{"name":"Oatmeal"}]', last_log_reset_on = null where id = $1`, [ALEX]);

  await asService(`select public.reset_daily_logs()`);
  let row = (await db.query(`select log, last_log_reset_on is not null as stamped from public.users where id = $1`, [ALEX])).rows[0];
  assert.deepEqual(row, { log: [{ name: 'Oatmeal' }], stamped: true }, 'first sighting stamps without clearing');

  await db.query(`update public.users set last_log_reset_on = last_log_reset_on - 1 where id = $1`, [ALEX]);
  await asService(`select public.reset_daily_logs()`);
  row = (await db.query(`select log from public.users where id = $1`, [ALEX])).rows[0];
  assert.deepEqual(row.log, []);

  await db.query(`update public.users set log = '[{"name":"Toast"}]' where id = $1`, [ALEX]);
  await asService(`select public.reset_daily_logs()`);
  row = (await db.query(`select log from public.users where id = $1`, [ALEX])).rows[0];
  assert.deepEqual(row.log, [{ name: 'Toast' }], 'second run the same day leaves the log alone');
});

const EVE = '00000000-0000-0000-0000-000000000005'; // umich
const FRAN = '00000000-0000-0000-0000-000000000006'; // umich, Eve's friend
const GABE = '00000000-0000-0000-0000-000000000007'; // umich, not a friend

const EVE_LOG = [
  { name: 'Grilled Chicken', servings: 2, mealTime: 'dinner', baseNutrition: { calories: '210', protein: '40', total_carbohydrate: '1', total_fat: '4.5' } },
  { name: 'Rice', nutrition_facts: { calories: 200, protein: 4, total_carbohydrate: 44, total_fat: 0.5 } },
];

test('profiles: logs become history, visibility is enforced, profiles are editable', async () => {
  await createStudent(EVE, 'eve@umich.edu', 'Eve', 'umich');
  await createStudent(FRAN, 'fran@umich.edu', 'Fran', 'umich');
  await createStudent(GABE, 'gabe@umich.edu', 'Gabe', 'umich');
  await as(EVE, `select public.send_friend_request($1)`, [FRAN]);
  await as(FRAN, `select public.respond_friend_request($1, true)`, [EVE]);

  await as(EVE, `update public.users set log = $1 where id = auth.uid()`, [JSON.stringify(EVE_LOG)]);
  const own = await as(EVE, `select calories, protein::float, carbs::float, fat::float, entries from public.daily_logs`);
  assert.equal(own.rows.length, 1);
  assert.deepEqual(
    { calories: own.rows[0].calories, protein: own.rows[0].protein, carbs: own.rows[0].carbs, fat: own.rows[0].fat },
    { calories: 620, protein: 84, carbs: 46, fat: 9.5 }
  );
  assert.deepEqual(own.rows[0].entries[0], { name: 'Grilled Chicken', meal: 'dinner', servings: 2, calories: 420, protein: 80, carbs: 2, fat: 9 });

  // Friends see the log by default; classmates see the profile but not the food.
  assert.equal((await as(FRAN, `select count(*)::int as n from public.daily_logs where user_id = $1`, [EVE])).rows[0].n, 1);
  assert.equal((await as(GABE, `select count(*)::int as n from public.daily_logs where user_id = $1`, [EVE])).rows[0].n, 0);
  const gabeView = (await as(GABE, `select public.get_profile($1) as p`, [EVE])).rows[0].p;
  assert.equal(gabeView.display_name, 'Eve');
  assert.equal(gabeView.can_view_log, false);
  assert.equal(gabeView.stats, undefined);
  assert.equal(gabeView.log_visibility, null, 'only the owner sees their visibility setting');
  assert.deepEqual((await as(GABE, `select * from public.get_log_month($1, current_date)`, [EVE])).rows, []);
  assert.equal((await as(DREW, `select public.get_profile($1) as p`, [EVE])).rows[0].p, null, 'other schools see nothing');

  // History, streak and usuals.
  await db.query(
    `insert into public.daily_logs (user_id, day, entries, calories, protein)
     values ($1, public.user_today($1) - 1, '[{"name":"Rice","servings":1,"protein":4,"calories":200}]', 900, 60),
            ($1, public.user_today($1) - 2, '[{"name":"rice","servings":1,"protein":4,"calories":200}]', 1000, 70),
            ($1, public.user_today($1) - 5, '[{"name":"Oatmeal","servings":1,"protein":6,"calories":183}]', 500, 20)`,
    [EVE]
  );
  const franView = (await as(FRAN, `select public.get_profile($1) as p`, [EVE])).rows[0].p;
  assert.equal(franView.friendship, 'friends');
  assert.equal(franView.friend_count, 1);
  assert.deepEqual(franView.stats, { streak: 3, days_logged_30: 4, avg_calories_7: 755, avg_protein_7: 59 });
  assert.deepEqual(franView.usuals.map((u) => [u.name, u.times]), [['Rice', 3], ['Grilled Chicken', 1], ['Oatmeal', 1]]);
  assert.equal(franView.usuals.find((u) => u.name === 'Grilled Chicken').protein, 40, 'per serving');
  const month = await as(FRAN, `select count(*)::int as n from public.get_log_month($1, current_date)`, [EVE]);
  assert.ok(month.rows[0].n >= 1);

  // Editing: allowed columns only, validated.
  await as(EVE, `update public.profiles set username = 'Eve.Lifts', bio = '  PPL 6x/week ', avatar_emoji = '💪', accent_color = '#E53935', goal = 'bulk', class_year = 2028, log_visibility = 'everyone' where id = auth.uid()`);
  const edited = (await as(EVE, `select username, bio, goal from public.profiles where id = auth.uid()`)).rows[0];
  assert.deepEqual(edited, { username: 'eve.lifts', bio: 'PPL 6x/week', goal: 'bulk' });
  await rejects(as(EVE, `update public.profiles set school_id = null where id = auth.uid()`), /permission denied/);
  await rejects(as(EVE, `update public.profiles set share_presence = false where id = auth.uid()`), /permission denied/);
  await rejects(as(EVE, `update public.profiles set username = 'x' where id = auth.uid()`), /profiles_username_format/);
  await rejects(as(FRAN, `update public.profiles set username = 'EVE.LIFTS' where id = auth.uid()`), /idx_profiles_username|duplicate/);
  const fransRows = await as(FRAN, `update public.profiles set bio = 'hacked' where id = $1 returning id`, [EVE]);
  assert.equal(fransRows.rows.length, 0, "cannot edit someone else's profile");

  const osu = (await db.query(`select id from public.schools where slug = 'ohio-state'`)).rows[0].id;
  const osuHall = (await db.query(`insert into public.dining_halls (school_id, slug, name) values ($1, 'scott', 'Scott') returning id`, [osu])).rows[0].id;
  await rejects(as(EVE, `update public.profiles set favorite_hall_id = $1 where id = auth.uid()`, [osuHall]), /must be at your school/);
  await as(EVE, `update public.profiles set favorite_hall_id = (select id from public.dining_halls where slug = 'bursley') where id = auth.uid()`);

  // "Everyone at my school" opens the log to classmates.
  assert.equal((await as(GABE, `select public.get_profile($1) as p`, [EVE])).rows[0].p.can_view_log, true);
  assert.equal((await as(GABE, `select public.get_profile($1) as p`, [EVE])).rows[0].p.favorite_hall.name, 'Bursley');

  // Search by @username prefix or name; blocked people disappear.
  assert.deepEqual((await as(GABE, `select display_name, username, friendship from public.search_people('@eve')`)).rows, [
    { display_name: 'Eve', username: 'eve.lifts', friendship: 'none' },
  ]);
  await as(EVE, `select public.block_user($1)`, [GABE]);
  assert.deepEqual((await as(GABE, `select * from public.search_people('eve')`)).rows, []);
  assert.equal((await as(GABE, `select public.get_profile($1) as p`, [EVE])).rows[0].p, null);

  // Clearing the log removes today's entry but keeps history.
  await as(EVE, `update public.users set log = '[]' where id = auth.uid()`);
  assert.equal((await as(EVE, `select count(*)::int as n from public.daily_logs`)).rows[0].n, 3);
});

const HANK = '00000000-0000-0000-0000-000000000008'; // umich
const IVY = '00000000-0000-0000-0000-000000000009'; // umich, Hank's friend
const JO = '00000000-0000-0000-0000-00000000000b';
const KAI = '00000000-0000-0000-0000-00000000000c';
const GYM = { lat: 42.2752, lng: -83.736 }; // test coordinates only

test('gyms: opt-in tracking, visits, friends at the gym, crowd threshold', async () => {
  for (const [id, email, name] of [[HANK, 'hank@umich.edu', 'Hank'], [IVY, 'ivy@umich.edu', 'Ivy'], [JO, 'jo@umich.edu', 'Jo'], [KAI, 'kai@umich.edu', 'Kai']]) {
    await createStudent(id, email, name, 'umich');
  }
  await as(HANK, `select public.send_friend_request($1)`, [IVY]);
  await as(IVY, `select public.respond_friend_request($1, true)`, [HANK]);
  await db.query(`update public.gym_facilities set latitude = $1, longitude = $2 where slug = 'ccrb'`, [GYM.lat, GYM.lng]);
  const gymId = (await db.query(`select id from public.gym_facilities where slug = 'ccrb'`)).rows[0].id;

  // Gym location is off by default: the gym is not detected or recorded.
  assert.deepEqual((await as(HANK, `select * from public.check_in_place($1, $2, 10)`, [GYM.lat, GYM.lng])).rows, []);
  await as(HANK, `select public.check_in_gym($1)`, [gymId]);
  assert.equal((await db.query(`select count(*)::int as n from public.gym_sessions where user_id = $1`, [HANK])).rows[0].n, 0);

  await as(HANK, `select public.set_location_sharing(true, true)`);
  const atGym = await as(HANK, `select place_type, place_name from public.check_in_place($1, $2, 10)`, [GYM.lat + 0.0002, GYM.lng]);
  assert.deepEqual(atGym.rows, [{ place_type: 'gym', place_name: 'Central Campus Recreation Building' }]);
  await as(HANK, `select * from public.check_in_place($1, $2, 10)`, [GYM.lat, GYM.lng]);
  assert.equal((await db.query(`select count(*)::int as n from public.gym_sessions where user_id = $1 and ended_at is null`, [HANK])).rows[0].n, 1, 'same visit continues');

  const ivySees = await as(IVY, `select display_name, gym_name, hall_name from public.get_friends_presence()`);
  assert.deepEqual(ivySees.rows, [{ display_name: 'Hank', gym_name: 'Central Campus Recreation Building', hall_name: null }]);

  // Crowd counts appear only from 3 people; friends are listed by name.
  let overview = (await as(IVY, `select * from public.gym_overview_safe() where gym_id = $1`, [gymId])).rows[0];
  assert.equal(overview.students_here, null);
  assert.deepEqual(overview.friends_here, ['Hank']);
  for (const id of [JO, KAI]) {
    await as(id, `select public.set_location_sharing(true, true)`);
    await as(id, `select public.check_in_gym($1)`, [gymId]);
  }
  overview = (await as(IVY, `select * from public.gym_overview_safe() where gym_id = $1`, [gymId])).rows[0];
  assert.equal(overview.students_here, 3);
  assert.deepEqual(overview.friends_here, ['Hank'], 'non-friends are counted, never named');

  // Walking into a dining hall ends the gym visit.
  const atHall = await as(HANK, `select place_type, place_name from public.check_in_place($1, $2, 10)`, [HALL.lat, HALL.lng]);
  assert.deepEqual(atHall.rows, [{ place_type: 'hall', place_name: 'Bursley' }]);
  assert.equal((await db.query(`select count(*)::int as n from public.gym_sessions where user_id = $1 and ended_at is null`, [HANK])).rows[0].n, 0);

  // The older hall check-ins also end a gym visit instead of colliding with it.
  await as(KAI, `select public.check_in_hall((select id from public.dining_halls where slug = 'bursley'))`);
  assert.deepEqual(
    (await db.query(`select hall_id is not null as at_hall, gym_id from public.presence where user_id = $1`, [KAI])).rows,
    [{ at_hall: true, gym_id: null }]
  );
  assert.equal((await db.query(`select count(*)::int as n from public.gym_sessions where user_id = $1 and ended_at is null`, [KAI])).rows[0].n, 0);
  await as(KAI, `select public.check_in_gym($1)`, [gymId]);
  await as(KAI, `select * from public.check_in($1, $2, 10)`, [HALL.lat, HALL.lng]);
  assert.equal((await db.query(`select count(*)::int as n from public.presence where user_id = $1 and gym_id is null`, [KAI])).rows[0].n, 1);
  await as(KAI, `select public.check_in_gym($1)`, [gymId]);

  // Turning gym location off hides and stops tracking; dining stays on.
  await as(JO, `select public.set_location_sharing(true, false)`);
  assert.deepEqual((await as(JO, `select * from public.check_in_place($1, $2, 10)`, [GYM.lat, GYM.lng])).rows, []);
  assert.equal((await db.query(`select count(*)::int as n from public.presence where user_id = $1`, [JO])).rows[0].n, 0);

  // Geofence exit only leaves the matching place.
  await as(KAI, `select public.leave_place('hall', $1)`, [gymId]);
  assert.equal((await db.query(`select count(*)::int as n from public.presence where user_id = $1`, [KAI])).rows[0].n, 1);
  await as(KAI, `select public.leave_place('gym', $1)`, [gymId]);
  assert.equal((await db.query(`select count(*)::int as n from public.presence where user_id = $1`, [KAI])).rows[0].n, 0);

  // Profile gym stats (friends can see; 10+ minute visits count as gym days).
  await db.query(`delete from public.gym_sessions where user_id = $1`, [HANK]);
  await db.query(
    `insert into public.gym_sessions (user_id, gym_id, started_at, ended_at) values
       ($1, $2, now() - interval '1 day', now() - interval '1 day' + interval '75 minutes'),
       ($1, $2, now() - interval '3 days', now() - interval '3 days' + interval '45 minutes'),
       ($1, $2, now() - interval '4 days', now() - interval '4 days' + interval '5 minutes'),
       ($1, $2, now() - interval '20 days', now() - interval '20 days' + interval '60 minutes')`,
    [HANK, gymId]
  );
  await as(HANK, `select public.check_in_gym($1)`, [gymId]);
  const gymStats = (await as(IVY, `select public.get_profile($1) as p`, [HANK])).rows[0].p.gym;
  assert.equal(gymStats.at_gym_now, 'Central Campus Recreation Building');
  assert.equal(gymStats.gym_days_7, 2);
  assert.equal(gymStats.gym_days_30, 3);
  assert.equal(gymStats.gym_minutes_7, 125);
  assert.equal((await as(IVY, `select public.get_profile($1) as p`, [JO])).rows[0].p.gym, undefined, 'not friends: no log, no gym');
  await as(HANK, `select public.set_location_sharing(true, false)`);
  assert.equal((await as(IVY, `select public.get_profile($1) as p`, [HANK])).rows[0].p.gym, null, 'gym location off hides gym stats');
});

test('favorite dishes: private hearts matched to today\'s menus', async () => {
  const hall = (await db.query(`select id from public.dining_halls where slug = 'bursley'`)).rows[0].id;
  const item = (
    await asService(
      `insert into public.menu_items (hall_id, menu_date, name, subheader) values ($1, public.user_today($2), 'Grilled Chicken', 'Grill') returning id`,
      [hall, HANK]
    )
  ).rows[0].id;
  await asService(`insert into public.menu_item_meals (menu_item_id, meal) values ($1, 'dinner')`, [item]);
  await asService(`insert into public.menu_item_nutrition (menu_item_id, nutrient_key, nutrient_value) values ($1, 'calories', '210'), ($1, 'protein', '40')`, [item]);

  await as(HANK, `insert into public.favorite_dishes (dish_name) values ('  grilled CHICKEN '), ('Pad Thai')`);
  await rejects(as(HANK, `insert into public.favorite_dishes (dish_name) values ('Grilled Chicken')`), /duplicate|favorite_dishes_pkey/);

  const onMenu = await as(HANK, `select dish_name, hall_name, meals, calories::float, protein::float from public.favorites_on_menu()`);
  assert.deepEqual(onMenu.rows, [{ dish_name: 'Grilled Chicken', hall_name: 'Bursley', meals: ['dinner'], calories: 210, protein: 40 }]);

  assert.deepEqual((await as(IVY, `select * from public.favorite_dishes`)).rows, [], 'hearts are private rows');
  const profile = (await as(IVY, `select public.get_profile($1) as p`, [HANK])).rows[0].p;
  assert.deepEqual([...profile.favorites].sort(), ['  grilled CHICKEN ', 'Pad Thai'].sort());
});

test('schools carry their colors and profile photos stay in the owner folder', async () => {
  const { rows: [umich] } = await as(ALEX, "select primary_color, secondary_color from public.schools where slug = 'umich'");
  assert.deepEqual(umich, { primary_color: '#00274C', secondary_color: '#FFCB05' });
  await rejects(asService("update public.schools set primary_color = 'blue' where slug = 'umich'"), /schools_color_format/);

  // The profile stores a path inside the owner's folder, never a URL.
  await as(ALEX, `update public.profiles set avatar_path = '${ALEX}/a1b2c3.jpg' where id = $1`, [ALEX]);
  await rejects(as(ALEX, `update public.profiles set avatar_path = '${BLAKE}/stolen.jpg' where id = $1`, [ALEX]), /profiles_avatar_path_format/);
  await rejects(as(ALEX, "update public.profiles set avatar_path = 'https://evil.example/x.jpg' where id = $1", [ALEX]), /profiles_avatar_path_format/);

  // Storage: you can upload into your own folder only.
  await as(ALEX, `insert into storage.objects (bucket_id, name) values ('avatars', '${ALEX}/a1b2c3.jpg')`);
  await rejects(as(ALEX, `insert into storage.objects (bucket_id, name) values ('avatars', '${BLAKE}/x.jpg')`), /row-level security/);
  const { rows: [bucket] } = await asService("select public, file_size_limit from storage.buckets where id = 'avatars'");
  assert.equal(bucket.public, true);

  // Classmates see the photo through the profile and search (Blake blocked
  // Alex in an earlier test, so Casey looks).
  const { rows: [{ get_profile: profile }] } = await as(CASEY, 'select public.get_profile($1)', [ALEX]);
  assert.equal(profile.avatar_path, `${ALEX}/a1b2c3.jpg`);
  const { rows: found } = await as(CASEY, "select id, avatar_path from public.search_people('alex')");
  assert.equal(found.find((p) => p.id === ALEX)?.avatar_path, `${ALEX}/a1b2c3.jpg`);

  await as(ALEX, 'update public.profiles set avatar_path = null where id = $1', [ALEX]);
});
