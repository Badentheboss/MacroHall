import React, { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, Alert } from "react-native";
import { supabase } from "../../utils/config";
import AnimatedProgressWheel from "react-native-progress-wheel";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';

export default function Log() {
  const [logItems, setLogItems] = useState([]);
  const [userDailyValues, setUserDailyValues] = useState(null);
  const { isDarkMode } = useTheme();
  const [editingServing, setEditingServing] = useState(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : "#f5f7fa",
      padding: 20,
    },
    listContainer: {
      flex: 1,
      marginTop: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      marginBottom: 24,
      marginTop: 12,
    },
    logItem: {
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      borderRadius: 20,
      padding: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
      shadowColor: isDarkMode ? "#000" : "#32745f",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    foodDetails: {
      flex: 1,
    },
    foodName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      flex: 1,
      marginRight: 16,
    },
    servingInfo: {
      fontSize: 14,
      color: isDarkMode ? '#888' : "#666",
    },
    nutritionInfo: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: 12,
      marginTop: 8,
    },
    nutritionText: {
      fontSize: 12,
      color: isDarkMode ? '#888' : "#666",
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: isDarkMode ? 'rgba(224, 224, 224, 0.1)' : "rgba(50, 116, 95, 0.1)",
    },
    servingAdjust: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    servingText: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      fontWeight: '600',
      minWidth: 30,
      textAlign: 'center',
      padding: 0,
    },
    mealLabel: {
      position: 'absolute',
      top: -10,
      left: 16,
      backgroundColor: isDarkMode ? '#333' : '#32745f',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      zIndex: 1,
    },
    mealText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    nutritionGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginTop: 8,
    },
    nutritionItem: {
      alignItems: 'center',
    },
    nutritionValue: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
    },
    nutritionLabel: {
      fontSize: 12,
      color: isDarkMode ? '#888' : '#666',
      marginTop: 2,
    },
    sectionHeader: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: isDarkMode ? '#121212' : '#f5f7fa',
    },
    sectionHeaderText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? '#888' : '#666',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.1)',
      marginTop: 8,
    },
    clearButton: {
      position: 'absolute',
      top: 10,
      right: 20,
      zIndex: 10,
      padding: 8,
      borderRadius: 8,
      backgroundColor: isDarkMode ? 'rgba(224, 224, 224, 0.1)' : "rgba(50, 116, 95, 0.1)",
    },
    clearButtonText: {
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      fontSize: 14,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 16,
      color: isDarkMode ? '#888' : '#666',
      textAlign: 'center',
      lineHeight: 24,
    },
  });

  useFocusEffect(
    React.useCallback(() => {
      fetchLogData();
    }, [])
  );

  const fetchLogData = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('log, dailyValues')
        .eq('id', user.data.user.id)
        .single();

      if (error) throw error;

      setLogItems(data.log || []);
      setUserDailyValues(data.dailyValues);
    } catch (error) {
      console.error('Error fetching log:', error);
    }
  };

  const updateServings = async (itemName, newServings) => {
    if (newServings <= 0) return;

    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      const updatedLog = logItems.map(item => {
        if (item.name === itemName) {
          const updatedItem = { ...item, servings: newServings };
          // Recalculate all nutrition facts based on base values
          updatedItem.nutrition_facts = {
            calories: item.baseNutrition.calories * newServings,
            protein: item.baseNutrition.protein * newServings,
            total_carbohydrate: item.baseNutrition.total_carbohydrate * newServings,
            total_fat: item.baseNutrition.total_fat * newServings,
            iron: item.baseNutrition.iron * newServings,
            sodium: item.baseNutrition.sodium * newServings,
            sugars: item.baseNutrition.sugars * newServings,
            calcium: item.baseNutrition.calcium * newServings,
            cholesterol: item.baseNutrition.cholesterol * newServings,
            saturated_fat: item.baseNutrition.saturated_fat * newServings,
            dietary_fiber: item.baseNutrition.dietary_fiber * newServings,
            vitamin_a: item.baseNutrition.vitamin_a * newServings,
            vitamin_c: item.baseNutrition.vitamin_c * newServings,
          };
          return updatedItem;
        }
        return item;
      });

      const { error } = await supabase
        .from('users')
        .update({ log: updatedLog })
        .eq('id', user.data.user.id);

      if (error) throw error;
      setLogItems(updatedLog);
    } catch (error) {
      console.error('Error updating servings:', error);
    }
  };

  const removeItem = async (itemName) => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      const updatedLog = logItems.filter(item => item.name !== itemName);
      const { error } = await supabase
        .from('users')
        .update({ log: updatedLog })
        .eq('id', user.data.user.id);

      if (error) throw error;
      setLogItems(updatedLog);
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const groupedLogItems = logItems.reduce((acc, item) => {
    const mealTime = item.mealTime?.charAt(0).toUpperCase() + item.mealTime?.slice(1).toLowerCase() || 'Snack';
    if (!acc[mealTime]) {
      acc[mealTime] = [];
    }
    acc[mealTime].push(item);
    return acc;
  }, {});

  const mealOrder = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Snack'];

  const sections = Object.entries(groupedLogItems)
    .sort(([a], [b]) => {
      const indexA = mealOrder.indexOf(a);
      const indexB = mealOrder.indexOf(b);
      return indexA - indexB;
    })
    .map(([title, data]) => ({ title, data }));

  const clearLog = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ log: [] })
        .eq('id', user.data.user.id);

      if (error) throw error;
      setLogItems([]);
    } catch (error) {
      console.error('Error clearing log:', error);
    }
  };

  return (
    <View style={styles.container}>
      {logItems.length > 0 && (
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={clearLog}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      )}
      
      {logItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Your food log is empty.{'\n'}
            Add items from the AddFood tab to start tracking!
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
                <View style={styles.sectionDivider} />
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.logItem}>
                <View style={styles.foodDetails}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.foodName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.controls}>
                      <View style={styles.servingAdjust}>
                        <TouchableOpacity 
                          style={styles.iconButton}
                          onPress={() => {
                            if (item.servings - 1 <= 0) {
                              removeItem(item.name);
                            } else {
                              updateServings(item.name, item.servings - 1);
                            }
                          }}
                        >
                          <Icon name="remove" size={20} color={isDarkMode ? '#E0E0E0' : "#32745f"} />
                        </TouchableOpacity>
                        
                        <TextInput
                          style={styles.servingText}
                          value={editingServing?.name === item.name ? editingServing.value : item.servings.toString()}
                          keyboardType="numeric"
                          onChangeText={(text) => {
                            setEditingServing({ name: item.name, value: text });
                          }}
                          onBlur={() => {
                            if (editingServing) {
                              const newServings = parseFloat(editingServing.value) || 0;
                              if (newServings === 0) {
                                removeItem(item.name);
                              } else {
                                updateServings(item.name, newServings);
                              }
                              setEditingServing(null);
                            }
                          }}
                        />
                        
                        <TouchableOpacity 
                          style={styles.iconButton}
                          onPress={() => updateServings(item.name, item.servings + 1)}
                        >
                          <Icon name="add" size={20} color={isDarkMode ? '#E0E0E0' : "#32745f"} />
                        </TouchableOpacity>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.iconButton}
                        onPress={() => removeItem(item.name)}
                      >
                        <Icon name="delete-outline" size={20} color={isDarkMode ? '#E0E0E0' : "#32745f"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.nutritionInfo}>
                    <Text style={styles.nutritionText}>{Math.round(item.nutrition_facts.calories)} cal</Text>
                    <Text style={styles.nutritionText}>{Math.round(item.nutrition_facts.protein)}g protein</Text>
                    <Text style={styles.nutritionText}>{Math.round(item.nutrition_facts.total_carbohydrate)}g carbs</Text>
                    <Text style={styles.nutritionText}>{Math.round(item.nutrition_facts.total_fat)}g fat</Text>
                  </View>
                </View>
              </View>
            )}
            stickySectionHeadersEnabled={false}
          />
        </View>
      )}
    </View>
  );
}