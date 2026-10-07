// "Hit my macros": picks dishes (and servings) from one dining hall's menu so
// the plate lands as close as possible to a protein and calorie target, with
// optional carb and fat targets. Deterministic and cheap: a small beam search
// followed by add/remove/swap improvement passes.

const DEFAULTS = { maxItems: 4, maxServings: 2 };
const MIN_CALORIES = 30; // skip condiments, lemon wedges, water
const BEAM_WIDTH = 30;

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

// Menu rows (menu_items_flat shape) -> candidates with numeric macros.
function toCandidates(rows) {
  return rows
    .map((row, index) => {
      const n = row.nutrition_facts || {};
      return {
        index,
        row,
        calories: num(n.calories),
        protein: num(n.protein) ?? 0,
        carbs: num(n.total_carbohydrate) ?? 0,
        fat: num(n.total_fat) ?? 0,
      };
    })
    .filter((c) => c.calories !== null && c.calories >= MIN_CALORIES);
}

function totalsOf(plate) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const { item, servings } of plate) {
    totals.calories += item.calories * servings;
    totals.protein += item.protein * servings;
    totals.carbs += item.carbs * servings;
    totals.fat += item.fat * servings;
  }
  return totals;
}

// Lower is better. Missing protein and going over calories hurt most; extra
// protein barely matters; each extra dish costs a little (simpler plates).
function score(plate, target) {
  const totals = totalsOf(plate);
  const rel = (value, goal) => (goal > 0 ? (value - goal) / goal : 0);

  const p = rel(totals.protein, target.protein);
  const c = rel(totals.calories, target.calories);
  let s = (p < 0 ? 3 : 0.3) * p * p + (c > 0 ? 4 : 1) * c * c;
  if (target.carbs) s += 0.5 * rel(totals.carbs, target.carbs) ** 2;
  if (target.fat) s += 0.5 * rel(totals.fat, target.fat) ** 2;
  return s + 0.03 * plate.length;
}

function withServing(plate, item, delta) {
  const next = plate.map((entry) => ({ ...entry }));
  const existing = next.find((entry) => entry.item === item);
  if (existing) existing.servings += delta;
  else if (delta > 0) next.push({ item, servings: delta });
  return next.filter((entry) => entry.servings > 0);
}

function build(candidates, target, { maxItems, maxServings }) {
  let plate = [];
  let best = score(plate, target);

  const canAdd = (current, item) => {
    const entry = current.find((e) => e.item === item);
    return entry ? entry.servings < maxServings : current.length < maxItems;
  };

  // Beam search: grow plates one serving at a time, keeping the best few
  // partial plates at each step, so combinations a pure greedy pass would
  // miss (two servings of chicken + rice instead of chicken + mac and cheese)
  // are still explored.
  const keyOf = (candidate) =>
    candidate
      .map((e) => `${e.item.index}x${e.servings}`)
      .sort()
      .join(',');
  let beam = [{ plate: [], score: best }];
  for (let step = 0; step < maxItems * maxServings; step += 1) {
    const next = new Map();
    for (const state of beam) {
      for (const item of candidates) {
        if (!canAdd(state.plate, item)) continue;
        const grown = withServing(state.plate, item, 1);
        const key = keyOf(grown);
        if (!next.has(key)) next.set(key, { plate: grown, score: score(grown, target) });
      }
    }
    if (next.size === 0) break;
    beam = [...next.values()].sort((a, b) => a.score - b.score).slice(0, BEAM_WIDTH);
    if (beam[0].score < best - 1e-9) {
      plate = beam[0].plate;
      best = beam[0].score;
    }
  }

  // Improve until nothing helps: add a serving, drop a serving, or swap one
  // dish for another. The greedy pass alone can stall (e.g. chicken + mac and
  // cheese when a second chicken + rice fits the target better).
  for (let pass = 0; pass < 20; pass += 1) {
    let move = null;
    const consider = (next) => {
      const s = score(next, target);
      if (s < best - 1e-9 && (!move || s < move.score)) move = { plate: next, score: s };
    };

    for (const item of candidates) {
      if (canAdd(plate, item)) consider(withServing(plate, item, 1));
    }
    for (const entry of plate) {
      consider(withServing(plate, entry.item, -1));
      for (const item of candidates) {
        if (plate.some((e) => e.item === item)) continue;
        consider(withServing(withServing(plate, entry.item, -entry.servings), item, entry.servings));
      }
    }

    if (!move) break;
    plate = move.plate;
    best = move.score;
  }

  return { plate, score: best };
}

const round1 = (value) => Math.round(value * 10) / 10;

// rows: one hall's menu rows for one meal. target: { protein, calories, carbs?, fat? }.
function buildPlate(rows, target, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const { plate, score: finalScore } = build(toCandidates(rows), target, settings);
  const totals = totalsOf(plate);

  return {
    items: plate
      .sort((a, b) => b.item.protein * b.servings - a.item.protein * a.servings)
      .map(({ item, servings }) => ({ ...item.row, servings })),
    totals: {
      calories: Math.round(totals.calories),
      protein: round1(totals.protein),
      carbs: round1(totals.carbs),
      fat: round1(totals.fat),
    },
    score: Math.round(finalScore * 1000) / 1000,
  };
}

// Best plate per hall, best hall first.
function buildPlatesByHall(rows, target, options = {}) {
  const byHall = new Map();
  for (const row of rows) {
    if (!byHall.has(row.hall_name)) byHall.set(row.hall_name, []);
    byHall.get(row.hall_name).push(row);
  }

  return [...byHall.entries()]
    .map(([hall, hallRows]) => ({ hall, hall_id: hallRows[0].hall_id ?? null, ...buildPlate(hallRows, target, options) }))
    .filter((plate) => plate.items.length > 0)
    .sort((a, b) => a.score - b.score);
}

module.exports = {
  buildPlate,
  buildPlatesByHall,
  score,
};
