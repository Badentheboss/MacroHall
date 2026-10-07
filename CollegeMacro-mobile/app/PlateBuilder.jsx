import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { postToBackend } from "../utils/api";
import { addItemsToLog } from "../utils/log";
import { fetchHalls, fetchMySchool } from "../utils/schools";

const MEALS = ["breakfast", "brunch", "lunch", "dinner", "late night"];
const label = (meal) => meal.replace(/^\w/, (c) => c.toUpperCase());

// "I have 60g protein and 700 calories left: what do I eat?" Picks dishes and
// servings per dining hall to land on the target, ranks halls, and logs the
// chosen plate in one tap.
export default function PlateBuilder({ navigation }) {
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);

  const [halls, setHalls] = useState([]);
  const [hall, setHall] = useState(null); // null = every hall
  const [meal, setMeal] = useState(null); // null = server picks from the clock
  const [protein, setProtein] = useState("");
  const [calories, setCalories] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logging, setLogging] = useState(null);

  const build = useCallback(
    async (overrides = {}) => {
      setLoading(true);
      try {
        const body = {
          hall: overrides.hall !== undefined ? overrides.hall : hall,
          meal: overrides.meal !== undefined ? overrides.meal : meal,
          protein_g: overrides.protein !== undefined ? overrides.protein : protein || null,
          calories: overrides.calories !== undefined ? overrides.calories : calories || null,
        };
        const data = await postToBackend("/plate", body);
        setResult(data);
        setMeal(data.meal);
        if (!protein && !calories && overrides.protein === undefined) {
          setProtein(String(Math.round(data.target.protein)));
          setCalories(String(Math.round(data.target.calories)));
        }
      } catch (error) {
        Alert.alert("Couldn't build a plate", error.message);
      } finally {
        setLoading(false);
      }
    },
    [hall, meal, protein, calories]
  );

  useEffect(() => {
    fetchMySchool()
      .then((school) => (school ? fetchHalls(school.id) : []))
      .then(setHalls)
      .catch(() => {});
    build();
    // First load targets what's left today; later builds use the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logPlate = async (plate) => {
    setLogging(plate.hall);
    try {
      await addItemsToLog(plate.items, result.meal);
      Alert.alert("Logged", `Added your ${plate.hall} plate to today's log.`, [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert("Couldn't log it", error.message);
    } finally {
      setLogging(null);
    }
  };

  const Chip = ({ active, onPress, children }) => (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Target for this meal</Text>
      <View style={styles.targetRow}>
        <View style={styles.targetBox}>
          <TextInput
            style={styles.targetInput}
            value={protein}
            onChangeText={(v) => setProtein(v.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#888"
          />
          <Text style={styles.targetUnit}>g protein</Text>
        </View>
        <View style={styles.targetBox}>
          <TextInput
            style={styles.targetInput}
            value={calories}
            onChangeText={(v) => setCalories(v.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#888"
          />
          <Text style={styles.targetUnit}>calories</Text>
        </View>
      </View>
      <Text style={styles.hint}>Starts from what you have left today. Change it for a lighter meal or a pre-lift snack.</Text>

      <Text style={styles.label}>Meal</Text>
      <View style={styles.wrap}>
        {MEALS.map((m) => (
          <Chip key={m} active={meal === m} onPress={() => setMeal(m)}>
            {label(m)}
          </Chip>
        ))}
      </View>

      {halls.length > 1 && (
        <>
          <Text style={styles.label}>Dining hall</Text>
          <View style={styles.wrap}>
            <Chip active={!hall} onPress={() => setHall(null)}>
              Best on campus
            </Chip>
            {halls.map((h) => (
              <Chip key={h.id} active={hall === h.name} onPress={() => setHall(h.name)}>
                {h.name}
              </Chip>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.buildButton} onPress={() => build()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buildText}>Build my plate</Text>}
      </TouchableOpacity>

      {result?.message && <Text style={[styles.hint, { textAlign: "center", marginTop: 16 }]}>{result.message}</Text>}

      {(result?.plates || []).map((plate, index) => (
        <View key={plate.hall} style={[styles.plate, index === 0 && styles.bestPlate]}>
          <View style={styles.plateHeader}>
            <Text style={styles.plateHall}>{plate.hall}</Text>
            {index === 0 && <Text style={styles.best}>BEST MATCH</Text>}
          </View>

          {plate.items.map((item) => (
            <View key={`${item.name}-${item.subheader}`} style={styles.itemRow}>
              <Text style={styles.servings}>{item.servings}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.subheader ? <Text style={styles.hint}>{item.subheader}</Text> : null}
              </View>
              <Text style={styles.itemMacros}>
                {Math.round(Number(item.nutrition_facts?.protein || 0) * item.servings)}g · {Math.round(Number(item.nutrition_facts?.calories || 0) * item.servings)} cal
              </Text>
            </View>
          ))}

          <View style={styles.totals}>
            <Total label="Protein" value={`${Math.round(plate.totals.protein)}g`} goal={`${Math.round(result.target.protein)}g`} styles={styles} />
            <Total label="Calories" value={plate.totals.calories} goal={Math.round(result.target.calories)} styles={styles} />
            <Total label="Carbs" value={`${Math.round(plate.totals.carbs)}g`} styles={styles} />
            <Total label="Fat" value={`${Math.round(plate.totals.fat)}g`} styles={styles} />
          </View>

          {plate.items.some((item) => item.nutrition_source === "ai_estimated" || item.nutrition_source === "crowdsourced") && (
            <Text style={styles.hint}>Some numbers are estimates.</Text>
          )}

          <TouchableOpacity style={styles.logButton} onPress={() => logPlate(plate)} disabled={logging !== null}>
            <MaterialIcons name="playlist-add" size={20} color="#fff" />
            <Text style={styles.logText}>{logging === plate.hall ? "Logging..." : "Log this plate"}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function Total({ label: name, value, goal, styles }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={styles.totalValue}>{value}</Text>
      <Text style={styles.hint}>{goal ? `${name} / ${goal}` : name}</Text>
    </View>
  );
}

const makeStyles = (isDarkMode) => {
  const text = isDarkMode ? "#E0E0E0" : "#222";
  const subtle = isDarkMode ? "#999" : "#666";
  const surface = isDarkMode ? "#1E1E1E" : "#fff";
  const border = isDarkMode ? "#333" : "rgba(50,116,95,0.2)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#f5f7fa" },
    content: { padding: 16, paddingBottom: 48 },
    label: { fontSize: 14, fontWeight: "700", color: text, marginTop: 16, marginBottom: 8 },
    hint: { fontSize: 12, color: subtle, marginTop: 4 },
    targetRow: { flexDirection: "row", gap: 12 },
    targetBox: { flex: 1, backgroundColor: surface, borderRadius: 14, borderWidth: 1.5, borderColor: border, padding: 12, alignItems: "center" },
    targetInput: { fontSize: 28, fontWeight: "800", color: text, minWidth: 80, textAlign: "center" },
    targetUnit: { fontSize: 13, color: subtle },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { borderWidth: 1.5, borderColor: border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: surface },
    chipActive: { backgroundColor: "#32745f", borderColor: "#32745f" },
    chipText: { fontSize: 14, fontWeight: "600", color: text },
    chipTextActive: { color: "#fff" },
    buildButton: { backgroundColor: "#32745f", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 20 },
    buildText: { color: "#fff", fontSize: 17, fontWeight: "800" },
    plate: { backgroundColor: surface, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: border },
    bestPlate: { borderColor: "#32745f", borderWidth: 2 },
    plateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    plateHall: { fontSize: 18, fontWeight: "800", color: text },
    best: { fontSize: 11, fontWeight: "800", color: "#32745f" },
    itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    servings: { fontSize: 15, fontWeight: "800", color: "#32745f", width: 28 },
    itemName: { fontSize: 15, fontWeight: "600", color: text },
    itemMacros: { fontSize: 13, color: subtle },
    totals: { flexDirection: "row", marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border },
    totalValue: { fontSize: 16, fontWeight: "800", color: text },
    logButton: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#2E7D32", borderRadius: 12, paddingVertical: 11, marginTop: 12 },
    logText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
};
