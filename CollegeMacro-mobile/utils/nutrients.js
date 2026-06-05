const UNIT_MAP = {
  calories: 'cal',
  protein: 'g',
  total_carbohydrate: 'g',
  total_fat: 'g',
  saturated_fat: 'g',
  dietary_fiber: 'g',
  sugars: 'g',
  sodium: 'mg',
  cholesterol: 'mg',
  iron: 'mg',
  calcium: 'mg',
  vitamin_a: 'mcg',
  vitamin_c: 'mg',
  serving_size: 'g',
};

const DAILY_VALUE_MAP = {
  iron: { amount: 18, unit: 'mg', precision: 2 },
  calcium: { amount: 1300, unit: 'mg', precision: 0 },
  vitamin_a: { amount: 900, unit: 'mcg', precision: 0 },
  vitamin_c: { amount: 90, unit: 'mg', precision: 1 },
  sodium: { amount: 2300, unit: 'mg', precision: 0 },
  sugars: { amount: 50, unit: 'g', precision: 1 },
  cholesterol: { amount: 300, unit: 'mg', precision: 0 },
  saturated_fat: { amount: 20, unit: 'g', precision: 1 },
  dietary_fiber: { amount: 28, unit: 'g', precision: 1 },
};

const PERCENT_BASED_KEYS = new Set(['iron', 'calcium', 'vitamin_a', 'vitamin_c']);

const getUnitPrecision = (key) => {
  const meta = DAILY_VALUE_MAP[key];
  if (meta?.precision !== undefined) {
    return meta.precision;
  }

  const unit = UNIT_MAP[key];
  if (unit === 'cal') return 0;
  if (unit === 'mg') return 1;
  if (unit === 'mcg') return 0;
  if (unit === 'g') return 1;
  return 1;
};

export const parseNutritionValue = (raw) => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const getNutrientUnit = (key) => UNIT_MAP[key] || 'g';

export const getDailyValueInfo = (key) => DAILY_VALUE_MAP[key] ?? null;

export const getNutrientInfo = (key, rawValue) => {
  const numeric = parseNutritionValue(rawValue);
  const unit = getNutrientUnit(key);

  if (numeric === null) {
    return { value: null, unit, percent: null };
  }

  if (PERCENT_BASED_KEYS.has(key)) {
    const dailyValue = DAILY_VALUE_MAP[key]?.amount;
    if (!dailyValue) {
      return { value: numeric, unit, percent: null };
    }
    const absolute = (numeric / 100) * dailyValue;
    return {
      value: absolute,
      unit,
      percent: numeric,
    };
  }

  if (unit === 'mg' && typeof rawValue === 'string' && rawValue.toLowerCase().includes('g')) {
    const converted = numeric * 1000;
    const meta = DAILY_VALUE_MAP[key];
    const percent = meta?.amount ? (converted / meta.amount) * 100 : null;
    return {
      value: converted,
      unit,
      percent,
    };
  }

  const meta = DAILY_VALUE_MAP[key];
  const percent = meta?.amount ? (numeric / meta.amount) * 100 : null;

  return {
    value: numeric,
    unit,
    percent,
  };
};

export const convertNutrientValue = (key, rawValue) => {
  const { value } = getNutrientInfo(key, rawValue);
  return value;
};

export const formatNutrientValue = (key, value) => {
  if (value === null || value === undefined) {
    return '—';
  }

  const unit = getNutrientUnit(key);
  const precision = getUnitPrecision(key);
  const rounded = Number(value.toFixed(precision));

  if (unit === 'cal') {
    return `${Math.round(rounded)} ${unit}`;
  }

  return `${rounded} ${unit}`.trim();
};

export const formatPercentOfDailyValue = (key, value) => {
  const meta = DAILY_VALUE_MAP[key];
  if (!meta?.amount || value === null || value === undefined) {
    return null;
  }

  const percent = (value / meta.amount) * 100;
  return `${Math.round(percent)}% DV`;
};

export const formatNutrientDisplay = (key, rawValue) => {
  const info = getNutrientInfo(key, rawValue);
  return {
    valueLabel: formatNutrientValue(key, info.value),
    percentLabel: formatPercentOfDailyValue(key, info.value),
    ...info,
  };
};

export const roundNutrientValue = (key, value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const precision = getUnitPrecision(key);
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const getMicronutrientKeys = () => [
  'iron',
  'sodium',
  'sugars',
  'calcium',
  'cholesterol',
  'saturated_fat',
  'dietary_fiber',
  'vitamin_a',
  'vitamin_c',
];

export const getRecommendedDailyValues = () => ({
  iron: DAILY_VALUE_MAP.iron.amount,
  sodium: DAILY_VALUE_MAP.sodium.amount,
  sugars: DAILY_VALUE_MAP.sugars.amount,
  calcium: DAILY_VALUE_MAP.calcium.amount,
  cholesterol: DAILY_VALUE_MAP.cholesterol.amount,
  saturated_fat: DAILY_VALUE_MAP.saturated_fat.amount,
  dietary_fiber: DAILY_VALUE_MAP.dietary_fiber.amount,
  vitamin_a: DAILY_VALUE_MAP.vitamin_a.amount,
  vitamin_c: DAILY_VALUE_MAP.vitamin_c.amount,
});
