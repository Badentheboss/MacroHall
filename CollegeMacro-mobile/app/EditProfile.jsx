import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import Avatar from "../components/Avatar";
import { fetchHalls, fetchMySchool } from "../utils/schools";
import { ACCENTS, AVATARS, GOALS, VISIBILITY, fetchProfile, getMyUserId, updateMyProfile } from "../utils/profiles";

const CURRENT_YEAR = new Date().getFullYear();
const CLASS_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

export default function EditProfile({ navigation }) {
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);

  const [form, setForm] = useState(null);
  const [halls, setHalls] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [profile, school] = await Promise.all([getMyUserId().then(fetchProfile), fetchMySchool()]);
      setForm({
        display_name: profile?.display_name || "",
        username: profile?.username || "",
        bio: profile?.bio || "",
        avatar_emoji: profile?.avatar_emoji || "🍽️",
        accent_color: profile?.accent_color || "#32745f",
        goal: profile?.goal || null,
        class_year: profile?.class_year || null,
        favorite_hall_id: profile?.favorite_hall?.id || null,
        log_visibility: profile?.log_visibility || "friends",
      });
      if (school) setHalls(await fetchHalls(school.id));
    })().catch(() => Alert.alert("Error", "Couldn't load your profile."));
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key, value) => setForm((current) => ({ ...current, [key]: current[key] === value ? null : value }));

  const save = async () => {
    if (!form.display_name.trim()) {
      Alert.alert("Name required", "Add the name friends will see.");
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        ...form,
        display_name: form.display_name.trim(),
        username: form.username.trim().toLowerCase() || null,
        bio: form.bio.trim() || null,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Couldn't save", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color="#32745f" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <Avatar emoji={form.avatar_emoji} color={form.accent_color} size={84} />
        </View>

        <Text style={styles.label}>Avatar</Text>
        <View style={styles.wrap}>
          {AVATARS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => set("avatar_emoji", emoji)}
              style={[styles.emoji, form.avatar_emoji === emoji && { borderColor: form.accent_color, borderWidth: 2 }]}
              accessibilityLabel={`Avatar ${emoji}`}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.wrap}>
          {ACCENTS.map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => set("accent_color", color)}
              style={[styles.swatch, { backgroundColor: color }, form.accent_color === color && styles.swatchSelected]}
              accessibilityLabel={`Color ${color}`}
            />
          ))}
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={form.display_name} onChangeText={(v) => set("display_name", v)} maxLength={60} placeholderTextColor="#888" />

        <Text style={styles.label}>Username</Text>
        <View style={styles.usernameRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={form.username}
            onChangeText={(v) => set("username", v.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            placeholder="so friends can find you"
            placeholderTextColor="#888"
          />
        </View>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 12 }]}
          value={form.bio}
          onChangeText={(v) => set("bio", v)}
          maxLength={160}
          multiline
          placeholder="PPL 6x/week · chasing 180g protein"
          placeholderTextColor="#888"
        />
        <Text style={styles.counter}>{form.bio.length}/160</Text>

        <Text style={styles.label}>Goal</Text>
        <View style={styles.wrap}>
          {GOALS.map((goal) => (
            <Chip key={goal.key} active={form.goal === goal.key} color={form.accent_color} onPress={() => toggle("goal", goal.key)} styles={styles}>
              {goal.emoji} {goal.label}
            </Chip>
          ))}
        </View>

        <Text style={styles.label}>Class of</Text>
        <View style={styles.wrap}>
          {CLASS_YEARS.map((year) => (
            <Chip key={year} active={form.class_year === year} color={form.accent_color} onPress={() => toggle("class_year", year)} styles={styles}>
              {year}
            </Chip>
          ))}
        </View>

        {halls.length > 0 && (
          <>
            <Text style={styles.label}>Favorite dining hall</Text>
            <View style={styles.wrap}>
              {halls.map((hall) => (
                <Chip key={hall.id} active={form.favorite_hall_id === hall.id} color={form.accent_color} onPress={() => toggle("favorite_hall_id", hall.id)} styles={styles}>
                  {hall.name}
                </Chip>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Who can see what you eat</Text>
        {VISIBILITY.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.option, form.log_visibility === option.key && { borderColor: form.accent_color }]}
            onPress={() => set("log_visibility", option.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: form.log_visibility === option.key }}
          >
            <Text style={styles.optionTitle}>{option.label}</Text>
            <Text style={styles.optionHint}>{option.hint}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[styles.save, { backgroundColor: form.accent_color }]} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ active, color, onPress, children, styles }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{children}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (isDarkMode) => {
  const text = isDarkMode ? "#E0E0E0" : "#222";
  const subtle = isDarkMode ? "#999" : "#666";
  const surface = isDarkMode ? "#1E1E1E" : "#fff";
  const border = isDarkMode ? "#333" : "rgba(50,116,95,0.2)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#f5f7fa" },
    content: { padding: 20, paddingBottom: 48 },
    label: { fontSize: 14, fontWeight: "700", color: text, marginTop: 18, marginBottom: 8 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    emoji: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: surface, borderWidth: 1, borderColor: border },
    swatch: { width: 34, height: 34, borderRadius: 17 },
    swatchSelected: { borderWidth: 3, borderColor: isDarkMode ? "#fff" : "#222" },
    input: { height: 50, borderWidth: 1.5, borderColor: border, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: surface, color: text },
    usernameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    at: { fontSize: 18, fontWeight: "700", color: subtle },
    counter: { fontSize: 12, color: subtle, alignSelf: "flex-end", marginTop: 4 },
    chip: { borderWidth: 1.5, borderColor: border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: surface },
    chipText: { fontSize: 14, fontWeight: "600", color: text },
    option: { borderWidth: 1.5, borderColor: border, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: surface },
    optionTitle: { fontSize: 15, fontWeight: "700", color: text },
    optionHint: { fontSize: 13, color: subtle, marginTop: 2 },
    save: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
    saveText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  });
};
