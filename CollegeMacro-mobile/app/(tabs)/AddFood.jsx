import React, { useState, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Keyboard,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import Reanimated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../utils/config";
import { useFocusEffect } from '@react-navigation/native';
import { formatNutrientDisplay, parseNutritionValue } from "../../utils/nutrients";
import { elevation, motion, radius, space, type, useAppTheme, useStyles } from "../../theme";
import {
  Button,
  Chip,
  ChipRow,
  Divider,
  EmptyState,
  FadeIn,
  FoodThumb,
  HeartButton,
  IconButton,
  Segmented,
  Tap,
  TextField,
  Txt,
} from "../../components/kit";
import * as ImagePicker from 'expo-image-picker';
import { fetchHalls, fetchMySchool, todayInTimezone } from "../../utils/schools";
import { postToBackend } from "../../utils/api";
import { dishKey, fetchFavoriteKeys, setFavorite } from "../../utils/favorites";
import { foodGlyph } from "../../utils/foodGlyph";

const ESTIMATED_SOURCES = new Set(['ai_estimated', 'crowdsourced']);
const MEAL_ORDER = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Brunch", value: "brunch" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Late night", value: "late night" },
];

const TOAST_OFFSET = 24;
const POPUP_VISIBLE_DURATION = 1500;
const POPUP_HIDE_DURATION = 200;
const CHECKMARK_VISIBLE_DURATION = 900;

const SORT_OPTIONS = [
  {
    key: 'none',
    title: 'No sorting',
    short: 'Menu order',
  },
  {
    key: 'calories-asc',
    title: 'Calories - Lowest to Highest',
    short: 'Fewest calories',
  },
  {
    key: 'calories-desc',
    title: 'Calories - Highest to Lowest',
    short: 'Most calories',
  },
  {
    key: 'protein-desc',
    title: 'Protein - Highest First',
    short: 'Most protein',
  },
  {
    key: 'fat-asc',
    title: 'Fat - Lowest First',
    short: 'Least fat',
  },
  {
    key: 'fat-desc',
    title: 'Fat - Highest First',
    short: 'Most fat',
  },
  {
    key: 'carbs-asc',
    title: 'Carbs - Lowest First',
    short: 'Fewest carbs',
  },
];

// Whole-number macro for display ("13.4" -> 13); null when missing.
const macroValue = (raw) => {
  const value = parseNutritionValue(raw);
  return value === null ? null : Math.round(value);
};
const macroText = (raw, unit = '') => {
  const value = macroValue(raw);
  return value === null ? '—' : `${value}${unit}`;
};

