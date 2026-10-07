// UserProfile.jsx — "Body & goals": a calm form for the numbers behind your
// daily targets. Presentation uses the MacroHall kit; load/save logic is unchanged.
import React, { useState, useEffect, useRef } from "react";
import { View, KeyboardAvoidingView, Keyboard, Platform } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from "../../utils/config";
import { buildMacroTargets, DEFAULT_DIET_KEY } from "../../utils/macros";
import { useTheme } from '../../context/ThemeContext';
import { fonts, space, useAppTheme, useStyles } from '../../theme';
import { Button, Card, Chip, Divider, FadeIn, NumberTicker, Row, Screen, Segmented, Tap, TextField, Txt } from '../../components/kit';

const MAX_WEIGHT_LBS = 600;
const MAX_WEIGHT_KG = 272; // Roughly the kg equivalent of 600 lbs
const MAX_HEIGHT_FT = 7;
const MAX_HEIGHT_IN = 11;
const MAX_HEIGHT_CM = 241.3; // Roughly 7 ft 11 in
const SEX_OPTIONS = ['male', 'female', 'prefer not to say'];
const ACTIVITY_OPTIONS = [
  'Sedentary (little to no exercise)',
  'Lightly active (1–2 workouts/week)',
  'Moderately active (3–4)',
  'Very active (5+)',
  'Athlete (twice daily)',
];
const WEIGHT_GOAL_OPTIONS = [
  'Lose weight (slow - 0.25 lb/week)',
  'Lose weight (moderate - 0.5 lb/week)',
  'Lose weight (fast - 1 lb/week)',
  'Maintain current weight',
  'Gain muscle (slow - 0.25 lb/week)',
  'Gain muscle (moderate - 0.5 lb/week)',
  'Gain muscle (fast - 1 lb/week)',
];
const METRIC = 'metric';
const IMPERIAL = 'imperial';

// Display-only helpers: the stored values stay the strings above.
const SEX_SEGMENTS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer not to say', label: 'Rather not say' },
];
const HEIGHT_UNITS = [
  { value: METRIC, label: 'cm' },
  { value: IMPERIAL, label: 'ft/in' },
];
const WEIGHT_UNITS = [
  { value: METRIC, label: 'kg' },
  { value: IMPERIAL, label: 'lb' },
];
const ACTIVITY_DISPLAY = {
  [ACTIVITY_OPTIONS[0]]: { title: 'Sedentary', subtitle: 'Little to no exercise' },
  [ACTIVITY_OPTIONS[1]]: { title: 'Lightly active', subtitle: '1–2 workouts a week' },
  [ACTIVITY_OPTIONS[2]]: { title: 'Moderately active', subtitle: '3–4 workouts a week' },
  [ACTIVITY_OPTIONS[3]]: { title: 'Very active', subtitle: '5+ workouts a week' },
  [ACTIVITY_OPTIONS[4]]: { title: 'Athlete', subtitle: 'Training twice a day' },
};
const describeActivity = (option) => ACTIVITY_DISPLAY[option] || { title: option, subtitle: null };

