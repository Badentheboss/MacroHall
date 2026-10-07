// Runs the real migrations in PGlite (Postgres compiled to WASM) against a
// Supabase-like shim, then exercises the triggers, RLS policies and RPCs the
// mobile app relies on, acting as different users.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildSeedSql } = require('../src/cli/buildSeed');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

const SHIM = read('tests', 'sql', 'supabase-shim.sql');
const SCHEMA = read('src', 'db', 'schema.sql');
const MIGRATION = read('src', 'db', 'migrations', '002_multi_school_social.sql');
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
  await db.exec(SEED);
});

test.after(async () => {
  await db.close();
});

test('migration and seed are idempotent and the seed file is current', async () => {
  await db.exec(MIGRATION);
  await db.exec(SEED);
  assert.equal(SEED, buildSeedSql(), 'run `npm run db:seed-sql` after editing the catalog');

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
  assert.deepEqual(columns.sort(), ['checked_in_at', 'expires_at', 'hall_id', 'user_id']);

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
