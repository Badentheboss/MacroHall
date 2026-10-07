// Food log: today's entries grouped by meal, with serving steppers.
import React, { useState, useCallback, useEffect } from "react";
import { View, TextInput, Alert, Platform, Pressable } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../utils/config";
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { radius, space, type, useAppTheme, useStyles } from '../../theme';
import { Card, EmptyState, FadeIn, IconButton, Screen, Tap, Txt } from '../../components/kit';

const formatCount = (n) => Math.round(n || 0).toLocaleString('en-US');

const logStyles = (c) => ({
  intro: { gap: space.xs, paddingTop: space.sm },
  summary: { flexDirection: 'row', paddingVertical: space.lg + 4, paddingHorizontal: space.sm },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  meal: { gap: space.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space.xs },
  entries: { paddingVertical: space.sm },
  entry: { paddingHorizontal: space.lg + 4, paddingVertical: space.md, gap: space.sm },
  entryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  entryBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: radius.pill, backgroundColor: c.sunken },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepInput: { ...type.bodyStrong, width: 36, padding: 0, textAlign: 'center', color: c.ink, fontVariant: ['tabular-nums'], outlineStyle: 'none' },
  clear: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill },
});

export default function Log() {
  const navigation = useNavigation();
  const [logItems, setLogItems] = useState([]);
  const [userDailyValues, setUserDailyValues] = useState(null);
  const { isDarkMode } = useTheme();
  const [editingServing, setEditingServing] = useState(null);
  const { c } = useAppTheme();
  const styles = useStyles(logStyles);

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

  // Asks before wiping the log (Alert has no buttons on web, so use confirm there).
  const confirmClearLog = () => {
    const title = "Clear today's log?";
    const message = 'This removes every item you logged today.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n${message}`)) clearLog();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearLog },
    ]);
  };

  const totals = logItems.reduce(
    (acc, item) => {
      const facts = item.nutrition_facts || {};
      acc.calories += Number(facts.calories) || 0;
      acc.protein += Number(facts.protein) || 0;
      acc.carbs += Number(facts.total_carbohydrate) || 0;
      acc.fat += Number(facts.total_fat) || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const summary = [
    { key: 'calories', value: formatCount(totals.calories), label: 'cal' },
    { key: 'protein', value: `${formatCount(totals.protein)}g`, label: 'protein', color: c.protein },
    { key: 'carbs', value: `${formatCount(totals.carbs)}g`, label: 'carbs', color: c.carbs },
    { key: 'fat', value: `${formatCount(totals.fat)}g`, label: 'fat', color: c.fat },
  ];

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const calorieGoal = userDailyValues?.dailyCalories;

  const header = (
    <FadeIn index={0} style={styles.intro}>
      <Txt variant="overline" tone="muted">
        {logItems.length > 0 ? `${logItems.length} ${logItems.length === 1 ? 'item' : 'items'} logged` : 'Food log'}
      </Txt>
      <Txt variant="h1" accessibilityRole="header">{todayLabel}</Txt>
    </FadeIn>
  );

  if (logItems.length === 0) {
    return (
      <Screen>
        {header}
        <FadeIn index={1}>
          <Card padded={false}>
            <EmptyState
              icon="restaurant-outline"
              title="Nothing logged yet"
              body="Add dishes from today's dining hall menus to track your calories and macros."
              action="Browse menus"
              onAction={() => navigation.navigate('AddFood')}
            />
          </Card>
        </FadeIn>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      {/* Totals */}
      <FadeIn index={1}>
        <Card padded={false}>
          <View style={styles.summary}>
          {summary.map((item) => (
            <View key={item.key} style={styles.summaryItem} accessible accessibilityLabel={`${item.value} ${item.label}`}>
              <Txt variant="number" style={{ fontVariant: ['tabular-nums'] }}>{item.value}</Txt>
              <View style={styles.summaryLabel}>
                {item.color ? <View style={[styles.dot, { backgroundColor: item.color }]} /> : null}
                <Txt variant="caption" tone="muted">{item.label}</Txt>
              </View>
            </View>
          ))}
          </View>
        </Card>
        {calorieGoal ? (
          <Txt variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: space.sm }}>
            {formatCount(totals.calories)} of {formatCount(calorieGoal)} cal goal
          </Txt>
        ) : null}
      </FadeIn>

      {/* Entries by meal */}
      {sections.map((section, sectionIndex) => {
        const mealCalories = section.data.reduce((sum, item) => sum + (Number(item.nutrition_facts?.calories) || 0), 0);
        return (
          <FadeIn key={section.title} index={sectionIndex + 2} style={styles.meal}>
            <View style={styles.mealHeader}>
              <Txt variant="overline" tone="muted" accessibilityRole="header">{section.title}</Txt>
              <Txt variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>{formatCount(mealCalories)} cal</Txt>
            </View>
            <Card padded={false}>
              <View style={styles.entries}>
              {section.data.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.entry}>
                  <View style={styles.entryTop}>
                    <Txt variant="bodyStrong" numberOfLines={2} style={{ flex: 1, paddingTop: space.sm + 2 }}>
                      {item.name}
                    </Txt>
                    <IconButton
                      name="trash-outline"
                      size={19}
                      color={c.muted}
                      label={`Remove ${item.name}`}
                      onPress={() => removeItem(item.name)}
                      style={{ marginRight: -space.sm }}
                    />
                  </View>
                  <View style={styles.entryBottom}>
                    <Txt variant="caption" tone="muted" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
                      {Math.round(item.nutrition_facts.calories)} cal · {Math.round(item.nutrition_facts.protein)}g protein · {Math.round(item.nutrition_facts.total_carbohydrate)}g carbs · {Math.round(item.nutrition_facts.total_fat)}g fat
                    </Txt>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepButton}
                        accessibilityRole="button"
                        accessibilityLabel={item.servings - 1 <= 0 ? `Remove ${item.name}` : `Decrease servings of ${item.name}`}
                        onPress={() => {
                          if (item.servings - 1 <= 0) {
                            removeItem(item.name);
                          } else {
                            updateServings(item.name, item.servings - 1);
                          }
                        }}
                      >
                        <Ionicons name="remove" size={18} color={c.ink} />
                      </Pressable>

                      <TextInput
                        style={styles.stepInput}
                        value={editingServing?.name === item.name ? editingServing.value : String(item.servings ?? 1)}
                        keyboardType="numeric"
                        accessibilityLabel={`Servings of ${item.name}`}
                        selectTextOnFocus
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

                      <Pressable
                        style={styles.stepButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase servings of ${item.name}`}
                        onPress={() => updateServings(item.name, item.servings + 1)}
                      >
                        <Ionicons name="add" size={18} color={c.ink} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
              </View>
            </Card>
          </FadeIn>
        );
      })}

      <FadeIn index={sections.length + 2}>
        <Tap onPress={confirmClearLog} accessibilityRole="button" accessibilityLabel="Clear today's log" style={styles.clear}>
          <Ionicons name="trash-outline" size={16} color={c.accent} />
          <Txt variant="small" tone="accent" style={{ fontFamily: type.bodyStrong.fontFamily }}>Clear log</Txt>
        </Tap>
      </FadeIn>
    </Screen>
  );
}
