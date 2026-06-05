import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Keyboard,
  Switch,
} from "react-native";
import { FoodListStyles, HeaderSelectorStyles } from '../../styles/AddFood.styles.js';
import DropDownPicker from "react-native-dropdown-picker";
import AnimatedProgressWheel from "react-native-progress-wheel";
import Icon from "react-native-vector-icons/FontAwesome";
import { supabase } from "../../utils/config";
import { useTheme } from '../../context/ThemeContext.jsx';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatNutrientDisplay } from "../../utils/nutrients";

const POPUP_VISIBLE_DURATION = 1500;
const POPUP_HIDE_DURATION = 200;
const CHECKMARK_VISIBLE_DURATION = 900;

const SORT_OPTIONS = [
  {
    key: 'none',
    title: 'No sorting',
  },
  {
    key: 'calories-asc',
    title: 'Calories - Lowest to Highest',
  },
  {
    key: 'calories-desc',
    title: 'Calories - Highest to Lowest',
  },
  {
    key: 'protein-desc',
    title: 'Protein - Highest First',
  },
  {
    key: 'fat-asc',
    title: 'Fat - Lowest First',
  },
  {
    key: 'fat-desc',
    title: 'Fat - Highest First',
  },
  {
    key: 'carbs-asc',
    title: 'Carbs - Lowest First',
  },
];

export function HeaderSelector({ selectedDiningHall, setSelectedDiningHall, selectedMealTime, setSelectedMealTime, diningOpen, setDiningOpen, mealOpen, setMealOpen, dismissSearch }) {
  const { isDarkMode } = useTheme();
  const [mealItems, setMealItems] = useState([]);
  
  const [diningItems] = useState([
    { label: "Bursley", value: "Bursley" },
    { label: "Markley", value: "Markley" },
    { label: "North Quad", value: "North Quad" },
    { label: "South Quad", value: "South Quad" },
    { label: "East Quad", value: "East Quad" },
    { label: "Mosher-Jordan", value: "Mosher-Jordan" },
    { label: "Twigs at Oxford", value: "Twigs at Oxford" },
  ]);

  const styles = HeaderSelectorStyles(isDarkMode);

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
        // Get all food items for the selected dining hall
        const { data, error } = await supabase
          .from(selectedDiningHall)
          .select('is_breakfast, is_lunch, is_dinner, is_brunch');

        if (error) {
          console.error("Error fetching meal times:", error);
          return;
        }

        // Check which meal times have at least one food item
        const availableMeals = {
          breakfast: data.some(item => item.is_breakfast),
          lunch: data.some(item => item.is_lunch),
          dinner: data.some(item => item.is_dinner),
          brunch: data.some(item => item.is_brunch)
        };

        // Create dropdown items in specific order
        const newMealItems = [];
        if (availableMeals.breakfast) newMealItems.push({ label: "Breakfast", value: "breakfast" });
        if (availableMeals.brunch) newMealItems.push({ label: "Brunch", value: "brunch" });
        if (availableMeals.lunch) newMealItems.push({ label: "Lunch", value: "lunch" });
        if (availableMeals.dinner) newMealItems.push({ label: "Dinner", value: "dinner" });

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
  }, [selectedDiningHall]);

  return (
    <View style={styles.header}>
      <View style={styles.dropdownWrapper}>
        {/* <Text style={styles.headerText}>Dining Hall:</Text> */}
        <DropDownPicker
          open={diningOpen}
          value={selectedDiningHall}
          items={diningItems}
          setOpen={setDiningOpen}
          setValue={setSelectedDiningHall}
          onOpen={dismissSearch}
          containerStyle={styles.dropdownContainer}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropDownBox}
          textStyle={{
            fontSize: 14,
            color: isDarkMode ? '#E0E0E0' : '#32745f',
          }}
          labelStyle={{
            color: isDarkMode ? '#E0E0E0' : '#32745f',
          }}
          theme={isDarkMode ? "DARK" : "LIGHT"}
          zIndex={2000}
        />
      </View>

      <View style={styles.dropdownWrapper}>
        {/* <Text style={styles.headerText}>Meal:</Text> */}
        <DropDownPicker
          open={mealOpen}
          value={selectedMealTime}
          items={mealItems}
          setOpen={setMealOpen}
          setValue={setSelectedMealTime}
          onOpen={dismissSearch}
          containerStyle={styles.dropdownContainer}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropDownBox}
          textStyle={{
            fontSize: 14,
            color: isDarkMode ? '#E0E0E0' : '#32745f',
          }}
          labelStyle={{
            color: isDarkMode ? '#E0E0E0' : '#32745f',
          }}
          theme={isDarkMode ? "DARK" : "LIGHT"}
          zIndex={1000}
        />
      </View>
    </View>
  );
}