const GOAL_DIRECTIONS = [
  { value: 'lose', label: 'Lose' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain' },
];
const GOAL_PACES = [
  { value: 'slow', label: 'Slow', rate: '0.25 lb a week' },
  { value: 'moderate', label: 'Moderate', rate: '0.5 lb a week' },
  { value: 'fast', label: 'Fast', rate: '1 lb a week' },
];
const GOAL_MATRIX = {
  lose: { slow: WEIGHT_GOAL_OPTIONS[0], moderate: WEIGHT_GOAL_OPTIONS[1], fast: WEIGHT_GOAL_OPTIONS[2] },
  gain: { slow: WEIGHT_GOAL_OPTIONS[4], moderate: WEIGHT_GOAL_OPTIONS[5], fast: WEIGHT_GOAL_OPTIONS[6] },
};
const goalDirectionOf = (goal = '') => {
  const normalized = (goal || '').toLowerCase();
  if (normalized.startsWith('lose')) return 'lose';
  if (normalized.startsWith('gain')) return 'gain';
  if (normalized.includes('maintain')) return 'maintain';
  return null;
};
const goalPaceOf = (goal = '') => {
  const normalized = (goal || '').toLowerCase();
  if (normalized.includes('slow')) return 'slow';
  if (normalized.includes('moderate')) return 'moderate';
  if (normalized.includes('fast')) return 'fast';
  return null;
};
const goalOptionFor = (direction, pace) => {
  if (direction === 'maintain') return WEIGHT_GOAL_OPTIONS[3];
  return GOAL_MATRIX[direction]?.[pace || 'moderate'] || '';
};

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

const getActivityMultiplier = (activityLabel = '') => {
  const normalized = (activityLabel || '').toLowerCase();
  if (normalized.includes('athlete')) return 1.9;
  if (normalized.includes('very')) return 1.725;
  if (normalized.includes('moderately') || normalized.includes('moderate')) return 1.55;
  if (normalized.includes('light')) return 1.375;
  return 1.2;
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

const calculateAutoCalories = ({ sex, birthday, heightCm, weightKg, activityLevel, weightGoal }) => {
  const normalizedSex = (sex || '').toLowerCase();
  const age = calculateAgeFromBirthday(birthday);
  if (!age || age <= 0) return null;
  if (!heightCm || !weightKg) return null;

  const activityMultiplier = getActivityMultiplier(activityLevel);
  const goalAdjustment = getGoalAdjustment(weightGoal);

  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  if (normalizedSex === 'male') {
    bmr += 5;
  } else if (normalizedSex === 'female') {
    bmr -= 161;
  }

  return Math.max(Math.round((bmr * activityMultiplier) + goalAdjustment), 1200);
};

export default function UserProfile() {
  const { isDarkMode } = useTheme();
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const heightFtRef = useRef(null);
  const heightInRef = useRef(null);
  const heightCmRef = useRef(null);
  const weightKgRef = useRef(null);
  const weightLbsRef = useRef(null);
  
  // Profile modal states
  const [userSex, setUserSex] = useState('');
  const [heightUseMetric, setHeightUseMetric] = useState(true);
  const [sexOptionsExpanded, setSexOptionsExpanded] = useState(true);
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightUseMetric, setWeightUseMetric] = useState(true);
  const [weightKg, setWeightKg] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [birthday, setBirthday] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activityLevel, setActivityLevel] = useState('');
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);
  const [weightGoal, setWeightGoal] = useState('');
  const [weightGoalDropdownOpen, setWeightGoalDropdownOpen] = useState(false);
  const [dailyValues, setDailyValues] = useState(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [dietType, setDietType] = useState(DEFAULT_DIET_KEY);

  const clampWeightValue = (text, maxValue) => {
    if (!text) return '';
    const numericValue = parseFloat(text);
    if (isNaN(numericValue)) return '';

    const clampedValue = Math.min(numericValue, maxValue);
    const rounded = Number(clampedValue.toFixed(1));
    return rounded.toString();
  };

  const clampHeightCmValue = (text) => {
    if (!text) return '';
    const numericValue = parseFloat(text);
    if (isNaN(numericValue)) return '';

    const clampedValue = Math.min(numericValue, MAX_HEIGHT_CM);
    const rounded = Number(clampedValue.toFixed(1));
    return rounded.toString();
  };

  const clampHeightFtValue = (text) => {
    if (!text) return '';
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly === '') return '';

    const numericValue = parseInt(digitsOnly, 10);
    if (isNaN(numericValue)) return '';

    return String(Math.min(numericValue, MAX_HEIGHT_FT));
  };

  const clampHeightInValue = (text) => {
    if (!text) return '';
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly === '') return '';

    const numericValue = parseInt(digitsOnly, 10);
    if (isNaN(numericValue)) return '';

    return String(Math.min(numericValue, MAX_HEIGHT_IN));
  };

  const parseMeasurementPref = (value, fallback = METRIC) => {
    return value === IMPERIAL ? IMPERIAL : fallback;
  };

  useEffect(() => {
    loadProfile();
    
    // Keyboard listeners
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const loadProfile = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      const { data } = await supabase
        .from('users')
        .select('sex, height_cm, height_imperial, weight_kg, weight_lbs, birthday, activity_level, weight_goal, default_measurements, dailyValues, diet_type')
        .eq('id', user.data.user.id)
        .single();

      if (data) {
        const storedSex = data.sex || '';
        setUserSex(storedSex);
        setSexOptionsExpanded(!storedSex);
        setHeightCm(
          data.height_cm !== null && data.height_cm !== undefined
            ? clampHeightCmValue(String(data.height_cm))
            : ''
        );
        const imperialArray = Array.isArray(data.height_imperial) ? data.height_imperial : null;
        const storedFt = imperialArray?.[0];
        const storedIn = imperialArray?.[1];

        setHeightFt(
          storedFt !== null && storedFt !== undefined
            ? clampHeightFtValue(String(storedFt))
            : ''
        );
        setHeightIn(
          storedIn !== null && storedIn !== undefined
            ? clampHeightInValue(String(storedIn))
            : ''
        );
        setWeightKg(
          data.weight_kg !== null && data.weight_kg !== undefined
            ? clampWeightValue(String(data.weight_kg), MAX_WEIGHT_KG)
            : ''
        );
        setWeightLbs(
          data.weight_lbs !== null && data.weight_lbs !== undefined
            ? clampWeightValue(String(data.weight_lbs), MAX_WEIGHT_LBS)
            : ''
        );
        setBirthday(data.birthday || '');
        setActivityLevel(data.activity_level || '');
        setWeightGoal(data.weight_goal || '');
        setDailyValues(data.dailyValues || null);
        const manualFlag = data.dailyValues?.manual_entry;
        setManualEntry(manualFlag !== undefined ? manualFlag : false);
        setDietType(data.diet_type || DEFAULT_DIET_KEY);

        const measurementPrefs = Array.isArray(data.default_measurements) ? data.default_measurements : [];
        const storedHeightPref = parseMeasurementPref(measurementPrefs[0], METRIC);
        const storedWeightPref = parseMeasurementPref(measurementPrefs[1], METRIC);
        setHeightUseMetric(storedHeightPref !== IMPERIAL);
        setWeightUseMetric(storedWeightPref !== IMPERIAL);
      } else {
        // No profile saved yet, show full selection
        setSexOptionsExpanded(true);
        setManualEntry(false);
        setDietType(DEFAULT_DIET_KEY);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  };

  const saveProfile = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      // Sanitize and clamp height inputs
      const sanitizedMetricHeight = clampHeightCmValue(heightCm);
      const sanitizedFeet = clampHeightFtValue(heightFt);
      const sanitizedInches = clampHeightInValue(heightIn);
      setHeightCm(sanitizedMetricHeight);
      setHeightFt(sanitizedFeet);
      setHeightIn(sanitizedInches);

      const maxTotalInches = (MAX_HEIGHT_FT * 12) + MAX_HEIGHT_IN;

      let finalHeightCm = 0;
      let finalHeightFt = null;
      let finalHeightIn = null;
      let finalHeightImperial = null;

      if (heightUseMetric) {
        finalHeightCm = parseFloat(sanitizedMetricHeight) || 0;
        if (finalHeightCm) {
          const totalInches = Math.min(finalHeightCm / 2.54, maxTotalInches);
          finalHeightFt = Math.floor(totalInches / 12);
          const remainingInches = Math.round(totalInches - (finalHeightFt * 12));
          finalHeightIn = Math.min(remainingInches, MAX_HEIGHT_IN);

          // Guard against rounding overflow (e.g., 7ft 12in)
          if (finalHeightFt >= MAX_HEIGHT_FT && finalHeightIn > MAX_HEIGHT_IN) {
            finalHeightFt = MAX_HEIGHT_FT;
            finalHeightIn = MAX_HEIGHT_IN;
          }

          finalHeightImperial = [finalHeightFt, finalHeightIn];
        }
      } else if (sanitizedFeet || sanitizedInches) {
        const ftValue = sanitizedFeet ? parseInt(sanitizedFeet, 10) : 0;
        const inchValue = sanitizedInches ? parseInt(sanitizedInches, 10) : 0;
        const totalInches = Math.min((ftValue * 12) + inchValue, maxTotalInches);
        finalHeightCm = Number((totalInches * 2.54).toFixed(1));
        finalHeightFt = ftValue || null;
        finalHeightIn = inchValue || null;
        if (finalHeightFt !== null || finalHeightIn !== null) {
          finalHeightImperial = [finalHeightFt || 0, finalHeightIn || 0];
        }
      }

      // Convert weight values
      const sanitizedMetricWeight = clampWeightValue(weightKg, MAX_WEIGHT_KG);
      const sanitizedImperialWeight = clampWeightValue(weightLbs, MAX_WEIGHT_LBS);
      setWeightKg(sanitizedMetricWeight);
      setWeightLbs(sanitizedImperialWeight);

      let finalWeightKg = 0;
      let finalWeightLbs = null;

      if (weightUseMetric) {
        finalWeightKg = parseFloat(sanitizedMetricWeight) || 0;
        if (finalWeightKg) {
          finalWeightLbs = Number((finalWeightKg * 2.2046226218).toFixed(1));
        }
      } else if (sanitizedImperialWeight) {
        const lbsValue = parseFloat(sanitizedImperialWeight) || 0;
        finalWeightLbs = lbsValue || null;
        if (lbsValue) {
          finalWeightKg = Number((lbsValue * 0.45359237).toFixed(1));
        }
      }

      // Validate birthday format
      let finalBirthday = birthday;
      if (birthday && birthday.length === 10) {
        // Check if it's a valid date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(birthday)) {
          finalBirthday = null;
        }
      } else if (birthday && birthday.length > 0) {
        // If birthday is provided but not in correct format, set to null
        finalBirthday = null;
      } else {
        finalBirthday = null;
      }

      const defaultMeasurements = [
        heightUseMetric ? METRIC : IMPERIAL,
        weightUseMetric ? METRIC : IMPERIAL,
      ];

      const updates = {
        id: user.data.user.id,
        sex: userSex || null,
        height_cm: finalHeightCm || null,
        height_imperial: finalHeightImperial,
        weight_kg: finalWeightKg || null,
        weight_lbs: finalWeightLbs !== null ? finalWeightLbs : null,
        birthday: finalBirthday,
        activity_level: activityLevel || null,
        weight_goal: weightGoal || null,
        default_measurements: defaultMeasurements,
      };

      const { error } = await supabase
        .from('users')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!manualEntry) {
        const autoCalories = calculateAutoCalories({
          sex: userSex,
          birthday: finalBirthday,
          heightCm: finalHeightCm,
          weightKg: finalWeightKg,
          activityLevel,
          weightGoal,
        });

        if (autoCalories) {
          const macroTargets = buildMacroTargets({
            calories: autoCalories,
            dietKey: dietType,
            dailyValues,
          });
          const updatedDailyValues = {
            ...(dailyValues || {}),
            dailyCalories: autoCalories,
            manual_entry: false,
          };
          if (macroTargets) {
            updatedDailyValues.dailyCarbs = macroTargets.dailyCarbs;
            updatedDailyValues.dailyProtein = macroTargets.dailyProtein;
            updatedDailyValues.dailyFat = macroTargets.dailyFat;
          }

          const { error: dailyError } = await supabase
            .from('users')
            .update({ dailyValues: updatedDailyValues })
            .eq('id', user.data.user.id);

          if (dailyError) {
            console.error('Error updating calorie goal from profile:', dailyError);
          } else {
            setDailyValues(updatedDailyValues);
            setManualEntry(false);
          }
        }
      }

      // Reset imperial inputs
      setHeightFt('');
      setHeightIn('');
      setWeightLbs('');
      
      // Navigate back
      navigation.goBack();
    } catch (e) {
      console.error('Error saving profile:', e);
      // You could add an alert here to show the user what went wrong
      // Alert.alert('Error', 'Failed to save profile. Please try again.');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveProfile();
    } finally {
      setSaving(false);
    }
  };

  const toggleHeightUnits = () => {
    setHeightUseMetric(!heightUseMetric);
    // Auto-focus appropriate input when switching units
    setTimeout(() => {
      if (heightUseMetric) {
        heightFtRef.current?.focus();
      } else {
        heightCmRef.current?.focus();
      }
    }, 100);
  };

  const toggleWeightUnits = () => {
    setWeightUseMetric(!weightUseMetric);
    // Auto-focus appropriate input when switching units
    setTimeout(() => {
      if (weightUseMetric) {
        weightLbsRef.current?.focus();
      } else {
        weightKgRef.current?.focus();
      }
    }, 100);
  };

  // Live preview of the targets Save will write (read-only; saving still
  // runs the full sanitize + calculate path in saveProfile).
  const previewHeightCm = heightUseMetric
    ? parseFloat(heightCm) || 0
    : (((parseInt(heightFt, 10) || 0) * 12) + (parseInt(heightIn, 10) || 0)) * 2.54;
  const previewWeightKg = weightUseMetric
    ? parseFloat(weightKg) || 0
    : (parseFloat(weightLbs) || 0) * 0.45359237;
  const previewCalories = manualEntry
    ? null
    : calculateAutoCalories({
        sex: userSex,
        birthday,
        heightCm: previewHeightCm,
        weightKg: previewWeightKg,
        activityLevel,
        weightGoal,
      });
  const previewMacros = previewCalories
    ? buildMacroTargets({ calories: previewCalories, dietKey: dietType, dailyValues })
    : null;
  const targets = {
    calories: previewCalories || dailyValues?.dailyCalories || 0,
    protein: previewMacros?.dailyProtein ?? dailyValues?.dailyProtein ?? 0,
    carbs: previewMacros?.dailyCarbs ?? dailyValues?.dailyCarbs ?? 0,
    fat: previewMacros?.dailyFat ?? dailyValues?.dailyFat ?? 0,
  };
  const hasTargets = targets.calories > 0;
  const age = calculateAgeFromBirthday(birthday);
  const goalDirection = goalDirectionOf(weightGoal);
  const goalPace = goalPaceOf(weightGoal);
  const paceRate = (GOAL_PACES.find((pace) => pace.value === goalPace) || GOAL_PACES[1]).rate;
  const firstTimeSetup = Boolean(route?.params?.firstTimeSetup);

  let targetsNote;
  if (manualEntry) {
    targetsNote = "You set these by hand, so saving here won't change them.";
  } else if (previewCalories) {
    targetsNote = 'Estimated from your details. Tap Save to use them.';
  } else if (!age) {
    targetsNote = 'Add your birthday to your account to estimate targets.';
  } else {
    targetsNote = 'Fill in your height and weight to estimate targets.';
  }

  const macroItems = [
    { key: 'protein', label: 'protein', value: targets.protein, color: c.protein },
    { key: 'carbs', label: 'carbs', value: targets.carbs, color: c.carbs },
    { key: 'fat', label: 'fat', value: targets.fat, color: c.fat },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Screen
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        contentStyle={styles.content}
      >
        <FadeIn index={0}>
          <Txt variant="body" tone="muted">
            {firstTimeSetup
              ? "Let's set your daily targets. You can change these any time."
              : 'We use these to set your daily calories and macros.'}
          </Txt>
        </FadeIn>

        {/* Targets */}
        <FadeIn index={1}>
          <Card tone="ink" style={styles.targetsCard}>
            <Txt variant="overline" tone="inverse" style={styles.dim}>Daily targets</Txt>
            <View style={styles.caloriesRow}>
              {hasTargets ? (
                <NumberTicker value={targets.calories} variant="display" color={c.inverse} />
              ) : (
                <Txt variant="display" tone="inverse">—</Txt>
              )}
              <Txt variant="small" tone="inverse" style={styles.dim}>calories a day</Txt>
            </View>
            <View style={styles.macroRow}>
              {macroItems.map((item) => (
                <View key={item.key} style={styles.macroItem}>
                  <View style={styles.macroValue}>
                    <View style={[styles.macroDot, { backgroundColor: item.color }]} />
                    {hasTargets ? (
                      <NumberTicker value={item.value} color={c.inverse} format={(n) => `${Math.round(n)}g`} />
                    ) : (
                      <Txt variant="number" tone="inverse">—</Txt>
                    )}
                  </View>
                  <Txt variant="caption" tone="inverse" style={styles.dim}>{item.label}</Txt>
                </View>
              ))}
            </View>
            <Txt variant="caption" tone="inverse" style={styles.dim}>{targetsNote}</Txt>
          </Card>
        </FadeIn>

        {/* About you */}
        <FadeIn index={2} style={styles.group}>
          <Txt variant="overline" tone="muted" style={styles.overline}>About you</Txt>
          <Card style={styles.cardBody}>
            <View style={styles.field}>
              <Txt variant="small" style={styles.label}>Sex</Txt>
              <Segmented
                options={SEX_SEGMENTS}
                value={userSex}
                onChange={(option) => {
                  setUserSex(option);
                  setSexOptionsExpanded(false);
                }}
              />
            </View>
            <Divider />
            <Row
              style={styles.plainRow}
              title="Age"
              subtitle={age ? 'From your birthday' : 'Add your birthday to your account'}
              trailing={<Txt variant="number" style={styles.tabular}>{age ? age : '—'}</Txt>}
            />
          </Card>
        </FadeIn>

        {/* Body */}
        <FadeIn index={3} style={styles.group}>
          <Txt variant="overline" tone="muted" style={styles.overline}>Body</Txt>
          <Card style={styles.cardBody}>
            <View style={styles.field}>
              <View style={styles.fieldHead}>
                <Txt variant="small" style={styles.label}>Height</Txt>
                <View style={styles.unitSwitch}>
                  <Segmented
                    options={HEIGHT_UNITS}
                    value={heightUseMetric ? METRIC : IMPERIAL}
                    onChange={(unit) => {
                      if ((unit === METRIC) !== heightUseMetric) toggleHeightUnits();
                    }}
                  />
                </View>
              </View>
              {heightUseMetric ? (
                <UnitField
                  unit="cm"
                  ref={heightCmRef}
                  accessibilityLabel="Height in centimeters"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="decimal-pad"
                  placeholder="Height"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    setHeightCm(current => clampHeightCmValue(current));
                  }}
                  onEndEditing={() => {
                    setHeightCm(current => clampHeightCmValue(current));
                  }}
                />
              ) : (
                <View style={styles.pair}>
                  <UnitField
                    unit="ft"
                    ref={heightFtRef}
                    style={styles.flex}
                    accessibilityLabel="Height, feet"
                    value={heightFt}
                    onChangeText={(text) => {
                      const numericText = text.replace(/[^0-9]/g, '').slice(0, 1);
                      setHeightFt(numericText);
                    }}
                    keyboardType="number-pad"
                    placeholder="Feet"
                    maxLength={1}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      setHeightFt(current => clampHeightFtValue(current));
                    }}
                    onEndEditing={() => {
                      setHeightFt(current => clampHeightFtValue(current));
                    }}
                  />
                  <UnitField
                    unit="in"
                    ref={heightInRef}
                    style={styles.flex}
                    accessibilityLabel="Height, inches"
                    value={heightIn}
                    onChangeText={(text) => {
                      const numericText = text.replace(/[^0-9]/g, '').slice(0, 2);
                      setHeightIn(numericText);
                    }}
                    keyboardType="number-pad"
                    placeholder="Inches"
                    maxLength={2}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      setHeightIn(current => clampHeightInValue(current));
                    }}
                    onEndEditing={() => {
                      setHeightIn(current => clampHeightInValue(current));
                    }}
                  />
                </View>
              )}
            </View>

            <View style={styles.field}>
              <View style={styles.fieldHead}>
                <Txt variant="small" style={styles.label}>Weight</Txt>
                <View style={styles.unitSwitch}>
                  <Segmented
                    options={WEIGHT_UNITS}
                    value={weightUseMetric ? METRIC : IMPERIAL}
                    onChange={(unit) => {
                      if ((unit === METRIC) !== weightUseMetric) toggleWeightUnits();
                    }}
                  />
                </View>
              </View>
              {weightUseMetric ? (
                <UnitField
                  unit="kg"
                  ref={weightKgRef}
                  accessibilityLabel="Weight in kilograms"
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="decimal-pad"
                  placeholder="Weight"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    setWeightKg(current => clampWeightValue(current, MAX_WEIGHT_KG));
                  }}
                />
              ) : (
                <UnitField
                  unit="lb"
                  ref={weightLbsRef}
                  accessibilityLabel="Weight in pounds"
                  value={weightLbs}
                  onChangeText={setWeightLbs}
                  keyboardType="decimal-pad"
                  placeholder="Weight"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    setWeightLbs(current => clampWeightValue(current, MAX_WEIGHT_LBS));
                  }}
                />
              )}
            </View>
          </Card>
        </FadeIn>

        {/* Activity Level */}
        <FadeIn index={4} style={styles.group}>
          <Txt variant="overline" tone="muted" style={styles.overline}>Activity level</Txt>
          <Card padded={false}>
            {ACTIVITY_OPTIONS.map((option, i) => {
              const display = describeActivity(option);
              return (
                <View key={option}>
                  {i > 0 ? <Divider style={styles.listDivider} /> : null}
                  <ChoiceRow
                    title={display.title}
                    subtitle={display.subtitle}
                    selected={activityLevel === option}
                    onPress={() => {
                      Keyboard.dismiss();
                      setActivityLevel(option);
                      setActivityDropdownOpen(false);
                    }}
                  />
                </View>
              );
            })}
          </Card>
          {activityLevel && !ACTIVITY_OPTIONS.includes(activityLevel) ? (
            <Txt variant="caption" tone="muted" style={styles.overline}>Currently saved: {activityLevel}</Txt>
          ) : null}
        </FadeIn>

        {/* Weight Goal */}
        <FadeIn index={5} style={styles.group}>
          <Txt variant="overline" tone="muted" style={styles.overline}>Weight goal</Txt>
          <Card style={styles.cardBody}>
            <Segmented
              options={GOAL_DIRECTIONS}
              value={goalDirection}
              onChange={(direction) => {
                Keyboard.dismiss();
                setWeightGoal(goalOptionFor(direction, goalPace));
                setWeightGoalDropdownOpen(false);
              }}
            />
            {goalDirection === 'lose' || goalDirection === 'gain' ? (
              <View style={styles.field}>
                <Txt variant="small" style={styles.label}>Pace</Txt>
                <View style={styles.chipWrap}>
                  {GOAL_PACES.map((pace) => (
                    <Chip
                      key={pace.value}
                      label={pace.label}
                      active={goalPace === pace.value}
                      onPress={() => setWeightGoal(goalOptionFor(goalDirection, pace.value))}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            <Txt variant="small" tone="muted">
              {goalDirection === 'maintain'
                ? 'Stay where you are and fuel your days.'
                : goalDirection === 'lose'
                  ? `Losing about ${paceRate}. Slower is easier to keep up.`
                  : goalDirection === 'gain'
                    ? `Gaining about ${paceRate}, a small surplus to build muscle.`
                    : weightGoal
                      ? `Currently saved: ${weightGoal}`
                      : 'Pick a direction to tune your calories.'}
            </Txt>
          </Card>
        </FadeIn>
      </Screen>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <View style={styles.barSide}>
          <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.flex}>
          <Button title="Save" onPress={handleSave} loading={saving} size="lg" />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Kit TextField with the unit tucked in on the right (ref reaches the input).
function UnitField({ unit, style, ...rest }) {
  const { c } = useAppTheme();
  return (
    <View style={[{ justifyContent: 'center' }, style]}>
      <TextField {...rest} inputStyle={{ paddingRight: space.xxl }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: space.lg, top: 0, bottom: 0, justifyContent: 'center' }}>
        <Txt variant="small" color={c.muted}>{unit}</Txt>
      </View>
    </View>
  );
}

// A selectable list row with a check when chosen.
function ChoiceRow({ title, subtitle, selected, onPress }) {
  const { c } = useAppTheme();
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ selected: !!selected, checked: !!selected }}
    >
      <Row
        style={{ paddingHorizontal: space.lg, minHeight: 60 }}
        title={title}
        subtitle={subtitle}
        trailing={
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={selected ? c.ink : c.faint}
          />
        }
      />
    </Tap>
  );
}

const makeStyles = (c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  content: { gap: space.xl, paddingTop: space.sm, paddingBottom: space.xxl },
  flex: { flex: 1 },
  group: { gap: space.sm },
  overline: { paddingHorizontal: space.xs },
  cardBody: { gap: space.lg },
  field: { gap: space.sm },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  label: { fontFamily: fonts.semibold },
  unitSwitch: { width: 132 },
  pair: { flexDirection: 'row', gap: space.sm },
  plainRow: { paddingVertical: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  listDivider: { marginLeft: space.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  targetsCard: { gap: space.lg },
  dim: { opacity: 0.72 },
  caloriesRow: { gap: space.xs },
  macroRow: { flexDirection: 'row', gap: space.lg },
  macroItem: { flex: 1, gap: 2 },
  macroValue: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
  barSide: { minWidth: 96 },
});
