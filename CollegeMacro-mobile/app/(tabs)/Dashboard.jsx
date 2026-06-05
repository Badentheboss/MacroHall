// Dashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, TouchableWithoutFeedback } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import { Svg, Circle } from 'react-native-svg';
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
import AnimatedProgressWheel from "react-native-progress-wheel";
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

const MACRO_COLORS = {
  carbs: '#F4A261',
  protein: '#2A9D8F',
  fat: '#E76F51',
};

const DietPieChart = ({ carbs, protein, fat, size = 72, strokeWidth = 12 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: carbs, color: MACRO_COLORS.carbs },
    { value: protein, color: MACRO_COLORS.protein },
    { value: fat, color: MACRO_COLORS.fat },
  ];

  let cumulative = 0;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={MACRO_COLORS.carbs}
        strokeWidth={strokeWidth}
        opacity={0.08}
        fill="transparent"
      />
      {segments.map((segment, index) => {
        const startValue = cumulative;
        const dashArray = circumference;
        const dashOffset = circumference - (segment.value / 100) * circumference;
        cumulative += segment.value;

        return (
          <Circle
            key={`${segment.color}-${index}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashArray} ${dashArray}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            fill="transparent"
            rotation={-90 + (startValue / 100) * 360}
            origin={`${size / 2}, ${size / 2}`}
          />
        );
      })}
    </Svg>
  );
};

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

  // Move styles inside component to access isDarkMode
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : "#f5f7fa",
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 40, // Add extra padding at bottom for better scrolling
    },
    dateText: {
      fontSize: 28,
      fontWeight: "800",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      marginBottom: 24,
      marginTop: 12,
    },
    caloriesCard: {
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      borderRadius: 20,
      padding: 24,
      shadowColor: isDarkMode ? "#000" : "#32745f",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 5,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      letterSpacing: 0.5,
    },
    editButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(224, 224, 224, 0.1)' : "rgba(50, 116, 95, 0.1)",
    },
    editButtonText: {
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      fontSize: 14,
      fontWeight: "600",
    },
    caloriesContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    wheelContainer: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      padding: 10,
    },
    wheelCenter: {
      position: "absolute",
      alignItems: "center",
      backgroundColor: isDarkMode ? 'rgba(36, 36, 36, 0.9)' : "rgba(255, 255, 255, 0.9)",
      borderRadius: 35,
      padding: 15,
    },
    remainingText: {
      fontSize: 28,
      fontWeight: "800",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
    },
    remainingLabel: {
      fontSize: 14,
      color: isDarkMode ? '#888' : "#666",
      fontWeight: "600",
      marginTop: 4,
    },
    caloriesSummary: {
      marginLeft: 24,
      padding: 16,
      borderRadius: 16,
      minWidth: 140,
    },
    summaryItem: {
      marginBottom: 12,
    },
    summaryLabel: {
      fontSize: 14,
      color: isDarkMode ? '#888' : "#666",
      marginBottom: 4,
      fontWeight: "600",
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
    },
    macrosCard: {
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      borderRadius: 20,
      padding: 24,
      shadowColor: isDarkMode ? "#000" : "#32745f",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 5,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    macrosContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 20,
      paddingHorizontal: 10,
    },
    macroWheel: {
      alignItems: "center",
      borderRadius: 16,
      padding: 16,
      width: '25%',
    },
    macroCenter: {
      position: "absolute",
      top: "50%",
      left: "90%",
      transform: [
        { translateX: -25 },
        { translateY: -25 }
      ],
      width: 50,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkMode ? '#242424' : "#fff",      
      borderRadius: 25,
      padding: 5,
    },
    macroValue: {
      fontSize: 14,
      fontWeight: "700",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      textAlign: "center",
    },
    macroLabel: {
      fontSize: 10,
      color: isDarkMode ? '#888' : "#666",      
      fontWeight: "600",
      marginTop: 1,
      textAlign: "center",
    },
    macroTotal: {
      fontSize: 14,
      color: isDarkMode ? '#888' : "#666",      
      fontWeight: '500',
      marginTop: 10,
      paddingVertical: 3,
      paddingHorizontal: 6,
      borderRadius: 6,
      width: 200,
      textAlign: 'center',
    },
    dietActivePill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDarkMode ? '#1f3c32' : 'rgba(50,116,95,0.12)',
    },
    dietActiveText: {
      color: '#32745f',
      fontWeight: '600',
      fontSize: 13,
    },
    dietSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDarkMode ? '#E0E0E0' : '#2D5A47',
      marginTop: 24,
      marginBottom: 12,
    },
    dietGrid: {
      gap: 12,
    },
    dietCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDarkMode ? '#2f2f2f' : 'rgba(50, 116, 95, 0.15)',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
      position: 'relative',
    },
    dietCardSelected: {
      borderColor: '#32745f',
      shadowColor: '#32745f',
      shadowOpacity: isDarkMode ? 0.35 : 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    dietChartWrapper: {
      marginRight: 16,
    },
    dietInfo: {
      flex: 1,
    },
    dietTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDarkMode ? '#E0E0E0' : '#2D5A47',
      marginBottom: 6,
    },
    dietMacrosRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    dietMacroPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#2b2b2b' : '#f5f5f5',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    dietMacroDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    dietMacroText: {
      fontSize: 12,
      color: isDarkMode ? '#ccc' : '#333',
      fontWeight: '600',
    },
    dietCheckIcon: {
      position: 'absolute',
      top: 10,
      right: 10,
    },
    dropdownOuter: {
      position: 'relative',
    },
    dietDropdown: {
      marginTop: 4,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#2f2f2f' : 'rgba(50, 116, 95, 0.2)',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dietDropdownOpen: {
      borderColor: '#32745f',
      shadowColor: '#32745f',
      shadowOpacity: isDarkMode ? 0.3 : 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    dropdownSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    dropdownSubtitle: {
      fontSize: 13,
      color: isDarkMode ? '#bbb' : '#555',
      marginTop: 2,
    },
    dropdownListContainer: {
      marginTop: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDarkMode ? '#2f2f2f' : 'rgba(50, 116, 95, 0.15)',
      backgroundColor: isDarkMode ? '#121212' : '#fff',
      gap: 12,
      padding: 12,
    },
    micronutrientsCard: {
      backgroundColor: isDarkMode ? '#242424' : '#fff',
      borderRadius: 20,
      padding: 24,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
      shadowColor: isDarkMode ? "#000" : "#32745f",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    microGrid: {
      gap: 16,
    },
    microItem: {
      marginBottom: 16,
    },
    microHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    microLabel: {
      fontSize: 14,
      color: isDarkMode ? '#E0E0E0' : '#333',
      fontWeight: '600',
    },
    microProgress: {
      fontSize: 14,
      color: isDarkMode ? '#888' : '#666',
    },
    progressBarContainer: {
      height: 8,
      backgroundColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.1)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: '#32745f',
    },
    percentageText: {
      fontSize: 12,
      color: isDarkMode ? '#888' : '#666',
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      marginBottom: 16,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContent: {
      width: '90%',
      backgroundColor: isDarkMode ? '#242424' : '#fff',
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.1)'
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      marginBottom: 16,
      textAlign: 'center'
    },
    input: {
      backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: isDarkMode ? '#E0E0E0' : '#333',
      fontSize: 16,
      marginBottom: 20,
      textAlign: 'center'
    },
    modeToggleRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    modeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#2b2b2b' : '#f5f5f5',
    },
    modeButtonActive: {
      borderColor: '#32745f',
      backgroundColor: isDarkMode ? 'rgba(50,116,95,0.2)' : 'rgba(50,116,95,0.15)',
    },
    modeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#2D5A47',
    },
    modeButtonTextActive: {
      color: '#32745f',
    },
    modalDescription: {
      fontSize: 14,
      color: isDarkMode ? '#bbb' : '#555',
      textAlign: 'center',
    },
    recommendationBox: {
      backgroundColor: isDarkMode ? '#2b2b2b' : '#f4f8f6',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.2)',
      marginBottom: 20,
      alignItems: 'center',
      minHeight: 150,
      justifyContent: 'center',
    },
    recommendationValue: {
      fontSize: 32,
      fontWeight: '800',
      color: '#32745f',
      marginVertical: 8,
      textAlign: 'center',
    },
    recommendationDetail: {
      fontSize: 14,
      color: isDarkMode ? '#bbb' : '#555',
      marginTop: 4,
    },
    profileButton: {
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#32745f',
      alignItems: 'center',
    },
    profileButtonText: {
      color: '#32745f',
      fontWeight: '600',
    },
    errorText: {
      color: '#f87171',
      fontSize: 14,
      textAlign: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center'
    },
    cancelButton: {
      backgroundColor: isDarkMode ? '#444' : '#f0f0f0',
      borderWidth: 1,
      borderColor: isDarkMode ? '#555' : '#ddd'
    },
    saveButton: {
      backgroundColor: isDarkMode ? '#32745f' : '#32745f'
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600'
    },
    cancelButtonText: {
      color: isDarkMode ? '#E0E0E0' : '#333'
    },
    saveButtonText: {
      color: '#fff'
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
    }
  });

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
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
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

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.dateText}>{formatDate(currentDate)}</Text>

      {/* Calories Section */}
      <View style={styles.caloriesCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Calories</Text>
          <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.caloriesContent}>
          <View style={styles.wheelContainer}>
            <AnimatedProgressWheel
              size={150}
              width={15}
              color="#32745f"
              backgroundColor={isDarkMode ? '#333' : "#E8F5E9"}
              progress={(nutritionTotals.calories / (userDailyValues?.dailyCalories || 2000)) * 100}
              rotation="-90deg"
              clockwise={true}
              animateFromValue={0}
            />
            <View style={styles.wheelCenter}>
              <Text style={styles.remainingText}>
                {remainingCalories >= 0 ? remainingCalories : Math.abs(remainingCalories)}
              </Text>
              <Text style={styles.remainingLabel}>
                {remainingCalories >= 0 ? 'remaining' : 'over'}
              </Text>
            </View>
          </View>

          <View style={styles.caloriesSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Goal:</Text>
              <Text style={styles.summaryValue}>{userDailyValues?.dailyCalories || 2000} Cals</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Progress:</Text>
              <Text style={styles.summaryValue}>{nutritionTotals.calories} Cals</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Macros Section */}
      <View style={styles.macrosCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Macros</Text>
          <View style={styles.dietActivePill}>
            <Text style={styles.dietActiveText}>
              {selectedDiet ? selectedDiet.title : 'Select a diet type'}
            </Text>
          </View>
        </View>
        <View style={styles.macrosContent}>
          <View style={styles.macroWheel}>
            <AnimatedProgressWheel
              size={100}
              width={12}
              color="#2196F3"
              backgroundColor={isDarkMode ? '#333' : "#E3F2FD"}
              progress={(nutritionTotals.protein / (userDailyValues?.dailyProtein || 50)) * 100}
              rotation="-90deg"
              clockwise={true}
              animateFromValue={0}
            />
            <View style={styles.macroCenter}>
              <Text style={styles.macroValue}>{nutritionTotals.protein}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <Text style={styles.macroTotal}>{userDailyValues?.dailyProtein || 50}g total</Text>
          </View>
          
          <View style={styles.macroWheel}>
            <AnimatedProgressWheel
              size={100}
              width={12}
              color="#4CAF50"
              backgroundColor={isDarkMode ? '#333' : "#E8F5E9"}
              progress={(nutritionTotals.carbs / (userDailyValues?.dailyCarbs || 275)) * 100}
              rotation="-90deg"
              clockwise={true}
              animateFromValue={0}
            />
            <View style={styles.macroCenter}>
              <Text style={styles.macroValue}>{nutritionTotals.carbs}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <Text style={styles.macroTotal}>{userDailyValues?.dailyCarbs || 275}g total</Text>
          </View>

          <View style={styles.macroWheel}>
            <AnimatedProgressWheel
              size={100}
              width={12}
              color="#FF9800"
              backgroundColor={isDarkMode ? '#333' : "#FFF3E0"}
              progress={(nutritionTotals.fat / (userDailyValues?.dailyFat || 60)) * 100}
              rotation="-90deg"
              clockwise={true}
              animateFromValue={0}
            />
            <View style={styles.macroCenter}>
              <Text style={styles.macroValue}>{nutritionTotals.fat}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
            <Text style={styles.macroTotal}>{userDailyValues?.dailyFat || 60}g total</Text>
          </View>
        </View>

        <Text style={styles.dietSectionTitle}>Diet Type</Text>
        <View style={styles.dropdownOuter}>
          <TouchableOpacity
            style={[styles.dietDropdown, dropdownOpen && styles.dietDropdownOpen]}
            activeOpacity={0.9}
            onPress={() => setDropdownOpen(prev => !prev)}
          >
            <View style={styles.dropdownSummary}>
              {selectedDiet ? (
                <>
                  <DietPieChart carbs={selectedDiet.caloriesSplit.carbs} protein={selectedDiet.caloriesSplit.protein} fat={selectedDiet.caloriesSplit.fat} size={48} strokeWidth={10} />
                  <View style={{ marginLeft: 14 }}>
                    <Text style={styles.dietTitle}>{selectedDiet.title}</Text>
                    <Text style={styles.dropdownSubtitle}>
                      {selectedDiet.caloriesSplit.carbs}% C / {selectedDiet.caloriesSplit.protein}% P / {selectedDiet.caloriesSplit.fat}% F
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.dietTitle}>Select a diet type</Text>
              )}
            </View>
            <MaterialIcons
              name={dropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color={isDarkMode ? '#E0E0E0' : '#2D5A47'}
            />
          </TouchableOpacity>
          {dropdownOpen && (
            <View style={styles.dropdownListContainer}>
              {DIET_TYPES.map(diet => {
                const isSelected = diet.key === selectedDietType;
                return (
                  <TouchableOpacity
                    key={diet.key}
                    style={[styles.dietCard, isSelected && styles.dietCardSelected]}
                    activeOpacity={0.9}
                    onPress={() => handleDietSelect(diet.key)}
                  >
                    <View style={styles.dietChartWrapper}>
                      <DietPieChart carbs={diet.caloriesSplit.carbs} protein={diet.caloriesSplit.protein} fat={diet.caloriesSplit.fat} />
                    </View>
                    <View style={styles.dietInfo}>
                      <Text style={styles.dietTitle}>{diet.title}</Text>
                      <View style={styles.dietMacrosRow}>
                        <View style={styles.dietMacroPill}>
                          <View style={[styles.dietMacroDot, { backgroundColor: MACRO_COLORS.carbs }]} />
                          <Text style={styles.dietMacroText}>Carbs {diet.caloriesSplit.carbs}%</Text>
                        </View>
                        <View style={styles.dietMacroPill}>
                          <View style={[styles.dietMacroDot, { backgroundColor: MACRO_COLORS.protein }]} />
                          <Text style={styles.dietMacroText}>Protein {diet.caloriesSplit.protein}%</Text>
                        </View>
                        <View style={styles.dietMacroPill}>
                          <View style={[styles.dietMacroDot, { backgroundColor: MACRO_COLORS.fat }]} />
                          <Text style={styles.dietMacroText}>Fat {diet.caloriesSplit.fat}%</Text>
                        </View>
                      </View>
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check-circle" size={22} color="#32745f" style={styles.dietCheckIcon} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Micronutrients Section */}
      <View style={styles.micronutrientsCard}>
        <Text style={styles.sectionTitle}>Micronutrients</Text>
        <View style={styles.microGrid}>
          {Object.entries(recommendedDailyValues).map(([nutrient, recommendedValue]) => {
            const currentValue = nutritionTotals[nutrient] || 0;
            const percentage = Math.round((currentValue / recommendedValue) * 100);
            const nutrientLabel = formatNutrientValue(nutrient, currentValue);
            const percentLabel = formatPercentOfDailyValue(nutrient, currentValue);
            
            return (
              <View key={nutrient} style={styles.microItem}>
                <View style={styles.microHeader}>
                  <Text style={styles.microLabel}>
                    {nutrient.split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </Text>
                  <Text style={styles.microProgress}>
                    {nutrientLabel} / {formatNutrientValue(nutrient, recommendedValue)}
                  </Text>
                </View>
                
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { 
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: '#32745f'
                      }
                    ]} 
                  />
                </View>
                
                <Text style={[
                  styles.percentageText,
                  { color: isDarkMode ? '#E0E0E0' : '#32745f' }
                ]}>
                  {percentLabel || `${percentage}% Recommended Daily Value`}
                </Text>
              </View>
            );
          })}
        </View>
        </View>
      </ScrollView>

      {/* Edit Calorie Goal Modal */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={closeEditModal}>
        <TouchableWithoutFeedback onPress={closeEditModal}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Set Calorie Goal</Text>
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      calorieMode === 'manual' && styles.modeButtonActive
                    ]}
                    onPress={() => handleCalorieModeChange('manual')}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        calorieMode === 'manual' && styles.modeButtonTextActive
                      ]}
                    >
                      Manual entry
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      calorieMode === 'personal' && styles.modeButtonActive
                    ]}
                    onPress={() => handleCalorieModeChange('personal')}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        calorieMode === 'personal' && styles.modeButtonTextActive
                      ]}
                    >
                      Use personal data
                    </Text>
                  </TouchableOpacity>
                </View>

                {calorieMode === 'manual' ? (
                  <TextInput
                    style={styles.input}
                    value={calorieInput}
                    onChangeText={setCalorieInput}
                    keyboardType="numeric"
                    placeholder="Enter daily calories"
                    placeholderTextColor={isDarkMode ? '#888' : '#999'}
                    returnKeyType="done"
                  />
                ) : (
                  <View style={styles.recommendationBox}>
                    {calorieCalcError ? (
                      <>
                        <Text style={styles.errorText}>{calorieCalcError}</Text>
                        <TouchableOpacity 
                          style={styles.profileButton} 
                          onPress={goToProfileScreen}
                        >
                          <Text style={styles.profileButtonText}>Adjust profile</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.modalDescription}>
                          Based on your profile, we recommend
                        </Text>
                        <Text style={styles.recommendationValue}>
                          {calorieAutoValue ? `${calorieAutoValue} cals/day` : '—'}
                        </Text>
                        <Text style={styles.recommendationDetail}>
                          Activity: {profileData?.activity_level || 'Not set'}
                        </Text>
                        <Text style={styles.recommendationDetail}>
                          Goal: {profileData?.weight_goal || 'Not set'}
                        </Text>
                        <TouchableOpacity 
                          style={styles.profileButton} 
                          onPress={goToProfileScreen}
                        >
                          <Text style={styles.profileButtonText}>Adjust profile</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
                
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={[styles.button, styles.cancelButton]} 
                    onPress={closeEditModal}
                  >
                    <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.button, styles.saveButton]} 
                    onPress={saveCalorieGoal}
                  >
                    <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Removed Profile Modal - moved to UserProfile screen */}
    </>
  );
}
