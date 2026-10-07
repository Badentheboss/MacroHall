// Sample data for demo mode: one school (Michigan), its dining halls and gyms,
// a few classmates, and two days of menus. Everything is made up.

export const TIMEZONE = 'America/Detroit';

export const ME = 'demo-user-0000';

const pad = (n) => String(n).padStart(2, '0');

// YYYY-MM-DD in the campus time zone, `offset` days from today.
export function campusDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

const SCHOOLS = [
  { id: 1, slug: 'umich', name: 'University of Michigan', short_name: 'Michigan', email_domains: ['umich.edu'], timezone: TIMEZONE, status: 'live', city: 'Ann Arbor', state: 'MI' },
  { id: 2, slug: 'ohio-state', name: 'The Ohio State University', short_name: 'Ohio State', email_domains: ['osu.edu'], timezone: 'America/New_York', status: 'live', city: 'Columbus', state: 'OH' },
  { id: 3, slug: 'purdue', name: 'Purdue University', short_name: 'Purdue', email_domains: ['purdue.edu'], timezone: 'America/Indiana/Indianapolis', status: 'live', city: 'West Lafayette', state: 'IN' },
  { id: 4, slug: 'texas-am', name: 'Texas A&M University', short_name: 'Texas A&M', email_domains: ['tamu.edu'], timezone: 'America/Chicago', status: 'coming_soon', city: 'College Station', state: 'TX' },
  { id: 5, slug: 'pitt', name: 'University of Pittsburgh', short_name: 'Pitt', email_domains: ['pitt.edu'], timezone: 'America/New_York', status: 'coming_soon', city: 'Pittsburgh', state: 'PA' },
];

const HALLS = [
  { id: 1, slug: 'bursley', name: 'Bursley' },
  { id: 2, slug: 'east-quad', name: 'East Quad' },
  { id: 3, slug: 'mosher-jordan', name: 'Mosher-Jordan' },
  { id: 4, slug: 'north-quad', name: 'North Quad' },
  { id: 5, slug: 'south-quad', name: 'South Quad' },
  { id: 6, slug: 'twigs-at-oxford', name: 'Twigs at Oxford' },
].map((hall) => ({ ...hall, school_id: 1, is_active: true, latitude: null, longitude: null, geofence_radius_m: 120 }));

const GYMS = [
  { id: 1, name: 'CCRB' },
  { id: 2, name: 'NCRB' },
  { id: 3, name: 'IM Building' },
].map((gym) => ({ ...gym, school_id: 1, is_active: true, latitude: null, longitude: null, geofence_radius_m: 120 }));

// name, station, calories, protein, carbs, fat, allergens, traits
const BREAKFAST = [
  ['Scrambled Eggs', 'Grill', 180, 13, 2, 13, ['eggs', 'milk'], ['Vegetarian', 'Gluten Free']],
  ['Turkey Sausage Links', 'Grill', 140, 11, 1, 10, [], ['Gluten Free']],
  ['Steel Cut Oatmeal', 'Hot Cereal', 160, 6, 28, 3, ['oats'], ['Vegan']],
  ['Greek Yogurt Parfait', 'Deli', 220, 14, 30, 5, ['milk', 'tree nuts'], ['Vegetarian']],
  ['Buttermilk Pancakes', 'Grill', 310, 8, 52, 8, ['eggs', 'milk', 'wheat/barley/rye'], ['Vegetarian']],
  ['Hash Brown Patty', 'Grill', 150, 2, 16, 9, ['item is deep fried'], ['Vegan']],
  ['Egg White Veggie Omelet', 'Omelet Bar', 120, 15, 5, 4, ['eggs'], ['Vegetarian', 'Gluten Free']],
  ['Bacon', 'Grill', 90, 6, 0, 7, ['pork'], ['Gluten Free']],
  ['Fresh Fruit Cup', 'Deli', 70, 1, 18, 0, [], ['Vegan', 'Gluten Free']],
  ['Whole Wheat Toast', 'Bakery', 110, 5, 20, 2, ['wheat/barley/rye'], ['Vegan']],
];

