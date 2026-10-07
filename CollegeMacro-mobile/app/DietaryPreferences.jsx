// Dietary preferences: allergies and eating preferences as wrapping chip groups.
import React, { useState, useEffect } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { supabase } from "../utils/config";
import { fonts, space, useStyles } from "../theme";
import { Button, Card, Chip, FadeIn, Screen, Txt } from "../components/kit";

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

// Display-only labels; the stored values stay exactly as above.
const sentenceCase = (text) => {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};
const allergenLabel = (value) => (value === "item is deep fried" ? "Deep fried" : sentenceCase(value));

const PREFERENCE_GROUPS = [
  { title: "Diet", prefix: "", items: dietaryPreferences.filter((p) => !p.startsWith("Nutrient Dense") && !p.startsWith("Carbon Footprint")) },
  { title: "Nutrient density", prefix: "Nutrient Dense ", items: dietaryPreferences.filter((p) => p.startsWith("Nutrient Dense")) },
  { title: "Carbon footprint", prefix: "Carbon Footprint ", items: dietaryPreferences.filter((p) => p.startsWith("Carbon Footprint")) },
];

const makeStyles = (c) => ({
  root: { backgroundColor: c.bg },
  content: { gap: space.xl, paddingTop: space.sm, paddingBottom: space.xxl },
  group: { gap: space.sm },
  head: { paddingHorizontal: space.xs, gap: space.xs },
  headTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card: { gap: space.lg },
  subgroup: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  bar: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
});

function SectionHead({ title, body, count }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.head}>
      <View style={styles.headTop}>
        <Txt variant="overline" tone="muted">{title}</Txt>
        {count > 0 ? <Txt variant="caption" tone="muted">{count} selected</Txt> : null}
      </View>
      <Txt variant="small" tone="muted">{body}</Txt>
    </View>
  );
}

export default function DietaryPreferences() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const [allergens, setAllergens] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [saving, setSaving] = useState(false);

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
      setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  return (
    // On web the stack lets cards grow with the document; pin the height so the
    // Save bar stays docked at the bottom like it does on a phone.
    <View style={[styles.root, Platform.OS === "web" ? { height: windowHeight - headerHeight } : { flex: 1 }]}>
      <Screen showsVerticalScrollIndicator={false} contentStyle={styles.content}>
        <FadeIn index={0} style={styles.group}>
          <SectionHead
            title="Allergies"
            body="We'll flag dishes that contain these so you can skip them."
            count={allergens.length}
          />
          <Card>
            <View style={styles.chips}>
              {allergenOptions.map((allergen) => (
                <Chip
                  key={allergen}
                  label={allergenLabel(allergen)}
                  active={allergens.includes(allergen)}
                  icon={allergens.includes(allergen) ? "checkmark" : undefined}
                  onPress={() => toggleAllergen(allergen)}
                />
              ))}
            </View>
          </Card>
        </FadeIn>

        <FadeIn index={1} style={styles.group}>
          <SectionHead
            title="Preferences"
            body="Pick what you look for and we'll surface matching dishes first."
            count={preferences.length}
          />
          <Card style={styles.card}>
            {PREFERENCE_GROUPS.map((group) => (
              <View key={group.title} style={styles.subgroup}>
                <Txt variant="small" style={{ fontFamily: fonts.semibold }}>{group.title}</Txt>
                <View style={styles.chips}>
                  {group.items.map((preference) => (
                    <Chip
                      key={preference}
                      label={sentenceCase(preference.slice(group.prefix.length))}
                      active={preferences.includes(preference)}
                      icon={preferences.includes(preference) ? "checkmark" : undefined}
                      onPress={() => togglePreference(preference)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </Card>
        </FadeIn>
      </Screen>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Button title="Save" size="lg" onPress={savePreferences} loading={saving} />
      </View>
    </View>
  );
}
