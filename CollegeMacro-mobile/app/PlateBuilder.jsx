import React, { useCallback, useEffect, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import { postToBackend } from "../utils/api";
import { addItemsToLog } from "../utils/log";
import { fetchHalls, fetchMySchool } from "../utils/schools";
import { radius, space, type, useAppTheme, useStyles } from "../theme";
import { Button, Chip, ChipRow, Divider, EmptyState, FadeIn, Screen, Txt } from "../components/kit";

const MEALS = ["breakfast", "brunch", "lunch", "dinner", "late night"];
const label = (meal) => meal.replace(/^\w/, (c) => c.toUpperCase());

// "I have 60g protein and 700 calories left: what do I eat?" Picks dishes and
// servings per dining hall to land on the target, ranks halls, and logs the
// chosen plate in one tap.
export default function PlateBuilder({ navigation }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);

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

  const plates = result?.plates || [];

  return (
    <Screen contentStyle={styles.content}>
      {/* Targets */}
      <View style={styles.section}>
        <Txt variant="overline" tone="muted">Target for this meal</Txt>
        <View style={styles.targetRow}>
          <TargetInput value={protein} onChange={setProtein} unit="g protein" color={c.protein} accessibilityLabel="Protein target in grams" />
          <TargetInput value={calories} onChange={setCalories} unit="calories" accessibilityLabel="Calorie target" />
        </View>
        <Txt variant="caption" tone="muted">
          Starts from what you have left today. Change it for a lighter meal or a pre-lift snack.
        </Txt>
      </View>

      {/* Meal */}
      <View style={styles.section}>
        <Txt variant="overline" tone="muted">Meal</Txt>
        <View style={styles.bleed}>
          <ChipRow style={styles.chipRow}>
            {MEALS.map((m) => (
              <Chip key={m} label={label(m)} active={meal === m} onPress={() => setMeal(m)} />
            ))}
          </ChipRow>
        </View>
      </View>

      {/* Dining hall */}
      {halls.length > 1 && (
        <View style={styles.section}>
          <Txt variant="overline" tone="muted">Dining hall</Txt>
          <View style={styles.bleed}>
            <ChipRow style={styles.chipRow}>
              <Chip label="Best on campus" icon={!hall ? "sparkles" : "sparkles-outline"} active={!hall} onPress={() => setHall(null)} />
              {halls.map((h) => (
                <Chip key={h.id} label={h.name} active={hall === h.name} onPress={() => setHall(h.name)} />
              ))}
            </ChipRow>
          </View>
        </View>
      )}

      <Button title="Build my plate" size="lg" icon="restaurant-outline" onPress={() => build()} loading={loading} disabled={loading} />

      {result?.message && (
        <EmptyState
          icon="restaurant-outline"
          title={plates.length ? undefined : "No plate this time"}
          body={result.message}
          style={styles.empty}
        />
      )}

      {plates.map((plate, index) => (
        <FadeIn key={plate.hall} index={index}>
          <View style={styles.plate}>
            <View style={styles.plateHeader}>
              {index === 0 && (
                <Txt variant="overline" tone="accent">
                  Best match
                </Txt>
              )}
              <Txt variant="h2">{plate.hall}</Txt>
            </View>

            <View>
              {plate.items.map((item, itemIndex) => (
                <View key={`${item.name}-${item.subheader}`}>
                  {itemIndex > 0 && <Divider />}
                  <View style={styles.itemRow}>
                    <View style={styles.servings}>
                      <Txt variant="caption" style={styles.servingsText}>
                        {item.servings}×
                      </Txt>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="bodyStrong" numberOfLines={2}>
                        {item.name}
                      </Txt>
                      {item.subheader ? (
                        <Txt variant="caption" tone="muted">
                          {item.subheader}
                        </Txt>
                      ) : null}
                    </View>
                    <View style={styles.itemMacros}>
                      <Txt variant="small" style={styles.tabular}>
                        {Math.round(Number(item.nutrition_facts?.protein || 0) * item.servings)}g
                      </Txt>
                      <Txt variant="caption" tone="muted" style={styles.tabular}>
                        {Math.round(Number(item.nutrition_facts?.calories || 0) * item.servings)} cal
                      </Txt>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.totals}>
              <Total label="Protein" value={`${Math.round(plate.totals.protein)}g`} goal={`${Math.round(result.target.protein)}g`} color={c.protein} />
              <Total label="Calories" value={Math.round(plate.totals.calories)} goal={Math.round(result.target.calories)} />
              <Total label="Carbs" value={`${Math.round(plate.totals.carbs)}g`} color={c.carbs} />
              <Total label="Fat" value={`${Math.round(plate.totals.fat)}g`} color={c.fat} />
            </View>

            {plate.items.some((item) => item.nutrition_source === "ai_estimated" || item.nutrition_source === "crowdsourced") && (
              <Txt variant="caption" tone="muted">
                Some numbers are estimates.
              </Txt>
            )}

            <Button
              title={logging === plate.hall ? "Logging..." : "Log this plate"}
              variant="secondary"
              icon="add-circle-outline"
              onPress={() => logPlate(plate)}
              disabled={logging !== null}
              accessibilityLabel={`Log the ${plate.hall} plate`}
            />
          </View>
        </FadeIn>
      ))}
    </Screen>
  );
}

// Big tabular number typed straight into a sunken card, unit caption below.
function TargetInput({ value, onChange, unit, color, accessibilityLabel }) {
  const { c } = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.sunken, borderRadius: radius.lg, paddingVertical: space.lg, paddingHorizontal: space.md, alignItems: "center", gap: space.xs }}>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={c.faint}
        accessibilityLabel={accessibilityLabel}
        maxLength={5}
        style={[
          type.number,
          { fontSize: 34, lineHeight: 40, color: c.ink, textAlign: "center", alignSelf: "stretch", padding: 0, outlineStyle: "none" },
        ]}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {color ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} /> : null}
        <Txt variant="caption" tone="muted">
          {unit}
        </Txt>
      </View>
    </View>
  );
}

function Total({ label: name, value, goal, color }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="number" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {color ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /> : null}
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {name}
        </Txt>
      </View>
      {goal ? (
        <Txt variant="caption" tone="muted" numberOfLines={1} accessibilityLabel={`${name} target ${goal}`} style={color ? { paddingLeft: 11 } : null}>
          of {goal}
        </Txt>
      ) : null}
    </View>
  );
}

const makeStyles = (c) => ({
  content: { gap: space.xl },
  section: { gap: space.md },
  targetRow: { flexDirection: "row", gap: space.md },
  bleed: { marginHorizontal: -space.lg },
  chipRow: { paddingHorizontal: space.lg },
  empty: { paddingVertical: space.xl },
  plate: { backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl, gap: space.lg },
  plateHeader: { gap: space.xs },
  itemRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  servings: { minWidth: 36, height: 28, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center" },
  servingsText: { fontFamily: type.title.fontFamily, fontVariant: ["tabular-nums"] },
  itemMacros: { alignItems: "flex-end", gap: 2 },
  tabular: { fontVariant: ["tabular-nums"], fontFamily: type.bodyStrong.fontFamily },
  totals: { flexDirection: "row", gap: space.sm, backgroundColor: c.sunken, borderRadius: radius.md, padding: space.lg },
});