const MAINS = [
  ['Grilled Chicken Breast', 'Grill', 190, 35, 0, 5, [], ['Gluten Free', 'Halal']],
  ['Teriyaki Salmon', 'Entree', 280, 29, 10, 13, ['fish', 'soy'], []],
  ['Beef Burrito Bowl', 'Global', 520, 32, 55, 18, ['milk'], []],
  ['Chicken Tikka Masala', 'Global', 360, 28, 14, 21, ['milk'], ['Halal', 'Gluten Free']],
  ['Turkey Burger', 'Grill', 410, 30, 32, 17, ['wheat/barley/rye', 'sesame seed'], []],
  ['Tofu Stir Fry', 'Wok', 290, 17, 26, 13, ['soy', 'wheat/barley/rye'], ['Vegan']],
  ['Cheese Pizza Slice', 'Pizza', 300, 13, 36, 11, ['milk', 'wheat/barley/rye'], ['Vegetarian']],
  ['Pepperoni Pizza Slice', 'Pizza', 330, 14, 35, 15, ['milk', 'wheat/barley/rye', 'pork'], []],
  ['Brown Rice', 'Sides', 160, 4, 34, 1, [], ['Vegan', 'Gluten Free']],
  ['Roasted Broccoli', 'Sides', 60, 3, 7, 3, [], ['Vegan', 'Gluten Free']],
  ['Black Bean Soup', 'Soup', 180, 10, 30, 2, [], ['Vegan', 'Gluten Free']],
  ['Pasta Marinara', 'Pasta', 340, 11, 62, 5, ['wheat/barley/rye'], ['Vegan']],
  ['Garden Salad', 'Salad Bar', 45, 2, 8, 0, [], ['Vegan', 'Gluten Free']],
  ['Hard Boiled Eggs', 'Salad Bar', 140, 12, 1, 10, ['eggs'], ['Vegetarian', 'Gluten Free']],
  ['Roast Turkey Breast', 'Carvery', 150, 27, 2, 3, [], ['Gluten Free']],
  ['Mac and Cheese', 'Comfort', 380, 15, 40, 18, ['milk', 'wheat/barley/rye'], ['Vegetarian']],
  ['Chocolate Chip Cookie', 'Bakery', 200, 2, 27, 10, ['eggs', 'milk', 'wheat/barley/rye'], ['Vegetarian']],
  ['Lentil Curry', 'Global', 260, 14, 38, 6, [], ['Vegan', 'Gluten Free', 'Halal']],
];

function dishRow(id, hall, date, dish, meals) {
  const [name, subheader, calories, protein, carbs, fat, allergens, traits] = dish;
  return {
    id,
    hall_id: hall.id,
    hall_name: hall.name,
    menu_date: date,
    name,
    subheader,
    meals,
    allergens,
    traits,
    nutrition_source: 'vendor',
    nutrition_facts: {
      serving_size: 150,
      calories,
      protein,
      total_carbohydrate: carbs,
      total_fat: fat,
      saturated_fat: Math.round(fat * 0.35),
      dietary_fiber: Math.round(carbs * 0.08),
      sugars: Math.round(carbs * 0.15),
      sodium: 120 + calories,
      cholesterol: allergens.includes('eggs') ? 180 : 40,
    },
  };
}

// Each hall serves a rotating slice of the pool so menus differ by hall and day.
function buildMenus() {
  const rows = [];
  let id = 1;
  for (const [dayIndex, date] of [campusDate(0), campusDate(1)].entries()) {
    for (const hall of HALLS) {
      const shift = hall.id * 3 + dayIndex * 5;
      const pick = (pool, count) => Array.from({ length: count }, (_, i) => pool[(shift + i) % pool.length]);
      for (const dish of pick(BREAKFAST, 7)) rows.push(dishRow(id++, hall, date, dish, ['breakfast']));
      for (const dish of pick(MAINS, 10)) rows.push(dishRow(id++, hall, date, dish, ['lunch', 'dinner']));
      // Grilled chicken and rice are on every lunch line, like most real halls.
      for (const name of ['Grilled Chicken Breast', 'Brown Rice', 'Garden Salad']) {
        if (!rows.some((r) => r.hall_id === hall.id && r.menu_date === date && r.name === name)) {
          rows.push(dishRow(id++, hall, date, MAINS.find((d) => d[0] === name), ['lunch', 'dinner']));
        }
      }
    }
  }
  return rows;
}