// Hall tiles: icon on top, name below. Vertical padding leaves room for the
// inactive tiles' soft shadow inside the horizontal scroller.
const hallStyles = StyleSheet.create({
  row: { gap: space.md, paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
  tile: {
    width: 112,
    height: 96,
    borderRadius: radius.lg,
    padding: space.md,
    justifyContent: 'space-between',
  },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileName: { fontFamily: type.bodyStrong.fontFamily, lineHeight: 18 },
});

export function HeaderSelector({ halls, menuDate, selectedDiningHall, setSelectedDiningHall, selectedMealTime, setSelectedMealTime, diningOpen, setDiningOpen, mealOpen, setMealOpen, dismissSearch }) {
  const [mealItems, setMealItems] = useState([]);

  const diningItems = (halls || []).map((hall) => ({ label: hall.name, value: hall.slug }));

  // Function to determine current meal time based on current time and day
  const getCurrentMealTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      // Weekend schedule
      if (timeInMinutes >= 9 * 60 && timeInMinutes < 10 * 60 + 30) {
        return 'breakfast';
      } else if (timeInMinutes >= 10 * 60 + 30 && timeInMinutes < 14 * 60) {
        return 'brunch';
      } else if (timeInMinutes >= 16 * 60 + 30 && timeInMinutes < 21 * 60) {
        return 'dinner';
      } else if (timeInMinutes >= 14 * 60 && timeInMinutes < 16 * 60 + 30) {
        // Between brunch and dinner, default to dinner
        return 'dinner';
      } else {
        // Outside dining hours, default to next meal
        if (timeInMinutes < 9 * 60) return 'breakfast';
        return 'dinner';
      }
    } else {
      // Weekday schedule
      if (timeInMinutes >= 7 * 60 && timeInMinutes < 10 * 60 + 30) {
        return 'breakfast';
      } else if (timeInMinutes >= 10 * 60 + 30 && timeInMinutes < 16 * 60 + 30) {
        return 'lunch';
      } else if (timeInMinutes >= 16 * 60 + 30 && timeInMinutes < 21 * 60) {
        return 'dinner';
      } else {
        // Outside dining hours, default to next meal
        if (timeInMinutes < 7 * 60) return 'breakfast';
        return 'dinner';
      }
    }
  };

  // Fetch available meal times when dining hall changes
  useEffect(() => {
    const fetchAvailableMealTimes = async () => {
      try {
        const hall = (halls || []).find((h) => h.slug === selectedDiningHall);
        if (!hall || !menuDate) {
          setMealItems([]);
          return;
        }

        // Which meals today's menu at this hall covers
        const { data, error } = await supabase
          .from('menu_items_flat')
          .select('meals')
          .eq('hall_id', hall.id)
          .eq('menu_date', menuDate);

        if (error) {
          console.error("Error fetching meal times:", error);
          return;
        }

        const served = new Set(data.flatMap((item) => item.meals || []));
        const newMealItems = MEAL_ORDER.filter((meal) => served.has(meal.value));

        setMealItems(newMealItems);
        
        // Get the current meal time based on time of day
        const currentMeal = getCurrentMealTime();
        
        // Check if the current meal is available
        const isCurrentMealAvailable = newMealItems.find(item => item.value === currentMeal);
        
        if (isCurrentMealAvailable) {
          // If the current meal time is available, select it
          setSelectedMealTime(currentMeal);
        } else if (newMealItems.length > 0) {
          // Otherwise, select the first available meal
          setSelectedMealTime(newMealItems[0].value);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    };

    fetchAvailableMealTimes();
  }, [selectedDiningHall, halls, menuDate]);

  // Halls scroll sideways as tiles (active = school color). Meals the hall serves today
  // sit in a segmented control, or a chip row when there are too many for one.
  const pickHall = (slug) => {
    dismissSearch?.();
    setDiningOpen?.(false);
    setSelectedDiningHall(slug);
  };
  const pickMeal = (value) => {
    dismissSearch?.();
    setMealOpen?.(false);
    setSelectedMealTime(value);
  };
  const mealsAsChips = mealItems.length === 1 || mealItems.length > 4;
  const { c, isDark } = useAppTheme();

  const hallScrollRef = useRef(null);
  const hallOffsets = useRef({});
  const scrollToHall = (slug) => {
    const x = hallOffsets.current[slug];
    if (x === undefined) return;
    hallScrollRef.current?.scrollTo?.({ x: Math.max(0, x - space.lg), animated: true });
  };
  useEffect(() => {
    if (selectedDiningHall) scrollToHall(selectedDiningHall);
  }, [selectedDiningHall]);

  return (
    <View style={{ gap: space.md }}>
      {/* Halls as tiles; the active one wears the school's color. A ref keeps
          the active hall scrolled into view (the saved hall can sit off-screen). */}
      <ScrollView
        ref={hallScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={hallStyles.row}
      >
        {diningItems.map((hall) => {
          const active = hall.value === selectedDiningHall;
          return (
            <View
              key={hall.value}
              onLayout={(e) => {
                hallOffsets.current[hall.value] = e.nativeEvent.layout.x;
                if (hall.value === selectedDiningHall) scrollToHall(hall.value);
              }}
            >
              <Tap
                onPress={() => pickHall(hall.value)}
                accessibilityRole="button"
                accessibilityLabel={hall.label}
                accessibilityState={{ selected: active }}
                style={[
                  hallStyles.tile,
                  active ? { backgroundColor: c.school } : [{ backgroundColor: c.surface }, elevation(c)],
                ]}
              >
                <View style={[hallStyles.tileIcon, { backgroundColor: active ? 'rgba(255,255,255,0.16)' : c.schoolSoft }]}>
                  <Ionicons name={active ? 'restaurant' : 'restaurant-outline'} size={17} color={active ? c.onSchool : isDark ? c.ink : c.school} />
                </View>
                <Txt
                  variant="small"
                  numberOfLines={2}
                  color={active ? c.onSchool : c.ink}
                  style={hallStyles.tileName}
                >
                  {hall.label}
                </Txt>
              </Tap>
            </View>
          );
        })}
      </ScrollView>

      {mealItems.length > 0 ? (
        mealsAsChips ? (
          <ChipRow style={{ paddingHorizontal: space.lg }}>
            {mealItems.map((meal) => (
              <Chip
                key={meal.value}
                label={meal.label}
                active={meal.value === selectedMealTime}
                onPress={() => pickMeal(meal.value)}
              />
            ))}
          </ChipRow>
        ) : (
          <View style={{ paddingHorizontal: space.lg }}>
            <Segmented options={mealItems} value={selectedMealTime} onChange={pickMeal} />
          </View>
        )
      ) : null}
    </View>
  );
}

export default function FoodList() {
  
  // Function to determine current meal time based on current time and day
  const getInitialMealTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      // Weekend schedule
      if (timeInMinutes >= 9 * 60 && timeInMinutes < 10 * 60 + 30) {
        return 'breakfast';
      } else if (timeInMinutes >= 10 * 60 + 30 && timeInMinutes < 14 * 60) {
        return 'brunch';
      } else if (timeInMinutes >= 16 * 60 + 30 && timeInMinutes < 21 * 60) {
        return 'dinner';
      } else if (timeInMinutes >= 14 * 60 && timeInMinutes < 16 * 60 + 30) {
        return 'dinner';
      } else {
        if (timeInMinutes < 9 * 60) return 'breakfast';
        return 'dinner';
      }
    } else {
      // Weekday schedule
      if (timeInMinutes >= 7 * 60 && timeInMinutes < 10 * 60 + 30) {
        return 'breakfast';
      } else if (timeInMinutes >= 10 * 60 + 30 && timeInMinutes < 16 * 60 + 30) {
        return 'lunch';
      } else if (timeInMinutes >= 16 * 60 + 30 && timeInMinutes < 21 * 60) {
        return 'dinner';
      } else {
        if (timeInMinutes < 7 * 60) return 'breakfast';
        return 'dinner';
      }
    }
  };

  const [diningOpen, setDiningOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);
  const [school, setSchool] = useState(null);
  const [halls, setHalls] = useState([]);
  const [menuDate, setMenuDate] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [favoriteKeys, setFavoriteKeys] = useState(new Set());
  const [selectedDiningHall, setSelectedDiningHall] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentFoodItem, setCurrentFoodItem] = useState(null);
  const [addedItems, setAddedItems] = useState([]);
  const [userDailyValues, setUserDailyValues] = useState(null);
  const [selectedMealTime, setSelectedMealTime] = useState(getInitialMealTime());
  const [userPreferences, setUserPreferences] = useState({
    allergens: [],
    preferences: []
  });
  const [filterByPreferences, setFilterByPreferences] = useState(true);
  const [filterByAllergens, setFilterByAllergens] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState("success"); // "success", "error", "info"
  const slideAnim = useRef(new Animated.Value(TOAST_OFFSET)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [clickedButtons, setClickedButtons] = useState(new Set());
  const popupTimerRef = useRef(null);
  const buttonFeedbackTimers = useRef(new Map());
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortOption, setSortOption] = useState('none');
  const initialFilterSettings = useRef({
    preferences: true,
    allergens: true,
  });
  const searchInputRef = useRef(null);
  const [detailServings, setDetailServings] = useState(1);

  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const showModernPopup = (message, type = "success") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);

    // Reset animations (the toast rises from just below its resting spot)
    slideAnim.setValue(TOAST_OFFSET);
    fadeAnim.setValue(0);

    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }

    // Fast slide in and fade in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start();

    popupTimerRef.current = setTimeout(() => {
      // Fast slide out and fade out animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: TOAST_OFFSET,
          duration: POPUP_HIDE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: POPUP_HIDE_DURATION,
          useNativeDriver: true,
        })
      ]).start(() => {
        setShowPopup(false);
        popupTimerRef.current = null;
      });
    }, POPUP_VISIBLE_DURATION); // Show for 1.5 seconds
  };

  const triggerButtonFeedback = (foodName) => {
    setClickedButtons((prev) => {
      const next = new Set(prev);
      next.add(foodName);
      return next;
    });

    const existingTimer = buttonFeedbackTimers.current.get(foodName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timerId = setTimeout(() => {
      setClickedButtons((prev) => {
        const next = new Set(prev);
        next.delete(foodName);
        return next;
      });
      buttonFeedbackTimers.current.delete(foodName);
    }, CHECKMARK_VISIBLE_DURATION);

    buttonFeedbackTimers.current.set(foodName, timerId);
  };

  const applySortToSections = (sections) => {
    if (!sections || sortOption === 'none') {
      return sections;
    }

    const [field, rawDirection] = sortOption.split('-');
    const direction = rawDirection === 'asc' ? 'asc' : 'desc';
    const fieldKeyMap = {
      calories: 'calories',
      protein: 'protein',
      fat: 'total_fat',
      carbs: 'total_carbohydrate',
    };
    const nutritionKey = fieldKeyMap[field] || field;
    const fallbackValue = direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    const getNumericValue = (foodItem) => {
      const rawValue = foodItem?.nutrition_facts?.[nutritionKey];
      const numericValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
      return fallbackValue;
    };

    return sections.map((section) => ({
      ...section,
      data: [...section.data].sort((a, b) => {
        const aValue = getNumericValue(a);
        const bValue = getNumericValue(b);

        if (aValue === bValue) {
          return (a.name || '').localeCompare(b.name || '');
        }

        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }),
    }));
  };

  useEffect(() => {
    fetchFoodItems(selectedDiningHall);
    fetchUserDailyValues();
    fetchUserPreferences();
  }, [selectedDiningHall, selectedMealTime, halls, menuDate]);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
      buttonFeedbackTimers.current.forEach((timerId) => {
        clearTimeout(timerId);
      });
      buttonFeedbackTimers.current.clear();
    };
  }, []);

  // Load the student's school and its dining halls, then reopen the hall they
  // used last (older accounts stored the hall's display name, e.g. "Bursley").
  useEffect(() => {
    const loadSchoolAndHalls = async () => {
      try {
        const mySchool = await fetchMySchool();
        if (!mySchool) return;
        const schoolHalls = await fetchHalls(mySchool.id);
        setSchool(mySchool);
        setMenuDate(todayInTimezone(mySchool.timezone));
        setHalls(schoolHalls);

        const { data: { user } } = await supabase.auth.getUser();
        const { data } = user
          ? await supabase.from('users').select('last_dining_hall').eq('id', user.id).single()
          : { data: null };
        const last = (data?.last_dining_hall || '').toLowerCase();
        const match = schoolHalls.find(
          (hall) => hall.slug === last || hall.name.toLowerCase() === last
        );
        setSelectedDiningHall((match || schoolHalls[0])?.slug ?? null);
      } catch (error) {
        console.error('Error loading dining halls:', error);
      }
    };

    loadSchoolAndHalls();
  }, []);

  useEffect(() => {
    const saveDiningHall = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('users')
          .update({ last_dining_hall: selectedDiningHall })
          .eq('id', user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error saving dining hall:', error);
      }
    };

    if (selectedDiningHall) {
      saveDiningHall();
    }
  }, [selectedDiningHall]);

  const fetchFoodItems = async (hallSlug) => {
    const hall = halls.find((h) => h.slug === hallSlug);
    if (!hall || !menuDate) {
      setFoodItems([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items_flat')
        .select('id, name, subheader, meals, allergens, traits, nutrition_facts, nutrition_source')
        .eq('hall_id', hall.id)
        .eq('menu_date', menuDate)
        .contains('meals', [selectedMealTime])
        .order('id');

      if (error) {
        console.error("Error fetching food data:", error);
        setFoodItems([]);
      } else {
        setFoodItems(data);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setFoodItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDailyValues = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('dailyValues')
        .eq('id', user.data.user.id)
        .single();

      if (error) {
        console.error("Error fetching daily values:", error);
      } else {
        setUserDailyValues(data.dailyValues);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  const fetchUserPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('allergens, preferences, preferences_box, allergens_box')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setUserPreferences({
          allergens: data.allergens || [],
          preferences: data.preferences || []
        });

        const preferencesEnabled = typeof data.preferences_box === 'boolean'
          ? data.preferences_box
          : initialFilterSettings.current.preferences;
        const allergensEnabled = typeof data.allergens_box === 'boolean'
          ? data.allergens_box
          : initialFilterSettings.current.allergens;

        setFilterByPreferences(preferencesEnabled);
        setFilterByAllergens(allergensEnabled);
        initialFilterSettings.current = {
          preferences: preferencesEnabled,
          allergens: allergensEnabled,
        };
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  // `count` comes from the servings stepper in the detail sheet (default 1).
  const addToLog = async (foodItem, mealTime, count = 1) => {
    const servingsToAdd = Math.max(1, Math.round(count) || 1);
    const user = await supabase.auth.getUser();
    if (!user.data?.user) {
      showModernPopup("You must be logged in to add food to your log.", "info");
      return;
    }

    try {
      // Fetch the user's log data
      const { data: userData, error: fetchError } = await supabase
        .from("users")
        .select("log")
        .eq("id", user.data.user.id)
        .single();
  
      if (fetchError) {
        console.error("Error fetching user's log:", fetchError);
        return;
      }
  
      // Check if the food item already exists in the user's log
      const existingFoodItemIndex = userData.log.findIndex(
        (item) => item.name === foodItem.name
      );
  
      if (existingFoodItemIndex === -1) {
        // If the food item doesn't exist, add it with servings: 1 (or the
        // stepper count, scaling the macros the same way repeat adds do)
        const base = foodItem.nutrition_facts || {};
        const newLogItem = {
          ...foodItem,
          servings: servingsToAdd,
          baseNutrition: { ...base }, // Store original nutrition values
          mealTime: mealTime
        };
        if (servingsToAdd > 1) {
          newLogItem.nutrition_facts = {
            ...base,
            calories: base.calories * servingsToAdd,
            protein: base.protein * servingsToAdd,
            total_carbohydrate: base.total_carbohydrate * servingsToAdd,
            total_fat: base.total_fat * servingsToAdd,
          };
        }
        const updatedLog = [...userData.log, newLogItem];
  
        const { error: insertError } = await supabase
          .from("users")
          .update({ log: updatedLog })
          .eq("id", user.data.user.id);
  
        if (insertError) {
          console.error("Error updating log with new food:", insertError);
          showModernPopup("Failed to add food to log", "error");
        } else {
          setAddedItems((prev) => [...prev, foodItem.name]);
          triggerButtonFeedback(foodItem.name);
          showModernPopup(
            servingsToAdd > 1
              ? `Added ${servingsToAdd} servings of ${foodItem.name}`
              : `Added ${foodItem.name} to your log`,
            "success"
          );
          setTimeout(() => {
            setAddedItems((prev) =>
              prev.filter((name) => name !== foodItem.name)
            );
          }, 500);
        }
      } else {
        // If the food item exists, increment servings and recalculate nutrition
        const updatedLog = [...userData.log];
        const item = updatedLog[existingFoodItemIndex];
        item.servings += servingsToAdd;
  
        // Recalculate nutrition facts based on base values × servings
        item.nutrition_facts = {
          calories: item.baseNutrition.calories * item.servings,
          protein: item.baseNutrition.protein * item.servings,
          total_carbohydrate: item.baseNutrition.total_carbohydrate * item.servings,
          total_fat: item.baseNutrition.total_fat * item.servings
        };
  
        const { error: updateError } = await supabase
          .from("users")
          .update({ log: updatedLog })
          .eq("id", user.data.user.id);
  
        if (updateError) {
          console.error("Error updating servings:", updateError);
          showModernPopup("Failed to update food servings", "error");
        } else {
          setAddedItems((prev) => [...prev, foodItem.name]);
          triggerButtonFeedback(foodItem.name);
          showModernPopup(
            servingsToAdd > 1
              ? `Added ${servingsToAdd} more servings of ${foodItem.name}`
              : `Added another serving of ${foodItem.name}`,
            "success"
          );
          setTimeout(() => {
            setAddedItems((prev) =>
              prev.filter((name) => name !== foodItem.name)
            );
          }, 500);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };  

  const handleFoodPress = (item) => {
    setDiningOpen(false);
    setMealOpen(false);

    setCurrentFoodItem(item);
    setDetailServings(1);
    setModalVisible(true);
  };

  const filterFoodByMealTime = (foods) => {
    // First filter by meal time
    const filteredFoods = foods.filter(food =>
      (food.meals || []).includes(selectedMealTime) || food[`is_${selectedMealTime}`] === true
    );

    // Then group by subheader
    const groupedFoods = filteredFoods.reduce((acc, food) => {
      const subheader = food.subheader || 'Other';
      if (!acc[subheader]) {
        acc[subheader] = [];
      }
      acc[subheader].push(food);
      return acc;
    }, {});

    // Convert to array format for FlatList
    return Object.entries(groupedFoods).map(([subheader, items]) => ({
      subheader,
      data: items
    }));
  };

  // Apply search, preferences/allergens filtering on top of meal-time grouping
  const getFilteredSections = () => {
    let sections = filterFoodByMealTime(foodItems);

    // Apply search filter first
    if (searchQuery.trim()) {
      sections = sections.map(section => ({
        ...section,
        data: section.data.filter(food =>
          food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (food.subheader && food.subheader.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (food.traits && food.traits.some(trait => 
            trait.toLowerCase().includes(searchQuery.toLowerCase())
          ))
        )
      })).filter(section => section.data.length > 0);
    }

    // Filter by preferences (traits)
    if (filterByPreferences && userPreferences?.preferences?.length > 0) {
      sections = sections.map(section => ({
        ...section,
        data: section.data.filter(food =>
          userPreferences.preferences.some(pref =>
            Array.isArray(food.traits) && food.traits.some(t => (t || '').toLowerCase() === (pref || '').toLowerCase())
          )
        )
      })).filter(section => section.data.length > 0);
    }

    // Filter out allergens
    if (filterByAllergens && userPreferences?.allergens?.length > 0) {
      sections = sections.map(section => ({
        ...section,
        data: section.data.filter(food =>
          !userPreferences.allergens.some(allergen =>
            Array.isArray(food.allergens) && food.allergens.some(a => (a || '').toLowerCase() === (allergen || '').toLowerCase())
          )
        )
      })).filter(section => section.data.length > 0);
    }

    return applySortToSections(sections);
  };

  // Re-fetch preferences and foods whenever the tab gains focus
  useFocusEffect(
    React.useCallback(() => {
      // Update meal time based on current time when tab gains focus
      const currentMealTime = getInitialMealTime();
      setSelectedMealTime(currentMealTime);
      
      fetchUserPreferences();
      fetchFavoriteKeys().then(setFavoriteKeys).catch(() => {});
      if (school) {
        // Roll over to the new day's menu if the app stayed open past midnight
        setMenuDate(todayInTimezone(school.timezone));
      }
      fetchFoodItems(selectedDiningHall);
      return () => {};
    }, [selectedDiningHall, school, halls, menuDate])
  );

  const selectedHall = halls.find((hall) => hall.slug === selectedDiningHall);

  // Hearted dishes show up on the Dashboard whenever a hall serves them.
  const toggleFavorite = async (name) => {
    const key = dishKey(name);
    const wasFavorite = favoriteKeys.has(key);
    const next = new Set(favoriteKeys);
    if (wasFavorite) next.delete(key);
    else next.add(key);
    setFavoriteKeys(next);
    try {
      await setFavorite(name, !wasFavorite);
      if (!wasFavorite) showModernPopup(`We'll show you when ${name} is on the menu`, "success");
    } catch (error) {
      setFavoriteKeys(favoriteKeys);
      showModernPopup("Couldn't update favorites", "error");
    }
  };

  // No menu posted: a student photographs the menu board and the backend
  // turns it into dishes (nutrition estimated) for everyone at the school.
  const shareMenuPhoto = async () => {
    if (!selectedHall) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showModernPopup("Camera access is needed to snap the menu", "info");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);
      const response = await postToBackend('/menus/photo', {
        hallId: selectedHall.id,
        imageBase64: asset.base64,
        mediaType: asset.mimeType || 'image/jpeg',
      });
      showModernPopup(`Thanks! Added ${response.dishes} dishes to ${response.hall}`, "success");
      fetchFoodItems(selectedDiningHall);
    } catch (error) {
      showModernPopup(error.message || "Couldn't read that photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const hasActiveFilters =
    sortOption !== 'none' ||
    filterByPreferences !== initialFilterSettings.current.preferences ||
    filterByAllergens !== initialFilterSettings.current.allergens;

  const dismissSearch = () => {
    if (isSearchFocused) {
      setIsSearchFocused(false);
    }
    if (searchInputRef.current?.blur) {
      searchInputRef.current.blur();
    }
    Keyboard.dismiss();
  };

  const sections = getFilteredSections();
  const dishCount = sections.reduce((total, section) => total + section.data.length, 0);
  const activeFilterCount =
    (sortOption !== 'none' ? 1 : 0) +
    (filterByPreferences !== initialFilterSettings.current.preferences ? 1 : 0) +
    (filterByAllergens !== initialFilterSettings.current.allergens ? 1 : 0);
  const activeSort = SORT_OPTIONS.find((option) => option.key === sortOption);

  const resetFilters = () => {
    setSortOption('none');
    setFilterByAllergens(initialFilterSettings.current.allergens);
    setFilterByPreferences(initialFilterSettings.current.preferences);
  };

  // Flatten stations + dishes into one list so cards can stagger in by index.
  const rows = [];
  let dishIndex = 0;
  sections.forEach((section) => {
    rows.push({ kind: 'station', key: `station-${section.subheader}`, title: section.subheader, first: rows.length === 0 });
    section.data.forEach((foodItem) => {
      rows.push({ kind: 'dish', key: `dish-${foodItem.id ?? foodItem.name}-${section.subheader}`, foodItem, index: dishIndex });
      dishIndex += 1;
    });
  });

  // Labels shown on a card and in the sheet: estimated nutrition, saved
  // allergens it contains, and dietary traits (the student's matches first).
  const getDishFlags = (foodItem) => {
    // Check if the item's allergens array contains any of the user's selected allergens
    const matchingAllergens = userPreferences.allergens.filter(allergen =>
      foodItem.allergens?.some(itemAllergen =>
        itemAllergen.toLowerCase() === allergen.toLowerCase()
      )
    );

    // Check if the item's traits array contains any of the user's selected preferences
    const matchingPreferences = userPreferences.preferences.filter(pref =>
      foodItem.traits?.some(trait =>
        trait.toLowerCase() === pref.toLowerCase()
      )
    );

    const otherTraits = (foodItem.traits || []).filter(
      (trait) => !matchingPreferences.some((pref) => pref.toLowerCase() === (trait || '').toLowerCase())
    );

    return {
      matchingAllergens,
      matchingPreferences,
      otherTraits,
      isEstimate: ESTIMATED_SOURCES.has(foodItem.nutrition_source),
    };
  };

  const renderRow = ({ item: row }) => {
    if (row.kind === 'station') {
      return (
        <Txt variant="overline" tone="muted" style={[styles.station, row.first && { marginTop: space.sm }]}>
          {row.title}
        </Txt>
      );
    }

    const { foodItem, index } = row;
    const flags = getDishFlags(foodItem);
    const favorite = favoriteKeys.has(dishKey(foodItem.name));
    const justAdded = clickedButtons.has(foodItem.name);
    const facts = foodItem.nutrition_facts || {};
    // Traits stay tiny: the student's matches first, three labels at most.
    const traitTags = [...flags.matchingPreferences, ...flags.otherTraits].slice(0, 3);

    return (
      <FadeIn index={index} style={styles.cardSpacing}>
        <View style={styles.card}>
          {/* The body opens the sheet; heart and add sit beside it (not
              inside it) so buttons are never nested. */}
          <Pressable
            onPress={() => {
              dismissSearch();
              handleFoodPress(foodItem);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${foodItem.name}, ${macroText(facts.calories)} calories, ${macroText(facts.protein)} grams protein`}
            accessibilityHint="Opens nutrition details"
            style={({ pressed }) => [styles.cardBody, pressed && { opacity: 0.6 }]}
          >
            <FoodThumb glyph={foodGlyph(foodItem.name)} size={56} />
            <View style={styles.cardText}>
              <Txt variant="title" numberOfLines={2}>
                {foodItem.name}
              </Txt>
              <MacroLine facts={facts} />
              {(flags.isEstimate || flags.matchingAllergens.length > 0 || traitTags.length > 0) && (
                <View style={styles.tagRow}>
                  {flags.isEstimate && <Tag label="Estimated" icon="sparkles-outline" />}
                  {flags.matchingAllergens.map((allergen) => (
                    <Tag key={`allergen-${allergen}`} label={`Contains ${allergen}`} icon="alert-circle-outline" tone="warning" />
                  ))}
                  {traitTags.map((trait) => (
                    <Tag
                      key={`trait-${trait}`}
                      label={trait}
                      icon={flags.matchingPreferences.includes(trait) ? 'checkmark' : undefined}
                    />
                  ))}
                </View>
              )}
            </View>
          </Pressable>

          <View style={styles.cardActions}>
            <HeartButton
              active={favorite}
              tone={c.muted}
              onPress={(e) => {
                e?.stopPropagation?.();
                toggleFavorite(foodItem.name);
              }}
              label={favorite ? `Remove ${foodItem.name} from favorites` : `Add ${foodItem.name} to favorites`}
            />
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                dismissSearch();
                addToLog(foodItem, selectedMealTime);
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Add ${foodItem.name} to log`}
              style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] }]}
            >
              <Ionicons name={justAdded ? 'checkmark' : 'add'} size={22} color={c.onPrimary} />
            </Pressable>
          </View>
        </View>
      </FadeIn>
    );
  };

  const toast = showPopup ? (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastWrap,
        { bottom: space.lg },
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim
        }
      ]}
    >
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Ionicons
          name={
            popupType === "success" ? "checkmark-circle" :
            popupType === "error" ? "alert-circle" : "information-circle"
          }
          size={18}
          color={popupType === "error" ? c.accent : c.inverse}
        />
        <Txt variant="small" tone="inverse" numberOfLines={2} style={styles.toastText}>
          {popupMessage}
        </Txt>
      </View>
    </Animated.View>
  ) : null;

  const detailFacts = currentFoodItem?.nutrition_facts || {};
  const detailFlags = currentFoodItem ? getDishFlags(currentFoodItem) : null;
  const detailFavorite = currentFoodItem ? favoriteKeys.has(dishKey(currentFoodItem.name)) : false;
  const detailAdded = currentFoodItem ? clickedButtons.has(currentFoodItem.name) : false;
  const scaled = (raw) => {
    const value = parseNutritionValue(raw);
    return value === null ? null : Math.round(value * detailServings);
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <HeaderSelector
          halls={halls}
          menuDate={menuDate}
          selectedDiningHall={selectedDiningHall}
          setSelectedDiningHall={setSelectedDiningHall}
          selectedMealTime={selectedMealTime}
          setSelectedMealTime={setSelectedMealTime}
          diningOpen={diningOpen}
          setDiningOpen={setDiningOpen}
          mealOpen={mealOpen}
          setMealOpen={setMealOpen}
          dismissSearch={dismissSearch}
        />

        {/* Search Bar + Filter */}
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <TextField
              ref={searchInputRef}
              icon="search"
              placeholder="Search dishes, stations, vegan…"
              accessibilityLabel="Search dishes"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                setIsSearchFocused(true);
                setDiningOpen(false);
                setMealOpen(false);
              }}
              onBlur={() => {
                setIsSearchFocused(false);
              }}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              inputStyle={searchQuery.length > 0 ? { paddingRight: space.xxl } : null}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                style={styles.clearButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={c.muted} />
              </Pressable>
            )}
          </View>
          <IconButton
            name="options-outline"
            tone="filled"
            label="Open filters"
            badge={hasActiveFilters ? activeFilterCount || undefined : undefined}
            style={styles.filterButton}
            onPress={() => {
              dismissSearch();
              setFilterModalVisible(true);
              setDiningOpen(false);
              setMealOpen(false);
            }}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={c.muted} />
        </View>
      ) : foodItems.length === 0 && selectedHall ? (
        <ScrollView contentContainerStyle={styles.emptyWrap} keyboardShouldPersistTaps="handled">
          <EmptyState
            icon="camera-outline"
            title={`No ${selectedMealTime} menu posted for ${selectedHall.name} yet`}
            body="At the hall? Snap the menu board and we'll add today's dishes for everyone."
            action={uploadingPhoto ? 'Reading menu…' : 'Snap the menu'}
            onAction={uploadingPhoto ? undefined : shareMenuPhoto}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            foodItems.length > 0 ? (
              <Txt variant="caption" tone="muted" style={styles.summary}>
                {`Today · ${dishCount} ${dishCount === 1 ? 'dish' : 'dishes'}${activeSort && sortOption !== 'none' ? ` · ${activeSort.short.toLowerCase()} first` : ''}`}
              </Txt>
            ) : null
          }
          ListEmptyComponent={
            foodItems.length > 0 ? (
              <EmptyState
                icon="search-outline"
                title="Nothing matches"
                body={searchQuery.trim() ? `No dishes match "${searchQuery.trim()}" with your filters.` : 'Your filters hide every dish on this menu.'}
                action={searchQuery.trim() ? 'Clear search' : 'Reset filters'}
                onAction={() => (searchQuery.trim() ? setSearchQuery('') : resetFilters())}
              />
            ) : null
          }
          onScrollBeginDrag={() => {
            setDiningOpen(false);
            setMealOpen(false);
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}

      {/* Sort & filter sheet */}
      <Modal
        visible={filterModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setFilterModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          />
          <Reanimated.View entering={SlideInDown.duration(motion.base)} style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Txt variant="h2">Sort & filter</Txt>
              <IconButton name="close" label="Close filters" onPress={() => setFilterModalVisible(false)} />
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetSection}>
                <Txt variant="overline" tone="muted">Sort by</Txt>
                <View style={styles.wrap}>
                  {SORT_OPTIONS.map((option) => (
                    <View key={option.key} accessible={false}>
                      <Chip
                        label={option.short}
                        active={sortOption === option.key}
                        onPress={() => setSortOption(option.key)}
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sheetSection}>
                <Txt variant="overline" tone="muted">Personal filters</Txt>
                <View>
                  <ToggleRow
                    title="Hide my allergens"
                    subtitle="Remove dishes that include allergens you have saved."
                    value={filterByAllergens}
                    onValueChange={setFilterByAllergens}
                  />
                  <Divider />
                  <ToggleRow
                    title="Only show my dietary preferences"
                    subtitle="Limit the list to foods that match preferences you selected."
                    value={filterByPreferences}
                    onValueChange={setFilterByPreferences}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Button
                title="Reset"
                variant="ghost"
                onPress={resetFilters}
                accessibilityLabel="Reset filters"
              />
              <View style={{ flex: 1 }}>
                <Button
                  title="Apply"
                  size="lg"
                  onPress={() => setFilterModalVisible(false)}
                  accessibilityLabel="Apply filters"
                />
              </View>
            </View>
          </Reanimated.View>
        </View>
      </Modal>

      {/* Nutrition detail sheet */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close details"
          />
          {currentFoodItem && (
            <Reanimated.View entering={SlideInDown.duration(motion.base)} style={[styles.sheet, styles.detailSheet, { paddingBottom: space.lg + insets.bottom }]}>
              <View style={styles.handle} />
              <View style={styles.detailHeader}>
                <FoodThumb glyph={foodGlyph(currentFoodItem.name)} size={64} />
                <View style={{ flex: 1, gap: space.xs }}>
                  {currentFoodItem.subheader ? (
                    <Txt variant="overline" tone="muted">
                      {[selectedHall?.name, currentFoodItem.subheader].filter(Boolean).join(' · ')}
                    </Txt>
                  ) : null}
                  <Txt variant="h2">{currentFoodItem.name}</Txt>
                  {detailFacts?.serving_size ? (
                    <Txt variant="caption" tone="muted">
                      Serving size {String(detailFacts.serving_size).trim()}
                      {/^\d+(\.\d+)?$/.test(String(detailFacts.serving_size).trim()) ? 'g' : ''}
                    </Txt>
                  ) : null}
                </View>
                <View style={styles.detailHeaderActions}>
                  <HeartButton
                    active={detailFavorite}
                    onPress={() => toggleFavorite(currentFoodItem.name)}
                    label={detailFavorite ? `Remove ${currentFoodItem.name} from favorites` : `Add ${currentFoodItem.name} to favorites`}
                  />
                  <IconButton name="close" label="Close details" onPress={() => setModalVisible(false)} />
                </View>
              </View>

              <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
                {/* Big macros (scaled by the servings stepper) */}
                <View style={styles.bigMacros}>
                  <BigMacro value={scaled(detailFacts.calories)} label="calories" />
                  <BigMacro value={scaled(detailFacts.protein)} unit="g" label="protein" color={c.protein} />
                  <BigMacro value={scaled(detailFacts.total_carbohydrate)} unit="g" label="carbs" color={c.carbs} />
                  <BigMacro value={scaled(detailFacts.total_fat)} unit="g" label="fat" color={c.fat} />
                </View>

                {(detailFlags.isEstimate || detailFlags.matchingAllergens.length > 0) && (
                  <View style={styles.tagRow}>
                    {detailFlags.isEstimate && <Tag label="Estimated nutrition" icon="sparkles-outline" />}
                    {detailFlags.matchingAllergens.map((allergen) => (
                      <Tag key={`d-allergen-${allergen}`} label={`Contains ${allergen}`} icon="alert-circle-outline" tone="warning" />
                    ))}
                  </View>
                )}

                {/* All Nutrition Facts (per serving) */}
                <View>
                  <Txt variant="overline" tone="muted" style={{ marginBottom: space.xs }}>
                    Nutrition per serving
                  </Txt>
                  {Object.entries(detailFacts)
                    .filter(([key]) => !['calories', 'protein', 'total_carbohydrate', 'total_fat', 'serving_size'].includes(key))
                    .map(([key, value]) => {
                      const label = key.split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                      const { valueLabel, percentLabel } = formatNutrientDisplay(key, value);

                      if (valueLabel === '—') {
                        return null;
                      }

                      return (
                        <View key={key}>
                          <View style={styles.nutrientRow}>
                            <Txt variant="small" style={{ flex: 1 }}>{label.charAt(0) + label.slice(1).toLowerCase()}</Txt>
                            {percentLabel ? (
                              <Txt variant="caption" tone="muted">{percentLabel}</Txt>
                            ) : null}
                            <Txt variant="small" style={styles.nutrientValue}>{valueLabel}</Txt>
                          </View>
                          <Divider />
                        </View>
                      );
                    })}
                </View>

                {/* Allergens Section */}
                {currentFoodItem.allergens && currentFoodItem.allergens.length > 0 && (
                  <View style={styles.sheetSection}>
                    <Txt variant="overline" tone="muted">Allergens</Txt>
                    <View style={styles.tagRow}>
                      {currentFoodItem.allergens.map((allergen, index) => (
                        <Tag
                          key={index}
                          label={allergen}
                          size="md"
                          tone={detailFlags.matchingAllergens.some((a) => a.toLowerCase() === allergen.toLowerCase()) ? 'warning' : undefined}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {/* Traits Section */}
                {currentFoodItem.traits && currentFoodItem.traits.length > 0 && (
                  <View style={styles.sheetSection}>
                    <Txt variant="overline" tone="muted">Dietary info</Txt>
                    <View style={styles.tagRow}>
                      {currentFoodItem.traits.map((trait, index) => (
                        <Tag key={index} label={trait} size="md" />
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.sheetFooter}>
                <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={`Servings, ${detailServings}`}>
                  <IconButton
                    name="remove"
                    size={20}
                    label="One less serving"
                    onPress={() => setDetailServings((n) => Math.max(1, n - 1))}
                    style={detailServings <= 1 ? { opacity: 0.4 } : null}
                  />
                  <View style={styles.stepperValue}>
                    <Txt variant="number">{detailServings}</Txt>
                    <Txt variant="caption" tone="muted">{detailServings === 1 ? 'serving' : 'servings'}</Txt>
                  </View>
                  <IconButton
                    name="add"
                    size={20}
                    label="One more serving"
                    onPress={() => setDetailServings((n) => Math.min(20, n + 1))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={detailAdded ? 'Added' : 'Add to log'}
                    icon={detailAdded ? 'checkmark' : 'add'}
                    size="lg"
                    accessibilityLabel={`Add ${detailServings} ${detailServings === 1 ? 'serving' : 'servings'} of ${currentFoodItem.name} to log`}
                    onPress={() => addToLog(currentFoodItem, selectedMealTime, detailServings)}
                  />
                </View>
              </View>
            </Reanimated.View>
          )}
          {/* Feedback shows above the sheet too */}
          {toast}
        </View>
      </Modal>

      {/* Toast */}
      {!modalVisible && toast}
    </View>
  );
}

// "180 cal · ● 13g P · ● 2g C · ● 13g F" with a colored dot per macro.
function MacroLine({ facts }) {
  const { c } = useAppTheme();
  const items = [
    { key: 'P', value: facts.protein, color: c.protein, name: 'protein' },
    { key: 'C', value: facts.total_carbohydrate, color: c.carbs, name: 'carbs' },
    { key: 'F', value: facts.total_fat, color: c.fat, name: 'fat' },
  ];
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.md, rowGap: 2 }}
      accessible
      accessibilityLabel={`${macroText(facts.calories)} calories, ${items.map((m) => `${macroText(m.value)} grams ${m.name}`).join(', ')}`}
    >
      <Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>
        {macroText(facts.calories)} cal
      </Txt>
      {items.map((m) => (
        <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: m.color }} />
          <Txt variant="small" tone="muted">
            {macroText(m.value, 'g')} {m.key}
          </Txt>
        </View>
      ))}
    </View>
  );
}

// Tiny label on a card. tone="warning" is the coral allergen warning.
function Tag({ label, icon, tone, size = 'sm' }) {
  const { c } = useAppTheme();
  const warning = tone === 'warning';
  const color = warning ? c.accent : c.muted;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: size === 'md' ? 30 : 22,
        paddingHorizontal: size === 'md' ? space.md : space.sm,
        borderRadius: radius.pill,
        backgroundColor: warning ? c.accentSoft : c.sunken,
      }}
    >
      {icon ? <Ionicons name={icon} size={size === 'md' ? 14 : 12} color={color} /> : null}
      <Txt variant="caption" color={warning ? c.accent : size === 'md' ? c.ink : c.muted} style={{ fontFamily: type.bodyStrong.fontFamily }}>
        {label}
      </Txt>
    </View>
  );
}

// One of the four big numbers at the top of the detail sheet.
function BigMacro({ value, unit = '', label, color }) {
  const { c } = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: 'flex-start', gap: 2 }}>
      <Txt variant="number" style={{ fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] }}>
        {value === null ? '—' : `${value}${unit}`}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {color ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} /> : null}
        <Txt variant="caption" tone="muted" color={color ? undefined : c.muted}>
          {label}
        </Txt>
      </View>
    </View>
  );
}

// Title + explanation + switch, used in the filter sheet.
function ToggleRow({ title, subtitle, value, onValueChange }) {
  const { c } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        <Txt variant="caption" tone="muted">{subtitle}</Txt>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{ false: c.sunken, true: c.primary }}
        thumbColor={c.surface}
        activeThumbColor={c.surface}
        ios_backgroundColor={c.sunken}
      />
    </View>
  );
}

