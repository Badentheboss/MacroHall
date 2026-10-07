// Dashboard: today at a glance. Calories left, macro rings, favorites on the
// menu, the "hit my macros" plate builder, the gym, and micronutrients.
import React, { useState, useEffect, useCallback } from "react";
import { View, Modal, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import Animated, { Easing, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../utils/config";
import { DIET_TYPES, buildMacroTargets, getDietByKey } from "../../utils/macros";
import {
  convertNutrientValue,
  formatNutrientValue,
  formatPercentOfDailyValue,
  getMicronutrientKeys,
  getRecommendedDailyValues,
  parseNutritionValue,
  roundNutrientValue,
} from "../../utils/nutrients";
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DashboardExtras from '../../components/DashboardExtras';
import { useTheme } from '../../context/ThemeContext';
import { motion, radius, space, type, useAppTheme, useStyles } from '../../theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  FadeIn,
  IconButton,
  MacroRing,
  NumberTicker,
  ProgressBar,
  Screen,
  Segmented,
  Tap,
  TextField,
  Txt,
} from '../../components/kit';

const formatCount = (n) => Math.round(Math.abs(n || 0)).toLocaleString('en-US');

const prettyNutrient = (key) =>
  key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

// Calorie split of a diet as one stacked bar in the macro colors.
function DietSplitBar({ split }) {
  const { c } = useAppTheme();
  const parts = [
    { key: 'protein', value: split.protein, color: c.protein },
    { key: 'carbs', value: split.carbs, color: c.carbs },
    { key: 'fat', value: split.fat, color: c.fat },
  ];
  return (
    <View style={{ flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden', gap: 2 }}>
      {parts.map((part) => (
        <View key={part.key} style={{ flex: part.value, backgroundColor: part.color }} />
      ))}
    </View>
  );
}

const splitLabel = (split) => `${split.protein}% P · ${split.carbs}% C · ${split.fat}% F`;

// Bottom sheet on a dimmed backdrop. Tapping the backdrop closes it.
function Sheet({ visible, onClose, title, overline, children }) {
  const styles = useStyles(sheetStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View entering={Platform.OS === 'web' ? SlideInDown.duration(motion.base) : SlideInDown.duration(motion.slow).easing(Easing.out(Easing.cubic))} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, gap: 2 }}>
              {overline ? <Txt variant="overline" tone="muted">{overline}</Txt> : null}
              <Txt variant="h2">{title}</Txt>
            </View>
            <IconButton name="close" label="Close" tone="filled" size={20} onPress={onClose} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheetStyles = (c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.lg,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill, backgroundColor: c.sunken },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});

// One of the three small macro rings: grams left inside, name + eaten/goal under.
function MacroStat({ label, eaten, goal, color }) {
  const left = goal - eaten;
  const over = left < 0;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: space.sm }} accessible accessibilityLabel={`${label}: ${formatCount(left)} grams ${over ? 'over' : 'left'}, ${formatCount(eaten)} of ${formatCount(goal)} grams eaten`}>
      <MacroRing progress={goal > 0 ? eaten / goal : 0} size={88} stroke={8} color={color}>
        <NumberTicker value={Math.abs(left)} variant="title" format={(n) => `${Math.round(n)}g`} />
        <Txt variant="caption" tone="muted" style={{ fontSize: 11, lineHeight: 13 }}>{over ? 'over' : 'left'}</Txt>
      </MacroRing>
      <View style={{ alignItems: 'center' }}>
        <Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>{label}</Txt>
        <Txt variant="caption" tone="muted">
          {formatCount(eaten)} / {formatCount(goal)}g
        </Txt>
      </View>
    </View>
  );
}

const dashboardStyles = (c) => ({
  intro: { gap: space.xs, paddingTop: space.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -space.sm, marginBottom: space.sm },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  ringCenter: { alignItems: 'center' },
  heroStats: { flex: 1, gap: space.lg },
  stat: { gap: 2 },
  macrosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.lg },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  microRow: { gap: space.xs, paddingVertical: space.sm + 2 },
  microTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  microBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dietOption: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md },
  recommendation: { alignItems: 'center', gap: space.xs },
});