const PEOPLE = [
  { id: ME, display_name: 'You (demo)', username: 'demo_wolverine', avatar_emoji: '💪', accent_color: '#32745f', goal: 'bulk', class_year: 2028, bio: 'Lifting at CCRB, eating at South Quad.', favorite_hall_id: 5 },
  { id: 'demo-maya', display_name: 'Maya Chen', username: 'maya.lifts', avatar_emoji: '🏋️', accent_color: '#8E24AA', goal: 'recomp', class_year: 2027, bio: 'Powerlifting club · protein enthusiast', favorite_hall_id: 2 },
  { id: 'demo-jordan', display_name: 'Jordan Ellis', username: 'jordan_e', avatar_emoji: '🏃', accent_color: '#1E88E5', goal: 'cut', class_year: 2026, bio: 'Marathon training. Will trade cookies for oatmeal.', favorite_hall_id: 1 },
  { id: 'demo-priya', display_name: 'Priya Patel', username: 'priya.eats', avatar_emoji: '🥑', accent_color: '#D81B60', goal: 'maintain', class_year: 2028, bio: 'Vegetarian · Mosher-Jordan regular', favorite_hall_id: 3 },
  { id: 'demo-sam', display_name: 'Sam Rivera', username: 'samrivera', avatar_emoji: '🏀', accent_color: '#FB8C00', goal: 'bulk', class_year: 2027, bio: 'IM basketball, 4,000 cal days', favorite_hall_id: 4 },
  { id: 'demo-alex', display_name: 'Alex Kim', username: 'alexk', avatar_emoji: '🍜', accent_color: '#00897B', goal: 'maintain', class_year: 2029, bio: 'Freshman, still learning the dining halls', favorite_hall_id: 6 },
].map((p) => ({ ...p, school_id: 1, share_presence: true, track_gym: true, log_visibility: 'friends' }));

const logEntry = (dish, mealTime, servings = 1) => {
  const [name, subheader, calories, protein, carbs, fat] = dish;
  const base = { calories, protein, total_carbohydrate: carbs, total_fat: fat };
  const scaled = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * servings]));
  return { name, subheader, mealTime, servings, baseNutrition: base, nutrition_facts: scaled };
};

const dish = (name) => [...BREAKFAST, ...MAINS].find((d) => d[0] === name);

// Past days of food logs, so profile calendars and "usuals" have something in them.
function buildDailyLogs(userId, seed) {
  const days = [];
  const plans = [
    ['Scrambled Eggs', 'Turkey Sausage Links', 'Grilled Chicken Breast', 'Brown Rice', 'Teriyaki Salmon', 'Roasted Broccoli'],
    ['Greek Yogurt Parfait', 'Beef Burrito Bowl', 'Roast Turkey Breast', 'Garden Salad', 'Chocolate Chip Cookie'],
    ['Egg White Veggie Omelet', 'Whole Wheat Toast', 'Chicken Tikka Masala', 'Brown Rice', 'Turkey Burger'],
    ['Steel Cut Oatmeal', 'Hard Boiled Eggs', 'Grilled Chicken Breast', 'Pasta Marinara', 'Lentil Curry'],
  ];
  for (let offset = 1; offset <= 40; offset++) {
    if ((offset + seed) % 6 === 0) continue; // skipped a day
    const plan = plans[(offset + seed) % plans.length];
    const entries = plan.map((name, i) => logEntry(dish(name), i < 2 ? 'breakfast' : i < 4 ? 'lunch' : 'dinner', name === 'Grilled Chicken Breast' ? 2 : 1));
    const sum = (key) => entries.reduce((total, e) => total + e.nutrition_facts[key], 0);
    days.push({
      user_id: userId,
      day: campusDate(-offset),
      entries: entries.map((e) => ({
        name: e.name,
        meal: e.mealTime,
        servings: e.servings,
        calories: e.nutrition_facts.calories,
        protein: e.nutrition_facts.protein,
        carbs: e.nutrition_facts.total_carbohydrate,
        fat: e.nutrition_facts.total_fat,
      })),
      calories: Math.round(sum('calories')),
      protein: sum('protein'),
      carbs: sum('total_carbohydrate'),
      fat: sum('total_fat'),
    });
  }
  return days;
}