const makeStyles = (c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  top: { paddingTop: space.sm, paddingBottom: space.md, gap: space.md, backgroundColor: c.bg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  searchField: { flex: 1, justifyContent: 'center' },
  clearButton: { position: 'absolute', right: space.md, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  filterButton: { width: 52, height: 52, borderRadius: radius.md },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xxxl + space.xxl },
  summary: { marginBottom: space.sm },
  station: { marginTop: space.xl, marginBottom: space.md },
  cardSpacing: { marginBottom: space.md },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...elevation(c),
  },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, paddingRight: 0 },
  cardText: { flex: 1, gap: space.xs + 2, paddingTop: 2 },
  cardActions: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between', gap: space.xs, paddingVertical: space.sm, paddingRight: space.sm },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  loading: { paddingTop: space.xxxl, alignItems: 'center' },
  emptyWrap: { paddingHorizontal: space.lg, paddingTop: space.xl },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  detailSheet: { maxHeight: '90%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.hairline, marginBottom: space.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.xl, paddingRight: space.md },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingLeft: space.xl, paddingRight: space.md, paddingTop: space.sm },
  detailHeaderActions: { flexDirection: 'row', alignItems: 'center', marginTop: -space.sm },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetScrollContent: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.lg, gap: space.xl },
  sheetSection: { gap: space.md },
  bigMacros: { flexDirection: 'row', gap: space.sm, backgroundColor: c.sunken, borderRadius: radius.lg, padding: space.lg },
  nutrientRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  nutrientValue: { fontFamily: type.bodyStrong.fontFamily, minWidth: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.sunken, borderRadius: radius.pill, height: 56, paddingHorizontal: space.xs },
  stepperValue: { minWidth: 44, alignItems: 'center' },

  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: 420,
  },
  toastText: { flexShrink: 1, fontFamily: type.bodyStrong.fontFamily },
});
