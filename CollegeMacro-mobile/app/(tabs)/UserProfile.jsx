// UserProfile.jsx
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, ScrollView, Keyboard, Alert } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from "../../utils/config";
import { buildMacroTargets, DEFAULT_DIET_KEY } from "../../utils/macros";
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

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
  const navigation = useNavigation();
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : "#f5f7fa",
    },
    contentContainer: {
      flex: 1,
      padding: 20,
      paddingBottom: 60,
    },
    keyboardAwareContainer: {
      flex: 1,
      padding: keyboardVisible ? 15 : 20,
      paddingBottom: keyboardVisible ? 40 : 60,
    },
    scrollContainer: {
      flex: 1,
      flexGrow: 1,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      paddingTop: 30,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      top: 20,
      padding: 8,
      borderRadius: 20,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    },
    card: {
      backgroundColor: isDarkMode ? '#242424' : '#fff',
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.1)',
      shadowColor: isDarkMode ? '#000' : '#32745f',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDarkMode ? 0.4 : 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    label: {
      fontSize: 18,
      fontWeight: '700',
      color: isDarkMode ? '#E0E0E0' : '#2D5A47',
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      color: isDarkMode ? '#E0E0E0' : '#2D5A47',
      fontSize: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#E0E0E0',
    },
    inputFocused: {
      borderColor: '#32745f',
      shadowColor: '#32745f',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: isDarkMode ? '#444' : '#F8F9FA',
      borderWidth: 1,
      borderColor: isDarkMode ? '#555' : '#DEE2E6',
    },
    saveButton: {
      backgroundColor: '#2D5A47',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: isDarkMode ? '#E0E0E0' : '#6C757D',
    },
    saveButtonText: {
      color: '#fff',
    },
    // Removed duplicate unitToggle styles
    sexOption: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
      minHeight: 48, // Better tap target
    },
    sexOptionText: {
      fontSize: 17,
      fontWeight: '600',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    unitToggle: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#555' : '#ddd',
    },
    unitToggleText: {
      color: isDarkMode ? '#E0E0E0' : '#333',
      fontSize: 13,
      fontWeight: '600',
    },
    dropdownButton: {
      backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#E0E0E0',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dropdownButtonText: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : '#2D5A47',
    },
    dropdownPlaceholder: {
      color: isDarkMode ? '#888' : '#999',
    },
    dropdownList: {
      marginTop: 8,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#2b2b2b' : '#fff',
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#E0E0E0',
      overflow: 'hidden',
    },
    dropdownOption: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    dropdownOptionSelected: {
      backgroundColor: isDarkMode ? 'rgba(50,116,95,0.3)' : 'rgba(50,116,95,0.08)',
    },
    dropdownOptionText: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : '#2D5A47',
    },
    dropdownOptionTextSelected: {
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color={isDarkMode ? '#E0E0E0' : '#32745f'} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        contentContainerStyle={{ 
          paddingBottom: 300,
          backgroundColor: isDarkMode ? '#242424' : '#fff',
          borderRadius: 20,
          padding: 20,
          margin: 20,
          borderWidth: 1,
          borderColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.1)',
          shadowColor: isDarkMode ? '#000' : '#32745f',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDarkMode ? 0.4 : 0.15,
          shadowRadius: 16,
          elevation: 8,
          minHeight: 800,
        }}
        nestedScrollEnabled={true}
        automaticallyAdjustKeyboardInsets={true}
      >
          {/* Sex Selection */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Sex</Text>
            {(!userSex || sexOptionsExpanded) ? (
              SEX_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option}
                  onPress={() => {
                    setUserSex(option);
                    setSexOptionsExpanded(false);
                  }}
                  style={[
                    styles.sexOption,
                    {
                      borderColor: userSex === option ? '#32745f' : (isDarkMode ? '#555' : '#ccc'),
                      backgroundColor: userSex === option ? (isDarkMode ? 'rgba(50,116,95,0.3)' : 'rgba(50,116,95,0.1)') : 'transparent'
                    }
                  ]}
                >
                  <Text style={[
                    styles.sexOptionText,
                    {
                      color: isDarkMode ? '#E0E0E0' : '#333',
                      fontWeight: userSex === option ? '600' : '400',
                      textTransform: option === 'prefer not to say' ? 'none' : 'capitalize'
                    }
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                onPress={() => setSexOptionsExpanded(true)}
                style={[
                  styles.sexOption,
                  {
                    borderColor: '#32745f',
                    backgroundColor: isDarkMode ? 'rgba(50,116,95,0.3)' : 'rgba(50,116,95,0.1)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }
                ]}
              >
                <Text
                  style={[
                    styles.sexOptionText,
                    {
                      color: isDarkMode ? '#E0E0E0' : '#333',
                      fontWeight: '600',
                      textTransform: userSex === 'prefer not to say' ? 'none' : 'capitalize'
                    }
                  ]}
                >
                  {userSex}
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={20}
                  color={isDarkMode ? '#E0E0E0' : '#32745f'}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Height */}
          <View style={{ marginBottom: 16 }}>
            <View style={styles.inputRow}>
              <Text style={styles.label}>Height</Text>
              <TouchableOpacity 
                onPress={() => {
                  setHeightUseMetric(!heightUseMetric);
                  // Auto-focus appropriate input when switching units
                  setTimeout(() => {
                    if (heightUseMetric) {
                      heightFtRef.current?.focus();
                    } else {
                      heightCmRef.current?.focus();
                    }
                  }, 100);
                }}
                style={styles.unitToggle}
              >
                <Text style={styles.unitToggleText}>
                  {heightUseMetric ? 'cm' : 'ft/in'}
                </Text>
              </TouchableOpacity>
            </View>
            {heightUseMetric ? (
              <TextInput
                ref={heightCmRef}
                style={styles.input}
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="decimal-pad"
                placeholder="Enter height (cm)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                returnKeyType="done"
                onSubmitEditing={() => {
                  setHeightCm(current => clampHeightCmValue(current));
                }}
                onEndEditing={() => {
                  setHeightCm(current => clampHeightCmValue(current));
                }}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  ref={heightFtRef}
                  style={[styles.input, { flex: 1 }]}
                  value={heightFt}
                  onChangeText={(text) => {
                    const numericText = text.replace(/[^0-9]/g, '').slice(0, 1);
                    setHeightFt(numericText);
                  }}
                  keyboardType="number-pad"
                  placeholder="ft"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                  maxLength={1}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    setHeightFt(current => clampHeightFtValue(current));
                  }}
                  onEndEditing={() => {
                    setHeightFt(current => clampHeightFtValue(current));
                  }}
                />
                <TextInput
                  ref={heightInRef}
                  style={[styles.input, { flex: 1 }]}
                  value={heightIn}
                  onChangeText={(text) => {
                    const numericText = text.replace(/[^0-9]/g, '').slice(0, 2);
                    setHeightIn(numericText);
                  }}
                  keyboardType="number-pad"
                  placeholder="in"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
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

          {/* Weight */}
          <View style={{ marginBottom: 16 }}>
            <View style={styles.inputRow}>
              <Text style={styles.label}>Weight</Text>
              <TouchableOpacity 
                onPress={() => {
                  setWeightUseMetric(!weightUseMetric);
                  // Auto-focus appropriate input when switching units
                  setTimeout(() => {
                    if (weightUseMetric) {
                      weightLbsRef.current?.focus();
                    } else {
                      weightKgRef.current?.focus();
                    }
                  }, 100);
                }}
                style={styles.unitToggle}
              >
                <Text style={styles.unitToggleText}>
                  {weightUseMetric ? 'kg' : 'lbs'}
                </Text>
              </TouchableOpacity>
            </View>
            {weightUseMetric ? (
              <TextInput
                ref={weightKgRef}
                style={styles.input}
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
                placeholder="Enter weight (kg)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                returnKeyType="done"
                onSubmitEditing={() => {
                  setWeightKg(current => clampWeightValue(current, MAX_WEIGHT_KG));
                }}
              />
            ) : (
              <TextInput
                ref={weightLbsRef}
                style={styles.input}
                value={weightLbs}
                onChangeText={setWeightLbs}
                keyboardType="decimal-pad"
                placeholder="Enter weight (lbs)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                returnKeyType="done"
                onSubmitEditing={() => {
                  setWeightLbs(current => clampWeightValue(current, MAX_WEIGHT_LBS));
                }}
              />
            )}
          </View>

          {/* Activity Level */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Activity Level</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                Keyboard.dismiss();
                setActivityDropdownOpen(!activityDropdownOpen);
              }}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dropdownButtonText,
                  !activityLevel && styles.dropdownPlaceholder,
                ]}
              >
                {activityLevel || 'Select activity level'}
              </Text>
              <MaterialIcons
                name={activityDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={20}
                color={isDarkMode ? '#E0E0E0' : '#2D5A47'}
              />
            </TouchableOpacity>
            {activityDropdownOpen && (
              <View style={styles.dropdownList}>
                {ACTIVITY_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownOption,
                      activityLevel === option && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setActivityLevel(option);
                      setActivityDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        activityLevel === option && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Weight Goal */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Weight Goal</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                Keyboard.dismiss();
                setWeightGoalDropdownOpen(!weightGoalDropdownOpen);
              }}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dropdownButtonText,
                  !weightGoal && styles.dropdownPlaceholder,
                ]}
              >
                {weightGoal || 'Select weight goal'}
              </Text>
              <MaterialIcons
                name={weightGoalDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={20}
                color={isDarkMode ? '#E0E0E0' : '#2D5A47'}
              />
            </TouchableOpacity>
            {weightGoalDropdownOpen && (
              <View style={styles.dropdownList}>
                {WEIGHT_GOAL_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownOption,
                      weightGoal === option && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setWeightGoal(option);
                      setWeightGoalDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        weightGoal === option && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.button, styles.saveButton]} 
                  onPress={saveProfile}
                >
                  <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
                </TouchableOpacity>
              </View>
      </ScrollView>

    </View>
  );
}