export default function FoodList() {
  const { isDarkMode } = useTheme();
  
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
  const [selectedDiningHall, setSelectedDiningHall] = useState("Bursley");
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
  const slideAnim = useRef(new Animated.Value(300)).current;
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

  const styles = FoodListStyles(isDarkMode);

  const showModernPopup = (message, type = "success") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);

    // Reset animations
    slideAnim.setValue(300);
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
          toValue: -320,
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
  }, [selectedDiningHall, selectedMealTime]);

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

  useEffect(() => {
    const loadLastDiningHall = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('users')
          .select('last_dining_hall')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        
        if (data?.last_dining_hall) {
          setSelectedDiningHall(data.last_dining_hall);
        }
      } catch (error) {
        console.error('Error loading last dining hall:', error);
      }
    };

    loadLastDiningHall();
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

  const fetchFoodItems = async (diningHall) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(diningHall)
        .select("*")  // Select all fields to get the meal time booleans
        .eq(`is_${selectedMealTime}`, true);

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

  const addToLog = async (foodItem, mealTime) => {
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
        // If the food item doesn't exist, add it with servings: 1
        const newLogItem = { 
          ...foodItem, 
          servings: 1,
          baseNutrition: { ...foodItem.nutrition_facts }, // Store original nutrition values
          mealTime: mealTime
        };
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
          showModernPopup(`Added ${foodItem.name} to your log!`, "success");
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
        item.servings += 1;
  
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
          showModernPopup(`Added another serving of ${foodItem.name}!`, "success");
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
    setModalVisible(true);
  };

  const filterFoodByMealTime = (foods) => {
    // First filter by meal time
    const filteredFoods = foods.filter(food => {
      const mealTimeField = `is_${selectedMealTime}`;
      return food[mealTimeField] === true;
    });

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
      fetchFoodItems(selectedDiningHall);
      return () => {};
    }, [selectedDiningHall])
  );

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

  return (
    <TouchableWithoutFeedback 
      onPress={() => {
        setDiningOpen(false);
        setMealOpen(false);
      }}
    >
      <View style={styles.container}>
        <Text 
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {selectedDiningHall} {selectedMealTime?.charAt(0).toUpperCase() + selectedMealTime?.slice(1)} Menu
        </Text>
        
        <HeaderSelector
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
        <View style={styles.searchAndFilterRow}>
          <View style={[
            styles.searchContainer,
            isSearchFocused && styles.searchContainerFocused
          ]}>
            <View style={styles.searchIconContainer}>
              <MaterialIcons 
                name="search" 
                size={18} 
                color={isSearchFocused ? '#32745f' : (isDarkMode ? '#888' : '#666')} 
              />
            </View>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search food items..."
              placeholderTextColor={isDarkMode ? '#AAA' : '#666'}
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
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <MaterialIcons 
                  name="clear" 
                  size={20} 
                  color={isDarkMode ? '#AAA' : '#666'} 
                />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.filterButton,
              hasActiveFilters && styles.filterButtonActive
            ]}
            onPress={() => {
              setFilterModalVisible(true);
              setDiningOpen(false);
              setMealOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open filters"
          >
            <MaterialIcons 
              name="tune" 
              size={20} 
              color={isDarkMode ? '#E0E0E0' : '#32745f'} 
            />
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text></Text>
        ) : (
          <FlatList
            data={getFilteredSections()}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: isDarkMode ? '#888' : '#666',
                  marginTop: 8,
                  marginBottom: 8,
                  paddingHorizontal: 16,
                }}>
                  {item.subheader}
                </Text>
                {item.data.map((foodItem, index) => {
                  // Helper function to normalize allergen strings
                  const normalizeAllergen = (allergen) => {
                    const allergenMap = {
                      "WHEAT/BARLEY/RYE": "wheat/barley/rye",
                      "SESAME SEED": "sesame seed",
                      "TREE NUTS": "tree nuts",
                      "ITEM IS DEEP FRIED": "item is deep fried"
                    };
                    return allergenMap[allergen] || allergen.toLowerCase();
                  };

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

                  const isAdded = addedItems.includes(foodItem.name);
                  const dailyCalories = userDailyValues?.dailyCalories || 2000;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.foodItem}
                      onPress={() => {
                        dismissSearch();
                        handleFoodPress(foodItem);
                      }}
                    >
                      <View style={styles.foodDetails}>
                        <Text style={styles.foodName}>{foodItem.name}</Text>
                        
                        {/* Only show labels if there are matches */}
                        {(matchingAllergens.length > 0 || matchingPreferences.length > 0) && (
                          <View style={styles.labelContainer}>
                            {matchingAllergens.map(allergen => (
                              <View key={allergen} style={[styles.label, styles.allergenLabel]}>
                                <Text style={[styles.labelText, styles.allergenLabelText]}>
                                  Contains {allergen}
                                </Text>
                              </View>
                            ))}
                            {matchingPreferences.map(pref => (
                              <View key={pref} style={[styles.label, styles.preferenceLabel]}>
                                <Text style={[styles.labelText, styles.preferenceLabelText]}>
                                  {pref}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Displaying all four progress wheels horizontally */}
                        <View style={styles.progressWheelRow}>
                          <View style={styles.progressWheelContainer}>
                            
                            <View style={styles.wheelWrapper}>
                              <AnimatedProgressWheel
                                size={50}
                                width={8}
                                color="#32745f"
                                backgroundColor={isDarkMode ? '#333' : "#E8F5E9"}
                                progress={(foodItem.nutrition_facts.calories / dailyCalories) * 100}
                                rotation="-90deg"
                              />
                              <Text style={styles.centerValue}>
                                {foodItem.nutrition_facts.calories}
                              </Text>
                            </View>
                            <Text style={styles.wheelLabel}>Calories</Text>
                          </View>

                          <View style={styles.progressWheelContainer}>
                            <View style={styles.wheelWrapper}>
                              <AnimatedProgressWheel
                                size={50}
                                width={8}
                                color="#2196F3"
                                backgroundColor={isDarkMode ? '#333' : "#E3F2FD"}
                                progress={(foodItem.nutrition_facts.protein / (userDailyValues?.dailyProtein || 50)) * 100}
                                rotation="-90deg"
                              />
                              <Text style={styles.centerValue}>
                                {foodItem.nutrition_facts.protein}g
                              </Text>
                            </View>
                            <Text style={styles.wheelLabel}>Protein</Text>
                          </View>

                          <View style={styles.progressWheelContainer}>
                            <View style={styles.wheelWrapper}>
                              <AnimatedProgressWheel
                                size={50}
                                width={8}
                                color="#4CAF50"
                                backgroundColor={isDarkMode ? '#333' : "#E8F5E9"}
                                progress={(foodItem.nutrition_facts.total_carbohydrate / (userDailyValues?.dailyCarbs || 275)) * 100}
                                rotation="-90deg"
                              />
                              <Text style={styles.centerValue}>
                                {foodItem.nutrition_facts.total_carbohydrate}g
                              </Text>
                            </View>
                            <Text style={styles.wheelLabel}>Carbs</Text>
                          </View>

                          <View style={styles.progressWheelContainer}>
                            <View style={styles.wheelWrapper}>
                              <AnimatedProgressWheel
                                size={50}
                                width={8}
                                color="#FF9800"
                                backgroundColor={isDarkMode ? '#333' : "#FFF3E0"}
                                progress={(foodItem.nutrition_facts.total_fat / (userDailyValues?.dailyFat || 60)) * 100}
                                rotation="-90deg"
                              />
                              <Text style={styles.centerValue}>
                                {foodItem.nutrition_facts.total_fat}g
                              </Text>
                            </View>
                            <Text style={styles.wheelLabel}>Fat</Text>
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          dismissSearch();
                          addToLog(foodItem, selectedMealTime);
                        }}
                      >
                        <MaterialIcons 
                          name={clickedButtons.has(foodItem.name) ? "check" : "add"} 
                          size={24} 
                          color={isDarkMode ? '#E0E0E0' : '#32745f'} 
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            onScrollBeginDrag={() => {
              setDiningOpen(false);
              setMealOpen(false);
            }}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <Modal
          visible={filterModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterModalOverlay}>
            <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
              <View style={styles.filterModalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={styles.filterModalContent}>
                  <View style={styles.filterModalHeader}>
                    <Text style={styles.filterModalTitle}>Filters</Text>
                    <TouchableOpacity
                      onPress={() => setFilterModalVisible(false)}
                      style={styles.filterCloseButton}
                      accessibilityRole="button"
                      accessibilityLabel="Close filters"
                    >
                      <MaterialIcons
                        name="close"
                        size={20}
                        color={isDarkMode ? '#E0E0E0' : '#666'}
                      />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.filterModalScroll}
                    contentContainerStyle={styles.filterModalScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>Sort by</Text>
                      {SORT_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.key}
                          style={[
                            styles.filterOptionRow,
                            sortOption === option.key && styles.filterOptionRowActive,
                          ]}
                          onPress={() => setSortOption(option.key)}
                          accessibilityRole="button"
                          accessibilityLabel={`Sort by ${option.title}`}
                        >
                          <MaterialIcons
                            name={sortOption === option.key ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={sortOption === option.key ? '#32745f' : (isDarkMode ? '#AAA' : '#666')}
                            style={styles.filterOptionIcon}
                          />
                          <View style={styles.filterOptionTextWrapper}>
                            <Text style={styles.filterOptionTitle}>{option.title}</Text>
                            {option.subtitle ? (
                              <Text style={styles.filterOptionSubtitle}>{option.subtitle}</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>Personal filters</Text>

                      <View style={styles.filterSwitchRow}>
                        <View style={styles.filterSwitchTextWrapper}>
                          <Text style={styles.filterSwitchTitle}>Hide my allergens</Text>
                          <Text style={styles.filterSwitchSubtitle}>
                            Remove dishes that include allergens you have saved.
                          </Text>
                        </View>
                        <Switch
                          value={filterByAllergens}
                          onValueChange={setFilterByAllergens}
                          trackColor={{ false: isDarkMode ? '#555' : '#CFCFCF', true: '#32745f' }}
                          thumbColor={filterByAllergens ? '#FFFFFF' : (isDarkMode ? '#999999' : '#F5F5F5')}
                          ios_backgroundColor={isDarkMode ? '#333333' : '#CFCFCF'}
                        />
                      </View>

                      <View style={styles.filterSwitchRow}>
                        <View style={styles.filterSwitchTextWrapper}>
                          <Text style={styles.filterSwitchTitle}>Only show my dietary preferences</Text>
                          <Text style={styles.filterSwitchSubtitle}>
                            Limit the list to foods that match preferences you selected.
                          </Text>
                        </View>
                        <Switch
                          value={filterByPreferences}
                          onValueChange={setFilterByPreferences}
                          trackColor={{ false: isDarkMode ? '#555' : '#CFCFCF', true: '#32745f' }}
                          thumbColor={filterByPreferences ? '#FFFFFF' : (isDarkMode ? '#999999' : '#F5F5F5')}
                          ios_backgroundColor={isDarkMode ? '#333333' : '#CFCFCF'}
                        />
                      </View>
                    </View>
                  </ScrollView>

                  <View style={styles.filterFooter}>
                    <TouchableOpacity
                      style={styles.filterFooterButtonSecondary}
                      onPress={() => {
                        setSortOption('none');
                        setFilterByAllergens(initialFilterSettings.current.allergens);
                        setFilterByPreferences(initialFilterSettings.current.preferences);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Reset filters"
                    >
                      <Text style={styles.filterFooterButtonSecondaryText}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.filterFooterButtonPrimary}
                      onPress={() => setFilterModalVisible(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Apply filters"
                    >
                      <Text style={styles.filterFooterButtonPrimaryText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
            </View>
          </Modal>

        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={styles.modalContainer}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  {currentFoodItem && (
                    <>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity 
                          style={styles.closeButton}
                          onPress={() => setModalVisible(false)}
                        >
                          <MaterialIcons name="close" size={24} color={isDarkMode ? '#E0E0E0' : '#666'} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle} numberOfLines={0}>
                          {currentFoodItem.name}
                        </Text>
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            addToLog(currentFoodItem, selectedMealTime);
                          }}
                        >
                          <Icon 
                            name={clickedButtons.has(currentFoodItem?.name) ? "check" : "plus"} 
                            size={20} 
                            style={styles.addButtonIcon} 
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Compact Macros */}
                      <View style={styles.macroRow}>
                        <Text style={styles.macroText}>
                          {currentFoodItem.nutrition_facts.calories} cal |  
                          Proteins: {currentFoodItem.nutrition_facts.protein}g |  
                          Carbs: {currentFoodItem.nutrition_facts.total_carbohydrate}g |  
                          Fats: {currentFoodItem.nutrition_facts.total_fat}g
                        </Text>
                        {currentFoodItem.nutrition_facts?.serving_size ? (
                          <Text style={styles.servingSizeText}>
                            Serving size: {String(currentFoodItem.nutrition_facts.serving_size).trim()}
                          </Text>
                        ) : null}
                      </View>

                      {/* All Nutrition Facts */}
                      <ScrollView 
                        style={styles.modalScroll}
                        showsVerticalScrollIndicator={true}
                      >
                        <View style={styles.modalScrollContent}>
                          <View style={styles.nutritionGrid}>
                            {Object.entries(currentFoodItem.nutrition_facts)
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
                                  <View key={key} style={styles.nutritionItem}>
                                    <Text style={styles.nutritionLabel}>{label}</Text>
                                    <Text style={styles.nutritionValue}>{valueLabel}</Text>
                                    {percentLabel && (
                                      <Text style={styles.nutritionSubLabel}>{percentLabel}</Text>
                                    )}
                                  </View>
                                );
                              })}
                          </View>

                          {/* Allergens Section */}
                          {currentFoodItem.allergens && currentFoodItem.allergens.length > 0 && (
                            <View style={styles.section}>
                              <Text style={styles.sectionTitle}>Allergens</Text>
                              <View style={styles.tagContainer}>
                                {currentFoodItem.allergens.map((allergen, index) => (
                                  <View key={index} style={[styles.tag, styles.allergenTag]}>
                                    <Text style={styles.allergenText}>{allergen}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}

                          {/* Traits Section */}
                          {currentFoodItem.traits && currentFoodItem.traits.length > 0 && (
                            <View style={styles.section}>
                              <Text style={styles.sectionTitle}>Dietary Information</Text>
                              <View style={styles.tagContainer}>
                                {currentFoodItem.traits.map((trait, index) => (
                                  <View key={index} style={[styles.tag, styles.traitTag]}>
                                    <Text style={styles.traitText}>{trait}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      </ScrollView>
                    </>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Modern Popup Notification */}
        {showPopup && (
          <Animated.View style={[
            styles.popupContainer,
            { 
              transform: [{ translateX: slideAnim }],
              opacity: fadeAnim
            }
          ]}>
            <View style={[
              styles.popup,
              popupType === "success" && styles.popupSuccess,
              popupType === "error" && styles.popupError,
              popupType === "info" && styles.popupInfo
            ]}>
              <View style={styles.popupContent}>
                <MaterialIcons 
                  name={
                    popupType === "success" ? "check-circle" :
                    popupType === "error" ? "error" : "info"
                  }
                  size={20} 
                  color={
                    popupType === "success" ? "#4CAF50" :
                    popupType === "error" ? "#F44336" : "#2196F3"
                  } 
                  style={styles.popupIcon}
                />
                <Text style={styles.popupText}>{popupMessage}</Text>
              </View>
              <View style={[
                styles.popupProgressBar,
                popupType === "success" && styles.popupProgressSuccess,
                popupType === "error" && styles.popupProgressError,
                popupType === "info" && styles.popupProgressInfo
              ]} />
            </View>
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}
