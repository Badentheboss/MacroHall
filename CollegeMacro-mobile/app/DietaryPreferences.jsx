import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { useTheme } from '../context/ThemeContext';
import { supabase } from "../utils/config";
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";

export default function DietaryPreferences() {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [allergens, setAllergens] = useState([]);
  const [preferences, setPreferences] = useState([]);

  useEffect(() => {
    async function fetchUserPreferences() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('users')
          .select('allergens, preferences')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setAllergens(data.allergens || []);
          setPreferences(data.preferences || []);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error.message);
      }
    }

    fetchUserPreferences();
  }, []);

  const allergenOptions = [
    "beef",
    "eggs",
    "fish",
    "milk",
    "oats",
    "peanuts",
    "pork",
    "sesame seed",
    "shellfish",
    "soy",
    "tree nuts",
    "wheat/barley/rye",
    "item is deep fried",
    "alcohol"
  ];

  const dietaryPreferences = [
    "Gluten Free",
    "Halal",
    "Spicy",
    "Vegan",
    "Vegetarian",
    "Kosher",
    "Nutrient Dense Low",
    "Nutrient Dense Low Medium",
    "Nutrient Dense Medium",
    "Nutrient Dense Medium High",
    "Nutrient Dense High",
    "Carbon Footprint High",
    "Carbon Footprint Medium",
    "Carbon Footprint Low"
  ];

  const toggleAllergen = (allergen) => {
    setAllergens(current => 
      current.includes(allergen)
        ? current.filter(a => a !== allergen)
        : [...current, allergen]
    );
  };

  const togglePreference = (preference) => {
    setPreferences(current => 
      current.includes(preference)
        ? current.filter(p => p !== preference)
        : [...current, preference]
    );
  };

  const savePreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const { error } = await supabase
        .from('users')
        .update({
          allergens: allergens,
          preferences: preferences
        })
        .eq('id', user.id);

      if (error) throw error;
      navigation.goBack();
    } catch (error) {
      console.error('Error saving preferences:', error.message);
    }
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : "#f5f7fa",
    },
    container: {
      flex: 1,
      padding: 20,
      paddingTop: 20,
    },
    scrollContent: {
      paddingBottom: 80,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    backButton: {
      marginRight: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
    },
    section: {
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: isDarkMode ? '#888' : "#666",
      marginBottom: 16,
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    optionText: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : "#333",
    },
    saveButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: isDarkMode ? '#121212' : "#f5f7fa",
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    saveButton: {
      backgroundColor: '#32745f',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons 
              name="arrow-back" 
              size={24} 
              color={isDarkMode ? '#E0E0E0' : '#32745f'} 
            />
          </TouchableOpacity>
          <Text style={styles.title}>Dietary Preferences</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allergens</Text>
            <Text style={styles.sectionSubtitle}>(Select all that apply)</Text>
            {allergenOptions.map((allergen) => (
              <TouchableOpacity 
                key={allergen}
                style={styles.optionRow}
                onPress={() => toggleAllergen(allergen)}
              >
                <Text style={styles.optionText}>{allergen}</Text>
                <MaterialIcons
                  name={allergens.includes(allergen) ? "check-box" : "check-box-outline-blank"}
                  size={24}
                  color={isDarkMode ? '#E0E0E0' : "#32745f"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <Text style={styles.sectionSubtitle}>(Select all that apply)</Text>
            {dietaryPreferences.map((preference) => (
              <TouchableOpacity 
                key={preference}
                style={styles.optionRow}
                onPress={() => togglePreference(preference)}
              >
                <Text style={styles.optionText}>{preference}</Text>
                <MaterialIcons
                  name={preferences.includes(preference) ? "check-box" : "check-box-outline-blank"}
                  size={24}
                  color={isDarkMode ? '#E0E0E0' : "#32745f"}
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.saveButtonContainer}>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={savePreferences}
          >
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
} 