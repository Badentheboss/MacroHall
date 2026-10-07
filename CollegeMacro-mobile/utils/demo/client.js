// An in-memory stand-in for the Supabase client, used in demo mode so every
// screen works on localhost without a Supabase project. It covers the query
// builder calls, RPCs and auth methods the app uses; data resets on reload.
import { ME, campusDate, createSeed } from './data';

const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: { message } });

// Embedded relations used in selects, e.g. presence -> dining_halls(name).
const RELATIONS = {
  dining_halls: { table: 'dining_halls', key: 'hall_id' },
  gym_facilities: { table: 'gym_facilities', key: 'gym_id' },
};

const parseValue = (raw) => {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
};

const same = (a, b) => a === b || String(a) === String(b);

// Parses PostgREST `or` filters like
// "and(sender_id.eq.a,recipient_id.eq.b),and(sender_id.eq.b,recipient_id.eq.a)".
function parseOr(expression) {
  const groups = [];
  let depth = 0;
  let current = '';
  for (const char of expression) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      groups.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) groups.push(current);

  const condition = (text) => {
    const [column, op, ...rest] = text.split('.');
    const value = parseValue(rest.join('.'));
    if (op === 'eq') return (row) => same(row[column], value);
    if (op === 'ilike') return (row) => new RegExp(String(value).replace(/%/g, '.*'), 'i').test(row[column] || '');
    return () => true;
  };

  const predicates = groups.map((group) => {
    const match = group.match(/^and\((.*)\)$/);
    const parts = match ? match[1].split(',').map(condition) : [condition(group)];
    return (row) => parts.every((p) => p(row));
  });
  return (row) => predicates.some((p) => p(row));
}

function selectColumns(db, rows, columns) {
  const embeds = [...(columns || '').matchAll(/(\w+)\(([^)]*)\)/g)];
  if (embeds.length === 0) return rows.map((row) => ({ ...row }));
  return rows.map((row) => {
    const result = { ...row };
    for (const [, name] of embeds) {
      const relation = RELATIONS[name];
      if (!relation) continue;
      result[name] = db[relation.table].find((r) => same(r.id, row[relation.key])) || null;
    }
    return result;
  });
}