export default function Dashboard() {
  const navigation = useNavigation();
  const [userDailyValues, setUserDailyValues] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [nutritionTotals, setNutritionTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    iron: 0,
    sodium: 0,
    sugars: 0,
    calcium: 0,
    cholesterol: 0,
    saturated_fat: 0,
    dietary_fiber: 0,
    vitamin_a: 0,
    vitamin_c: 0
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const { isDarkMode } = useTheme();
  const [editVisible, setEditVisible] = useState(false);
  const [calorieInput, setCalorieInput] = useState('');
  const [calorieMode, setCalorieMode] = useState('manual');
  const [calorieAutoValue, setCalorieAutoValue] = useState(null);
  const [calorieCalcError, setCalorieCalcError] = useState('');
  const [selectedDietType, setSelectedDietType] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const micronutrientKeys = getMicronutrientKeys();

  // Removed profile modal states - moved to UserProfile screen

  // Add this object with recommended daily values
  const recommendedDailyValues = getRecommendedDailyValues();


  const { c } = useAppTheme();
  const styles = useStyles(dashboardStyles);

  const calculateAgeFromBirthday = (birthdayStr) => {
    if (!birthdayStr) return null;
    const birthDate = new Date(birthdayStr);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age;
  };

  const convertImperialHeightToCm = (heightImperial) => {
    if (!Array.isArray(heightImperial)) return null;
    const feet = parseFloat(heightImperial[0]) || 0;
    const inches = parseFloat(heightImperial[1]) || 0;
    const totalInches = (feet * 12) + inches;
    if (totalInches <= 0) return null;
    return Number((totalInches * 2.54).toFixed(1));
  };

  const deriveHeightCmFromProfile = () => {
    if (!profileData) return null;
    const heightCm = parseFloat(profileData.height_cm);
    if (!Number.isNaN(heightCm) && heightCm > 0) {
      return heightCm;
    }
    return convertImperialHeightToCm(profileData.height_imperial);
  };

  const deriveWeightKgFromProfile = () => {
    if (!profileData) return null;
    const weightKg = parseFloat(profileData.weight_kg);
    if (!Number.isNaN(weightKg) && weightKg > 0) {
      return weightKg;
    }
    const weightLbs = parseFloat(profileData.weight_lbs);
    if (!Number.isNaN(weightLbs) && weightLbs > 0) {
      return Number((weightLbs * 0.45359237).toFixed(1));
    }
    return null;
  };

  const getActivityMultiplier = (activityLabel = '') => {
    const normalized = (activityLabel || '').toLowerCase();
    if (normalized.includes('athlete')) return 1.9;
    if (normalized.includes('very')) return 1.725;
    if (normalized.includes('moderately') || normalized.includes('moderate')) return 1.55;
    if (normalized.includes('light')) return 1.375;
    return 1.2; // sedentary or unknown
  };

  const getGoalAdjustment = (goalLabel = '') => {
    const normalized = (goalLabel || '').toLowerCase();
    if (normalized.includes('lose')) {
      if (normalized.includes('fast') || normalized.includes('1 lb')) return -500;
      if (normalized.includes('moderate') || normalized.includes('0.5')) return -250;
      return -125;
    }
    if (normalized.includes('gain')) {
      if (normalized.includes('fast') || normalized.includes('1 lb')) return 500;
      if (normalized.includes('moderate') || normalized.includes('0.5')) return 250;
      return 125;
    }
    return 0;
  };

  const calculateCalorieRecommendation = () => {
    if (!profileData) {
      return { error: 'Add your profile details first.' };
    }

    const sex = (profileData.sex || '').toLowerCase();

    const age = calculateAgeFromBirthday(profileData.birthday);
    if (!age || age <= 0) {
      return { error: 'Please add a valid birthday in your profile.' };
    }

    const heightCm = deriveHeightCmFromProfile();
    if (!heightCm) {
      return { error: 'Please add your height in your profile.' };
    }

    const weightKg = deriveWeightKgFromProfile();
    if (!weightKg) {
      return { error: 'Please add your weight in your profile.' };
    }

    const activityMultiplier = getActivityMultiplier(profileData.activity_level);
    const goalAdjustment = getGoalAdjustment(profileData.weight_goal);

    let bmr;
    if (sex === 'male') {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else if (sex === 'female') {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    } else {
      // Default to Mifflin St Jeor average when sex is unspecified
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    }

    const calories = Math.round((bmr * activityMultiplier) + goalAdjustment);
    const safeCalories = Math.max(calories, 1200);

    return { value: safeCalories };
  };

  const refreshCalorieRecommendation = () => {
    const { value, error } = calculateCalorieRecommendation();
    if (error) {
      setCalorieAutoValue(null);
      setCalorieCalcError(error);
    } else {
      setCalorieAutoValue(value);
      setCalorieCalcError('');
    }
  };

  useEffect(() => {
    if (calorieMode === 'personal' && editVisible) {
      refreshCalorieRecommendation();
    }
  }, [profileData, calorieMode, editVisible]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('dailyValues, log, sex, height_cm, height_imperial, weight_kg, weight_lbs, birthday, activity_level, weight_goal, diet_type')
        .eq('id', user.data.user.id)
        .single();

      if (userError) throw userError;

      setUserDailyValues(userData.dailyValues);
      setProfileData({
        sex: userData.sex,
        height_cm: userData.height_cm,
        height_imperial: userData.height_imperial,
        weight_kg: userData.weight_kg,
        weight_lbs: userData.weight_lbs,
        birthday: userData.birthday,
        activity_level: userData.activity_level,
        weight_goal: userData.weight_goal,
        diet_type: userData.diet_type,
      });
      setSelectedDietType(userData.diet_type || '');

      // Reset totals if log is empty
      if (!userData.log || userData.log.length === 0) {
        setNutritionTotals({
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          iron: 0,
          sodium: 0,
          sugars: 0,
          calcium: 0,
          cholesterol: 0,
          saturated_fat: 0,
          dietary_fiber: 0,
          vitamin_a: 0,
          vitamin_c: 0
        });
        return;
      }

      // Calculate totals from log using baseNutrition × servings
      const totals = userData.log.reduce((acc, item) => {
        const servings = item.servings || 1;
        const baseNutrition = item.baseNutrition || item.nutrition_facts || {};

        const calories = parseNutritionValue(baseNutrition.calories) || 0;
        const protein = parseNutritionValue(baseNutrition.protein) || 0;
        const carbs = parseNutritionValue(baseNutrition.total_carbohydrate) || 0;
        const fat = parseNutritionValue(baseNutrition.total_fat) || 0;

        acc.calories += calories * servings;
        acc.protein += protein * servings;
        acc.carbs += carbs * servings;
        acc.fat += fat * servings;

        micronutrientKeys.forEach((key) => {
          if (!(key in acc)) {
            acc[key] = 0;
          }
          const value = convertNutrientValue(key, baseNutrition[key]);
          if (value !== null && value !== undefined) {
            acc[key] += value * servings;
          }
        });

        return acc;
      }, micronutrientKeys.reduce((seed, key) => ({ ...seed, [key]: 0 }), {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }));

      // Round values using nutrient-aware precision
      Object.keys(totals).forEach(key => {
        totals[key] = roundNutrientValue(key, totals[key]);
      });

      setNutritionTotals(totals);
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  const formatDate = (date) => {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const remainingCalories = (userDailyValues?.dailyCalories || 2000) - nutritionTotals.calories;
  const selectedDiet = getDietByKey(selectedDietType);

  const openEditModal = () => {
    const isManual = userDailyValues?.manual_entry !== false;
    const initialMode = isManual ? 'manual' : 'personal';

    setCalorieInput((userDailyValues?.dailyCalories || 2000).toString());
    setCalorieMode(initialMode);
    setCalorieAutoValue(null);
    setCalorieCalcError('');
    setEditVisible(true);

    if (initialMode === 'personal') {
      refreshCalorieRecommendation();
    }
  };

  const closeEditModal = () => {
    setEditVisible(false);
    setCalorieMode('manual');
    setCalorieAutoValue(null);
    setCalorieCalcError('');
  };

  const handleCalorieModeChange = (mode) => {
    setCalorieMode(mode);
    if (mode === 'personal') {
      refreshCalorieRecommendation();
    } else {
      setCalorieCalcError('');
    }
  };

  const goToProfileScreen = () => {
    closeEditModal();
    navigation.navigate('UserProfile');
  };

  const handleDietSelect = async (dietKey) => {
    const previousSelection = selectedDietType;
    setSelectedDietType(dietKey);
    setDropdownOpen(false);
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    const diet = getDietByKey(dietKey);
    const baseDailyValues = userDailyValues || {};
    const macrosFromDiet = buildMacroTargets({
      calories: baseDailyValues.dailyCalories || 2000,
      dietOverride: diet,
      dietKey,
      dailyValues: baseDailyValues,
    });
    const nextDailyValues = macrosFromDiet
      ? { ...baseDailyValues, ...macrosFromDiet }
      : baseDailyValues;

    try {
      const { error } = await supabase
        .from('users')
        .update({ diet_type: dietKey, dailyValues: nextDailyValues })
        .eq('id', user.data.user.id);

      if (error) throw error;

      setProfileData(prev => prev ? { ...prev, diet_type: dietKey } : prev);
      setUserDailyValues(nextDailyValues);
    } catch (e) {
      console.error('Error updating diet type:', e);
      setSelectedDietType(previousSelection);
    }
  };

  const saveCalorieGoal = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;
    
    const isManual = calorieMode === 'manual';

    let targetCalories;
    if (!isManual) {
      if (!calorieAutoValue) {
        setCalorieCalcError('Unable to generate a calorie target. Please update your profile information.');
        return;
      }
      targetCalories = calorieAutoValue;
    } else {
      targetCalories = parseInt(calorieInput, 10) || 2000;
    }
    
    try {
      const current = userDailyValues || {};
      const updated = { ...current, dailyCalories: targetCalories, manual_entry: isManual };

      const macroTargets = buildMacroTargets({
        calories: targetCalories,
        dietOverride: selectedDiet,
        dietKey: selectedDietType,
        dailyValues: current,
      });

      if (macroTargets) {
        updated.dailyCarbs = macroTargets.dailyCarbs;
        updated.dailyProtein = macroTargets.dailyProtein;
        updated.dailyFat = macroTargets.dailyFat;
      }
      
      const { error } = await supabase
        .from('users')
        .update({ dailyValues: updated })
        .eq('id', user.data.user.id);
        
      if (error) throw error;
      
      setUserDailyValues(updated);
      closeEditModal();
    } catch (e) {
      console.error('Error saving calorie goal:', e);
      closeEditModal();
    }
  };

  // Removed profile functions - moved to UserProfile screen

  const calorieGoal = userDailyValues?.dailyCalories || 2000;
  const proteinGoal = userDailyValues?.dailyProtein || 50;
  const carbsGoal = userDailyValues?.dailyCarbs || 275;
  const fatGoal = userDailyValues?.dailyFat || 60;
  const caloriesOver = remainingCalories < 0;
  const macroLegend = [
    { key: 'protein', label: 'Protein', color: c.protein },
    { key: 'carbs', label: 'Carbs', color: c.carbs },
    { key: 'fat', label: 'Fat', color: c.fat },
  ];

  return (
    <>
      <Screen>
        <FadeIn index={0} style={styles.intro}>
          <Txt variant="overline" tone="muted">{formatDate(currentDate)}</Txt>
          <Txt variant="h1" accessibilityRole="header">
            {remainingCalories > 0 ? `${formatCount(remainingCalories)} cal to go` : 'Goal hit'}
          </Txt>
        </FadeIn>

        {/* Calories hero */}
        <FadeIn index={1}>
          <Card>
            <View style={styles.heroTop}>
              <Txt variant="overline" tone="muted">Calories</Txt>
              <IconButton name="create-outline" label="Edit calorie goal" tone="filled" size={18} onPress={openEditModal} />
            </View>
            <View style={styles.heroBody}>
              <MacroRing progress={nutritionTotals.calories / calorieGoal} size={168} stroke={12} color={caloriesOver ? c.accent : c.ink}>
                <View
                  style={styles.ringCenter}
                  accessible
                  accessibilityLabel={`${formatCount(remainingCalories)} calories ${caloriesOver ? 'over' : 'left'}`}
                >
                  <NumberTicker value={Math.abs(remainingCalories)} variant="display" />
                  <Txt variant="caption" tone="muted">{caloriesOver ? 'cal over' : 'cal left'}</Txt>
                </View>
              </MacroRing>
              <View style={styles.heroStats}>
                <View style={styles.stat}>
                  <NumberTicker value={nutritionTotals.calories} />
                  <Txt variant="caption" tone="muted">eaten</Txt>
                </View>
                <Divider />
                <View style={styles.stat}>
                  <Txt variant="number" style={{ fontVariant: ['tabular-nums'] }}>{formatCount(calorieGoal)}</Txt>
                  <Txt variant="caption" tone="muted">daily goal</Txt>
                </View>
              </View>
            </View>
          </Card>
        </FadeIn>

        {/* Macros */}
        <FadeIn index={2}>
          <Card>
            <View style={styles.macrosHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="title">Macros</Txt>
                <Txt variant="caption" tone="muted" numberOfLines={1}>
                  {selectedDiet ? splitLabel(selectedDiet.caloriesSplit) : 'Pick a diet type to set targets'}
                </Txt>
              </View>
              <Chip
                label={selectedDiet ? selectedDiet.title : 'Diet type'}
                icon="options-outline"
                active={dropdownOpen}
                onPress={() => setDropdownOpen(prev => !prev)}
              />
            </View>
            <View style={styles.macroRow}>
              <MacroStat label="Protein" eaten={nutritionTotals.protein} goal={proteinGoal} color={c.protein} />
              <MacroStat label="Carbs" eaten={nutritionTotals.carbs} goal={carbsGoal} color={c.carbs} />
              <MacroStat label="Fat" eaten={nutritionTotals.fat} goal={fatGoal} color={c.fat} />
            </View>
          </Card>
        </FadeIn>

        <DashboardExtras
          isDarkMode={isDarkMode}
          remaining={{
            calories: remainingCalories,
            protein: proteinGoal - nutritionTotals.protein,
          }}
        />

        {/* Micronutrients */}
        <FadeIn index={7}>
          <Card>
            <View style={{ gap: 2, marginBottom: space.xs }}>
              <Txt variant="title">Micronutrients</Txt>
              <Txt variant="caption" tone="muted">Today's totals against the daily value</Txt>
            </View>
            {Object.entries(recommendedDailyValues).map(([nutrient, recommendedValue]) => {
              const currentValue = nutritionTotals[nutrient] || 0;
              const percentage = Math.round((currentValue / recommendedValue) * 100);
              const nutrientLabel = formatNutrientValue(nutrient, currentValue);
              const percentLabel = formatPercentOfDailyValue(nutrient, currentValue);

              return (
                <View
                  key={nutrient}
                  style={styles.microRow}
                  accessible
                  accessibilityLabel={`${prettyNutrient(nutrient)}: ${nutrientLabel} of ${formatNutrientValue(nutrient, recommendedValue)}, ${percentLabel || `${percentage}% of daily value`}`}
                >
                  <View style={styles.microTop}>
                    <Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>{prettyNutrient(nutrient)}</Txt>
                    <Txt variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                      {nutrientLabel} / {formatNutrientValue(nutrient, recommendedValue)}
                    </Txt>
                  </View>
                  <View style={styles.microBar}>
                    <ProgressBar value={percentage / 100} color={c.ink} style={{ flex: 1 }} />
                    <Txt variant="caption" style={{ minWidth: 56, textAlign: 'right', fontFamily: type.bodyStrong.fontFamily, fontVariant: ['tabular-nums'] }}>
                      {percentLabel || `${percentage}% DV`}
                    </Txt>
                  </View>
                </View>
              );
            })}
          </Card>
        </FadeIn>
      </Screen>

      {/* Edit calorie goal */}
      <Sheet visible={editVisible} onClose={closeEditModal} overline="Daily goal" title="Calorie goal">
        <Segmented
          options={[
            { label: 'Manual entry', value: 'manual' },
            { label: 'From my profile', value: 'personal' },
          ]}
          value={calorieMode}
          onChange={handleCalorieModeChange}
        />

        {calorieMode === 'manual' ? (
          <TextField
            label="Daily calories"
            icon="flame-outline"
            value={calorieInput}
            onChangeText={setCalorieInput}
            keyboardType="numeric"
            placeholder="Enter daily calories"
            returnKeyType="done"
            hint="Protein, carb and fat targets follow your diet type."
          />
        ) : (
          <Card tone="sunken" style={styles.recommendation}>
            {calorieCalcError ? (
              <>
                <Ionicons name="person-circle-outline" size={32} color={c.muted} />
                <Txt variant="small" tone="accent" style={{ textAlign: 'center' }}>{calorieCalcError}</Txt>
                <Button title="Adjust profile" variant="ghost" size="sm" icon="arrow-forward" onPress={goToProfileScreen} />
              </>
            ) : (
              <>
                <Txt variant="caption" tone="muted">Based on your profile, we recommend</Txt>
                <Txt variant="h1" style={{ textAlign: 'center' }}>
                  {calorieAutoValue ? `${calorieAutoValue.toLocaleString('en-US')} cal/day` : '—'}
                </Txt>
                <Txt variant="caption" tone="muted" style={{ textAlign: 'center' }}>
                  Activity: {profileData?.activity_level || 'Not set'}
                </Txt>
                <Txt variant="caption" tone="muted" style={{ textAlign: 'center' }}>
                  Goal: {profileData?.weight_goal || 'Not set'}
                </Txt>
                <Button title="Adjust profile" variant="ghost" size="sm" icon="arrow-forward" onPress={goToProfileScreen} />
              </>
            )}
          </Card>
        )}

        <View style={{ gap: space.xs }}>
          <Button title="Save goal" size="lg" onPress={saveCalorieGoal} />
          <Button title="Cancel" variant="ghost" onPress={closeEditModal} />
        </View>
      </Sheet>

      {/* Diet type */}
      <Sheet visible={dropdownOpen} onClose={() => setDropdownOpen(false)} overline="Macro targets" title="Diet type">
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          {macroLegend.map((item) => (
            <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
              <Txt variant="caption" tone="muted">{item.label}</Txt>
            </View>
          ))}
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: space.xs }} showsVerticalScrollIndicator={false}>
          {DIET_TYPES.map(diet => {
            const isSelected = diet.key === selectedDietType;
            return (
              <Tap
                key={diet.key}
                onPress={() => handleDietSelect(diet.key)}
                scaleTo={0.985}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${diet.title}, ${diet.caloriesSplit.protein}% protein, ${diet.caloriesSplit.carbs}% carbs, ${diet.caloriesSplit.fat}% fat`}
                style={[styles.dietOption, { backgroundColor: isSelected ? c.sunken : 'transparent' }]}
              >
                <View style={{ flex: 1, gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm }}>
                    <Txt variant="bodyStrong">{diet.title}</Txt>
                    <Txt variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>{splitLabel(diet.caloriesSplit)}</Txt>
                  </View>
                  <DietSplitBar split={diet.caloriesSplit} />
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? c.ink : c.faint}
                />
              </Tap>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}
