export const DIET_TYPES = [
  { 
    key: 'balanced', 
    title: 'Balanced', 
    caloriesSplit: { carbs: 50, protein: 20, fat: 30 } // Standard health-focused
  },
  { 
    key: 'high_protein', 
    title: 'High Protein', 
    caloriesSplit: { carbs: 35, protein: 40, fat: 25 } // For muscle gain / weight loss
  },
  { 
    key: 'low_carb', 
    title: 'Low Carb / Keto', 
    caloriesSplit: { carbs: 10, protein: 25, fat: 65 } // True keto ratios
  },
  { 
    key: 'moderate_carb', 
    title: 'Moderate Carb', 
    caloriesSplit: { carbs: 40, protein: 30, fat: 30 } // Athletic/general fitness
  },
  { 
    key: 'plant_based', 
    title: 'Plant-Based', 
    caloriesSplit: { carbs: 60, protein: 15, fat: 25 } // Reflective of whole-food plant-based
  },
  { 
    key: 'mediterranean', 
    title: 'Mediterranean', 
    caloriesSplit: { carbs: 45, protein: 20, fat: 35 } // Healthy fats emphasis
  },
  { 
    key: 'performance', 
    title: 'Athlete', 
    caloriesSplit: { carbs: 55, protein: 25, fat: 20 } // High energy demand
  },
  { 
    key: 'low_fat', 
    title: 'Low Fat', 
    caloriesSplit: { carbs: 65, protein: 20, fat: 15 } // Popular for some weight loss plans
  }
];

export const DEFAULT_DIET_KEY = DIET_TYPES[0].key;

export const getDietByKey = (key) => {
  if (!key) return null;
  return DIET_TYPES.find((diet) => diet.key === key) || null;
};

export const calculateMacroTargets = (calories, split) => {
  if (!calories || !split) return null;
  const carbsCalories = calories * (split.carbs / 100);
  const proteinCalories = calories * (split.protein / 100);
  const fatCalories = calories * (split.fat / 100);

  return {
    dailyCarbs: Math.round(carbsCalories / 4),
    dailyProtein: Math.round(proteinCalories / 4),
    dailyFat: Math.round(fatCalories / 9),
  };
};

export const deriveMacroSplitFromDailyValues = (dailyValues) => {
  if (!dailyValues) return null;
  const carbCals = (dailyValues.dailyCarbs || 0) * 4;
  const proteinCals = (dailyValues.dailyProtein || 0) * 4;
  const fatCals = (dailyValues.dailyFat || 0) * 9;
  const total = carbCals + proteinCals + fatCals;

  if (!total) return null;

  return {
    carbs: Math.round((carbCals / total) * 100),
    protein: Math.round((proteinCals / total) * 100),
    fat: Math.round((fatCals / total) * 100),
  };
};

export const resolveMacroSplit = ({ dietKey, dietOverride, dailyValues }) => {
  if (dietOverride?.caloriesSplit) {
    return dietOverride.caloriesSplit;
  }

  const fromKey = getDietByKey(dietKey);
  if (fromKey?.caloriesSplit) {
    return fromKey.caloriesSplit;
  }

  const derived = deriveMacroSplitFromDailyValues(dailyValues);
  if (derived) {
    return derived;
  }

  return DIET_TYPES[0].caloriesSplit;
};

export const buildMacroTargets = ({ calories, dietKey, dietOverride, dailyValues }) => {
  const split = resolveMacroSplit({ dietKey, dietOverride, dailyValues });
  return calculateMacroTargets(calories, split);
};