class Query {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.action = 'select';
    this.filters = [];
    this.columns = '*';
    this.returning = false;
    this.ordering = [];
    this.max = null;
    this.offset = 0;
    this.mode = 'many';
  }

  select(columns = '*') {
    if (this.action === 'select') this.columns = columns;
    else this.returning = true;
    return this;
  }

  insert(values) {
    this.action = 'insert';
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values) {
    this.action = 'upsert';
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values) {
    this.action = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push((row) => same(row[column], value));
    return this;
  }

  neq(column, value) {
    this.filters.push((row) => !same(row[column], value));
    return this;
  }

  in(column, values) {
    this.filters.push((row) => values.some((value) => same(row[column], value)));
    return this;
  }

  is(column, value) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  not(column, op, value) {
    if (op === 'is') this.filters.push((row) => (row[column] ?? null) !== value);
    else if (op === 'eq') this.filters.push((row) => !same(row[column], value));
    return this;
  }

  contains(column, values) {
    this.filters.push((row) => values.every((value) => (row[column] || []).includes(value)));
    return this;
  }

  ilike(column, pattern) {
    const regex = new RegExp(`^${String(pattern).replace(/%/g, '.*')}$`, 'i');
    this.filters.push((row) => regex.test(row[column] || ''));
    return this;
  }

  or(expression) {
    this.filters.push(parseOr(expression));
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.ordering.push({ column, ascending });
    return this;
  }

  limit(count) {
    this.max = count;
    return this;
  }

  range(from, to) {
    this.offset = from;
    this.max = to - from + 1;
    return this;
  }

  single() {
    this.mode = 'single';
    return this;
  }

  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject);
  }

  rows() {
    return this.client.tableRows(this.table).filter((row) => this.client.visible(this.table, row) && this.filters.every((f) => f(row)));
  }

  run() {
    const db = this.client.db;
    if (!db[this.table]) db[this.table] = [];
    let result;

    if (this.action === 'select') {
      result = this.rows();
      for (const { column, ascending } of [...this.ordering].reverse()) {
        result = [...result].sort((a, b) => {
          const x = a[column];
          const y = b[column];
          if (x === y) return 0;
          return (x > y ? 1 : -1) * (ascending ? 1 : -1);
        });
      }
      result = result.slice(this.offset, this.max == null ? undefined : this.offset + this.max);
      result = selectColumns(db, result, this.columns);
    } else if (this.action === 'insert' || this.action === 'upsert') {
      result = [];
      for (const value of this.values) {
        const row = this.client.withDefaults(this.table, value);
        const existing = this.action === 'upsert' && db[this.table].find((r) => row.id != null && same(r.id, row.id));
        if (existing) {
          Object.assign(existing, value);
          result.push(existing);
          continue;
        }
        if (this.table === 'favorite_dishes' && db.favorite_dishes.some((r) => r.user_id === row.user_id && r.dish_key === row.dish_key)) {
          return fail('duplicate key value violates unique constraint "favorite_dishes_pkey"');
        }
        db[this.table].push(row);
        result.push(row);
        this.client.afterInsert(this.table, row);
      }
    } else if (this.action === 'update') {
      result = this.rows();
      for (const row of result) Object.assign(row, this.values);
    } else {
      result = this.rows();
      db[this.table] = db[this.table].filter((row) => !result.includes(row));
    }

    if (this.action !== 'select' && !this.returning) return ok(null);
    if (this.mode === 'many') return ok(result);
    if (result.length === 0) return this.mode === 'maybe' ? ok(null) : fail('JSON object requested, multiple (or no) rows returned');
    return ok({ ...result[0] });
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const chunk = (a << 16) | (b << 8) | c;
    out += B64[(chunk >> 18) & 63] + B64[(chunk >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(chunk >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[chunk & 63] : '=';
  }
  return out;
}

export function createDemoClient() {
  const db = createSeed();
  const user = { id: ME, email: 'demo@umich.edu', user_metadata: { username: 'demo_wolverine', school_id: 1 } };
  const session = { access_token: 'demo-token', user };
  const listeners = [];
  const authListeners = [];
  let signedIn = true;
  const photos = new Map();
  let nextId = 1000;

  const profileOf = (id) => db.profiles.find((p) => p.id === id);
  const hallOf = (id) => db.dining_halls.find((h) => h.id === id);
  const gymOf = (id) => db.gym_facilities.find((g) => g.id === id);
  const isLive = (presence) => presence && new Date(presence.expires_at) > new Date();
  const myPresence = () => db.presence.find((p) => p.user_id === ME);

  const friendship = (other) => {
    if (other === ME) return 'self';
    const row = db.friendships.find(
      (f) => (f.requester_id === ME && f.addressee_id === other) || (f.requester_id === other && f.addressee_id === ME)
    );
    if (!row) return 'none';
    if (row.status === 'accepted') return 'friends';
    return row.requester_id === ME ? 'requested' : 'incoming';
  };
  const friendIds = () => db.profiles.map((p) => p.id).filter((id) => friendship(id) === 'friends');

  // Today's totals come from the live log so the calendar matches the dashboard.
  const todayLog = () => {
    const log = db.users.find((u) => u.id === ME)?.log || [];
    if (log.length === 0) return null;
    const sum = (key) => log.reduce((total, e) => total + Number(e.nutrition_facts?.[key] || 0), 0);
    return {
      user_id: ME,
      day: campusDate(0),
      entries: log.map((e) => ({
        name: e.name,
        meal: e.mealTime,
        servings: e.servings || 1,
        calories: Math.round(Number(e.nutrition_facts?.calories || 0)),
        protein: Number(e.nutrition_facts?.protein || 0),
        carbs: Number(e.nutrition_facts?.total_carbohydrate || 0),
        fat: Number(e.nutrition_facts?.total_fat || 0),
      })),
      calories: Math.round(sum('calories')),
      protein: sum('protein'),
      carbs: sum('total_carbohydrate'),
      fat: sum('total_fat'),
    };
  };
  const logsFor = (userId) => {
    const past = db.daily_logs.filter((d) => d.user_id === userId);
    const today = userId === ME ? todayLog() : null;
    return today ? [...past, today] : past;
  };

  const checkIn = (place) => {
    db.presence = db.presence.filter((p) => p.user_id !== ME);
    db.presence.push({
      user_id: ME,
      hall_id: place.hall_id ?? null,
      gym_id: place.gym_id ?? null,
      checked_in_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (place.gym_id ? 120 : 60) * 60000).toISOString(),
    });
    return ok(
      place.gym_id
        ? [{ place_type: 'gym', place_id: place.gym_id, place_name: gymOf(place.gym_id)?.name }]
        : [{ place_type: 'hall', place_id: place.hall_id, place_name: hallOf(place.hall_id)?.name }]
    );
  };

  const usualsFor = (userId) => {
    const counts = new Map();
    for (const day of logsFor(userId).filter((d) => d.day > campusDate(-30))) {
      for (const entry of day.entries) {
        const key = entry.name.toLowerCase();
        const current = counts.get(key) || { name: entry.name, times: 0, protein: 0, calories: 0 };
        const servings = Math.max(entry.servings || 1, 1);
        current.times++;
        current.protein += (entry.protein || 0) / servings;
        current.calories += (entry.calories || 0) / servings;
        counts.set(key, current);
      }
    }
    return [...counts.values()]
      .map((u) => ({ ...u, protein: Math.round(u.protein / u.times), calories: Math.round(u.calories / u.times) }))
      .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name))
      .slice(0, 8);
  };

  const streak = (userId) => {
    const days = new Set(logsFor(userId).map((d) => d.day));
    let count = 0;
    let offset = days.has(campusDate(0)) ? 0 : 1;
    while (days.has(campusDate(-offset))) {
      count++;
      offset++;
    }
    return count;
  };

  const rpcs = {
    get_profile: ({ p_user }) => {
      const profile = profileOf(p_user);
      if (!profile) return ok(null);
      const relation = friendship(p_user);
      const canViewLog = p_user === ME || profile.log_visibility === 'everyone' || (profile.log_visibility === 'friends' && relation === 'friends');
      const logs = logsFor(p_user);
      const recent = (days) => logs.filter((d) => d.day > campusDate(-days));
      const average = (rows, key) => (rows.length ? Math.round(rows.reduce((t, r) => t + Number(r[key]), 0) / rows.length) : null);
      const gym = db.gym_sessions.find((g) => g.user_id === p_user);
      const presence = db.presence.find((p) => p.user_id === p_user && isLive(p) && p.gym_id);
      const result = {
        id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
        bio: profile.bio,
        avatar_emoji: profile.avatar_emoji,
        avatar_path: profile.avatar_path,
        accent_color: profile.accent_color,
        goal: profile.goal,
        class_year: profile.class_year,
        school: 'Michigan',
        favorite_hall: profile.favorite_hall_id ? { id: profile.favorite_hall_id, name: hallOf(profile.favorite_hall_id)?.name } : null,
        friendship: relation,
        friend_count: db.friendships.filter((f) => f.status === 'accepted' && (f.requester_id === p_user || f.addressee_id === p_user)).length,
        log_visibility: p_user === ME ? profile.log_visibility : null,
        share_dining: p_user === ME ? profile.share_presence : null,
        track_gym: p_user === ME ? profile.track_gym : null,
        can_view_log: canViewLog,
        today: campusDate(0),
      };
      if (!canViewLog) return ok(result);
      return ok({
        ...result,
        stats: {
          streak: streak(p_user),
          days_logged_30: recent(30).length,
          avg_calories_7: average(recent(7), 'calories'),
          avg_protein_7: average(recent(7), 'protein'),
        },
        usuals: usualsFor(p_user),
        favorites: db.favorite_dishes.filter((f) => f.user_id === p_user).map((f) => f.dish_name).reverse(),
        gym:
          profile.track_gym && gym
            ? {
                at_gym_now: presence ? gymOf(presence.gym_id)?.name : null,
                gym_days_7: gym.days_7,
                gym_minutes_7: gym.minutes_7,
                gym_days_30: gym.days_30,
                last_visit: presence ? presence.checked_in_at : gym.last_visit,
              }
            : null,
      });
    },

    get_log_month: ({ p_user, p_month }) => {
      const prefix = p_month.slice(0, 7);
      return ok(
        logsFor(p_user)
          .filter((d) => d.day.startsWith(prefix))
          .map((d) => ({ day: d.day, calories: d.calories, protein: d.protein, carbs: d.carbs, fat: d.fat, items: d.entries.length }))
      );
    },

    search_people: ({ p_query }) => {
      const query = (p_query || '').trim().toLowerCase().replace(/^@/, '');
      if (query.length < 2) return ok([]);
      return ok(
        db.profiles
          .filter((p) => p.id !== ME && (p.display_name.toLowerCase().includes(query) || p.username.toLowerCase().includes(query)))
          .map(({ id, display_name, username, avatar_emoji, avatar_path, accent_color, goal }) => ({ id, display_name, username, avatar_emoji, avatar_path, accent_color, goal, friendship: friendship(id) }))
      );
    },

    get_friends_presence: () =>
      ok(
        friendIds().map((id) => {
          const presence = db.presence.find((p) => p.user_id === id && isLive(p));
          const profile = profileOf(id);
          const showHall = presence?.hall_id && profile.share_presence;
          const showGym = presence?.gym_id && profile.track_gym;
          return {
            friend_id: id,
            display_name: profile.display_name,
            hall_id: showHall ? presence.hall_id : null,
            hall_name: showHall ? hallOf(presence.hall_id)?.name : null,
            checked_in_at: showHall || showGym ? presence.checked_in_at : null,
            gym_id: showGym ? presence.gym_id : null,
            gym_name: showGym ? gymOf(presence.gym_id)?.name : null,
          };
        })
      ),

    send_friend_request: ({ p_target }) => {
      const state = friendship(p_target);
      if (state === 'incoming') return rpcs.respond_friend_request({ p_requester: p_target, p_accept: true });
      if (state === 'none') db.friendships.push({ requester_id: ME, addressee_id: p_target, status: 'pending' });
      return ok(null);
    },

    respond_friend_request: ({ p_requester, p_accept }) => {
      const row = db.friendships.find((f) => f.requester_id === p_requester && f.addressee_id === ME);
      if (!row) return fail('No pending request.');
      if (p_accept) row.status = 'accepted';
      else db.friendships = db.friendships.filter((f) => f !== row);
      return ok(null);
    },

    remove_friend: ({ p_other }) => {
      db.friendships = db.friendships.filter((f) => !((f.requester_id === ME && f.addressee_id === p_other) || (f.requester_id === p_other && f.addressee_id === ME)));
      return ok(null);
    },

    block_user: ({ p_target }) => rpcs.remove_friend({ p_other: p_target }),

    check_in_hall: ({ p_hall_id }) => checkIn({ hall_id: p_hall_id }),
    check_in_gym: ({ p_gym_id }) => checkIn({ gym_id: p_gym_id }),
    // Browsers in demo mode aren't on campus, so "use my location" picks a gym.
    check_in_place: () => (profileOf(ME).track_gym ? checkIn({ gym_id: 1 }) : checkIn({ hall_id: 5 })),

    check_out: () => {
      db.presence = db.presence.filter((p) => p.user_id !== ME);
      return ok(null);
    },

    leave_place: ({ p_type, p_id }) => {
      const presence = myPresence();
      if (presence && same(p_type === 'gym' ? presence.gym_id : presence.hall_id, p_id)) rpcs.check_out();
      return ok(null);
    },

    set_location_sharing: ({ p_dining, p_gym }) => {
      Object.assign(profileOf(ME), { share_presence: p_dining, track_gym: p_gym });
      const presence = myPresence();
      if (presence && ((presence.hall_id && !p_dining) || (presence.gym_id && !p_gym))) rpcs.check_out();
      return ok(null);
    },

    mark_conversation_read: ({ p_other }) => {
      for (const m of db.messages) if (m.sender_id === p_other && m.recipient_id === ME && !m.read_at) m.read_at = new Date().toISOString();
      return ok(null);
    },

    favorites_on_menu: () => {
      const keys = new Set(db.favorite_dishes.filter((f) => f.user_id === ME).map((f) => f.dish_key));
      const rows = new Map();
      for (const item of db.menu_items_flat) {
        if (!keys.has(item.name.trim().toLowerCase())) continue;
        const key = `${item.menu_date}|${item.hall_id}|${item.name}`;
        const row = rows.get(key) || {
          day: item.menu_date,
          dish_name: item.name,
          hall_id: item.hall_id,
          hall_name: item.hall_name,
          meals: [],
          calories: item.nutrition_facts.calories,
          protein: item.nutrition_facts.protein,
        };
        row.meals = [...new Set([...row.meals, ...item.meals])];
        rows.set(key, row);
      }
      return ok([...rows.values()].sort((a, b) => a.day.localeCompare(b.day) || a.hall_name.localeCompare(b.hall_name)));
    },

    gym_overview_safe: () => {
      const base = { 1: 34, 2: 12, 3: 7 };
      return ok(
        db.gym_facilities.map((gym) => {
          const here = db.presence.filter((p) => isLive(p) && p.gym_id === gym.id);
          return {
            gym_id: gym.id,
            gym_name: gym.name,
            has_geofence: false,
            students_here: base[gym.id] + here.length,
            friends_here: here.filter((p) => friendIds().includes(p.user_id)).map((p) => profileOf(p.user_id).display_name.split(' ')[0]),
          };
        })
      );
    },
  };

  const client = {
    db,

    // daily_logs gets today's row from the live log, like the real trigger.
    tableRows(table) {
      if (table !== 'daily_logs') return db[table] || [];
      const today = todayLog();
      return today ? [...db.daily_logs, today] : db.daily_logs;
    },

    // Row-level security, roughly: you see your own rows and public ones.
    visible(table, row) {
      if (table === 'favorite_dishes') return row.user_id === ME;
      if (table === 'messages') return row.sender_id === ME || row.recipient_id === ME;
      return true;
    },

    withDefaults(table, value) {
      const now = new Date().toISOString();
      if (table === 'favorite_dishes') return { user_id: ME, created_at: now, ...value, dish_key: value.dish_name.trim().toLowerCase() };
      if (table === 'messages') return { id: nextId++, sender_id: ME, created_at: now, read_at: null, ...value };
      if (table === 'users') return { id: ME, ...value };
      return { id: nextId++, created_at: now, ...value };
    },

    // Friends text back in the demo, through the same realtime channel the
    // conversation screen listens on.
    afterInsert(table, row) {
      if (table !== 'messages' || row.sender_id !== ME) return;
      const replies = ['Bet 👍', 'On my way!', "Save me a seat, I'm 5 min out", 'Lol yes', 'What macros you at today?'];
      setTimeout(() => {
        const reply = {
          id: nextId++,
          sender_id: row.recipient_id,
          recipient_id: ME,
          body: replies[Math.floor(Math.random() * replies.length)],
          created_at: new Date().toISOString(),
          read_at: null,
        };
        db.messages.push(reply);
        for (const listener of listeners) listener({ new: reply });
      }, 1500);
    },

    from(table) {
      return new Query(client, table);
    },

    async rpc(name, args = {}) {
      const handler = rpcs[name];
      if (!handler) return fail(`Demo mode doesn't implement ${name}.`);
      return handler(args);
    },

    // Profile photos stay in memory as data URLs.
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({ data: { publicUrl: photos.get(path) || null } }),
        upload: async (path, bytes, { contentType = 'image/jpeg' } = {}) => {
          photos.set(path, `data:${contentType};base64,${bytesToBase64(bytes)}`);
          return ok({ path });
        },
        remove: async (paths) => {
          for (const path of paths) photos.delete(path);
          return ok([]);
        },
        list: async (folder) => ok([...photos.keys()].filter((p) => p.startsWith(`${folder}/`)).map((p) => ({ name: p.split('/')[1] }))),
      }),
    },

    channel() {
      const channel = {
        on(_type, _filter, callback) {
          channel.callback = callback;
          listeners.push(callback);
          return channel;
        },
        subscribe() {
          return channel;
        },
      };
      return channel;
    },

    removeChannel(channel) {
      const index = listeners.indexOf(channel?.callback);
      if (index >= 0) listeners.splice(index, 1);
      return Promise.resolve('ok');
    },

    auth: {
      getUser: async () => ok({ user: signedIn ? user : null }),
      getSession: async () => ok({ session: signedIn ? session : null }),
      signInWithPassword: async () => {
        signedIn = true;
        authListeners.forEach((listener) => listener('SIGNED_IN', session));
        return ok({ user, session });
      },
      signUp: async () => ok({ user, session: null }),
      verifyOtp: async () => {
        signedIn = true;
        return ok({ user, session });
      },
      resend: async () => ok({}),
      resetPasswordForEmail: async () => ok({}),
      signOut: async () => {
        signedIn = false;
        authListeners.forEach((listener) => listener('SIGNED_OUT', null));
        return { error: null };
      },
      onAuthStateChange: (listener) => {
        authListeners.push(listener);
        return { data: { subscription: { unsubscribe: () => authListeners.splice(authListeners.indexOf(listener), 1) } } };
      },
    },
  };

  return client;
}