export function createSeed() {
  const menuItems = buildMenus();
  const today = campusDate(0);
  const hallFor = (id) => HALLS.find((h) => h.id === id);

  return {
    schools: SCHOOLS,
    dining_halls: HALLS,
    gym_facilities: GYMS,
    menu_items_flat: menuItems,
    users: [
      {
        id: ME,
        username: 'demo_wolverine',
        email: 'demo@umich.edu',
        school_id: 1,
        birthday: '2006-04-12',
        sex: 'male',
        height_cm: 180,
        height_imperial: [5, 11],
        weight_kg: 77,
        weight_lbs: 170,
        activity_level: 'Very active (5+)',
        weight_goal: 'Gain muscle (slow - 0.25 lb/week)',
        default_measurements: ['imperial'],
        diet_type: null,
        dailyValues: { dailyCalories: 2900, dailyProtein: 170, dailyCarbs: 330, dailyFat: 90, manual_entry: false },
        allergens: [],
        preferences: [],
        preferences_box: false,
        allergens_box: true,
        last_dining_hall: 'south-quad',
        log: [
          logEntry(dish('Scrambled Eggs'), 'breakfast', 2),
          logEntry(dish('Turkey Sausage Links'), 'breakfast'),
          logEntry(dish('Steel Cut Oatmeal'), 'breakfast'),
          logEntry(dish('Grilled Chicken Breast'), 'lunch', 2),
          logEntry(dish('Brown Rice'), 'lunch'),
        ],
      },
    ],
    profiles: PEOPLE,
    friendships: [
      { requester_id: ME, addressee_id: 'demo-maya', status: 'accepted' },
      { requester_id: 'demo-jordan', addressee_id: ME, status: 'accepted' },
      { requester_id: ME, addressee_id: 'demo-priya', status: 'accepted' },
      { requester_id: 'demo-sam', addressee_id: ME, status: 'accepted' },
      { requester_id: 'demo-alex', addressee_id: ME, status: 'pending' },
    ],
    presence: [
      { user_id: 'demo-maya', hall_id: null, gym_id: 1, checked_in_at: minutesAgo(25), expires_at: minutesFromNow(65) },
      { user_id: 'demo-jordan', hall_id: 5, gym_id: null, checked_in_at: minutesAgo(10), expires_at: minutesFromNow(50) },
      { user_id: 'demo-priya', hall_id: 3, gym_id: null, checked_in_at: minutesAgo(4), expires_at: minutesFromNow(56) },
    ],
    gym_sessions: [
      { user_id: ME, days_7: 4, minutes_7: 290, days_30: 15, last_visit: minutesAgo(60 * 20) },
      { user_id: 'demo-maya', days_7: 6, minutes_7: 480, days_30: 24, last_visit: minutesAgo(25) },
      { user_id: 'demo-jordan', days_7: 3, minutes_7: 150, days_30: 11, last_visit: minutesAgo(60 * 30) },
      { user_id: 'demo-sam', days_7: 5, minutes_7: 400, days_30: 19, last_visit: minutesAgo(60 * 6) },
    ],
    favorite_dishes: [
      { user_id: ME, dish_name: 'Teriyaki Salmon', dish_key: 'teriyaki salmon', created_at: minutesAgo(5000) },
      { user_id: ME, dish_name: 'Chicken Tikka Masala', dish_key: 'chicken tikka masala', created_at: minutesAgo(4000) },
      { user_id: ME, dish_name: 'Egg White Veggie Omelet', dish_key: 'egg white veggie omelet', created_at: minutesAgo(3000) },
      { user_id: 'demo-maya', dish_name: 'Grilled Chicken Breast', dish_key: 'grilled chicken breast', created_at: minutesAgo(3000) },
      { user_id: 'demo-priya', dish_name: 'Lentil Curry', dish_key: 'lentil curry', created_at: minutesAgo(3000) },
    ],
    daily_logs: PEOPLE.filter((p) => p.id !== ME).flatMap((p, i) => buildDailyLogs(p.id, i + 1)).concat(buildDailyLogs(ME, 0)),
    messages: [
      { id: 1, sender_id: 'demo-maya', recipient_id: ME, body: 'CCRB is packed rn 😩', created_at: minutesAgo(30), read_at: minutesAgo(28) },
      { id: 2, sender_id: ME, recipient_id: 'demo-maya', body: 'NCRB after class?', created_at: minutesAgo(27), read_at: minutesAgo(20) },
      { id: 3, sender_id: 'demo-maya', recipient_id: ME, body: "Down. Salmon's at East Quad tonight btw", created_at: minutesAgo(8), read_at: null },
      { id: 4, sender_id: 'demo-jordan', recipient_id: ME, body: "I'm at South Quad if you want to grab lunch", created_at: minutesAgo(9), read_at: null },
    ],
    reports: [],
    school_requests: [],
    internal: [],
    today,
    hallFor,
  };
}
